import * as ts from 'typescript';

export interface ComplexityDetail {
    line: number;
    score: number;
    message: string;
}

export interface MethodComplexity {
    name: string;
    score: number;
    details: ComplexityDetail[];
    node: ts.FunctionLikeDeclaration;
}

export function calculateComplexity(sourceFile: ts.SourceFile): MethodComplexity[] {
    const methods: MethodComplexity[] = [];

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            const complexity = computeComplexity(node);

            let name = 'anonymous';
            if ((node as any).name) {
                name = (node as any).name.getText(sourceFile);
            } else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
                name = node.parent.name.text;
            } else if (ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name)) {
                name = node.parent.name.text;
            }

            methods.push({
                name,
                score: complexity.score,
                details: complexity.details,
                node: node as ts.FunctionLikeDeclaration
            });
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Aggregate scores from nested functions to their parents
    for (const parent of methods) {
        for (const child of methods) {
            if (parent === child) continue;

            // Check if child is inside parent
            if (child.node.getStart(sourceFile) >= parent.node.getStart(sourceFile) &&
                child.node.getEnd() <= parent.node.getEnd()) {

                // Add child's score to parent
                // Note: We add the child's *calculated* score (which is "own" score).
                // If the child also contains other functions, those are added to the child,
                // AND also added to the parent (because they are also inside the parent).
                // This is correct: Total(Parent) = Own(Parent) + Sum(Own(Descendant) for Descendant in Parent).
                // We use the 'score' property which was initialized with 'own' score.
                // But wait, if we modify 'parent.score' in place, and we iterate,
                // we might double count if we are not careful?
                // No, we are iterating over the list.
                // If we update parent.score, and then use parent.score to update grandparent...
                // Wait.
                // Logic: A contains B. B contains C.
                // Initial: A=1, B=2, C=3.
                // 1. Add C to B. B becomes 5.
                // 2. Add C to A. A becomes 4.
                // 3. Add B to A. A becomes 4 + 5 = 9?
                // WRONG. A should be 1 + 2 + 3 = 6.
                // So we should NOT use the updated score of the child. We should use the ORIGINAL score.

                // We need to keep original scores or separate "total" from "own".
                // But the interface says `score`.
                // Let's create a map of original scores.
            }
        }
    }

    // To do this correctly without O(N^2) double counting issues:
    // 1. Store original scores.
    const originalScores = new Map<MethodComplexity, number>();
    for (const m of methods) {
        originalScores.set(m, m.score);
    }

    for (const parent of methods) {
        for (const child of methods) {
            if (parent === child) continue;

             if (child.node.getStart(sourceFile) >= parent.node.getStart(sourceFile) &&
                child.node.getEnd() <= parent.node.getEnd()) {

                 // Add child's ORIGINAL score to parent
                 parent.score += originalScores.get(child)!;
             }
        }
    }

    return methods;
}

function computeComplexity(node: ts.FunctionLikeDeclaration): { score: number, details: ComplexityDetail[] } {
    let score = 0;
    const details: ComplexityDetail[] = [];
    const sourceFile = node.getSourceFile();

    function add(n: ts.Node, amount: number, message: string) {
        if (amount === 0) return;
        score += amount;
        const line = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line;
        details.push({ line, score: amount, message });
    }

    function isLoop(n: ts.Node) {
        return n.kind === ts.SyntaxKind.ForStatement ||
               n.kind === ts.SyntaxKind.ForInStatement ||
               n.kind === ts.SyntaxKind.ForOfStatement ||
               n.kind === ts.SyntaxKind.WhileStatement ||
               n.kind === ts.SyntaxKind.DoStatement;
    }

    function visit(n: ts.Node, nesting: number) {
        // If we hit a nested function, we STOP traversal for the current score calculation.
        // The nested function will be picked up by the main `calculateComplexity` loop.
        if (n !== node && (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n))) {
            return;
        }

        let structural = 0;
        let increasesNesting = false;
        let label = '';

        switch (n.kind) {
            case ts.SyntaxKind.IfStatement:
                label = 'if';
                structural = 1;
                increasesNesting = true;
                if (ts.isIfStatement(n.parent) && n.parent.elseStatement === n) {
                    // else if
                }
                break;

            case ts.SyntaxKind.SwitchStatement:
                label = 'switch';
                structural = 1;
                increasesNesting = true;
                break;

            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.CatchClause:
                label = 'catch';
                if (isLoop(n)) label = 'loop';
                structural = 1;
                increasesNesting = true;
                break;

            case ts.SyntaxKind.ConditionalExpression:
                label = 'ternary';
                structural = 1;
                increasesNesting = false;
                break;

            case ts.SyntaxKind.BinaryExpression:
                const be = n as ts.BinaryExpression;
                const token = be.operatorToken.kind;
                if (token === ts.SyntaxKind.AmpersandAmpersandToken || token === ts.SyntaxKind.BarBarToken) {
                     let left = be.left;
                     while(ts.isParenthesizedExpression(left)) left = left.expression;

                     if (ts.isBinaryExpression(left) && left.operatorToken.kind === token) {
                         // Continuation
                     } else {
                         structural = 1;
                         label = token === ts.SyntaxKind.AmpersandAmpersandToken ? '&&' : '||';
                     }
                }
                break;
        }

        // Handle `else` (pure else)
        if (ts.isIfStatement(n) && n.elseStatement && !ts.isIfStatement(n.elseStatement)) {
            add(n.elseStatement, 1, 'else');
            if (nesting > 0) {
                add(n.elseStatement, nesting, 'nesting');
            }
        }

        if (structural > 0) {
            add(n, structural, label);

            if (increasesNesting) {
                // If it's NOT an "else if", pay nesting tax
                if (!(ts.isIfStatement(n) && ts.isIfStatement(n.parent) && n.parent.elseStatement === n)) {
                    if (nesting > 0) {
                        add(n, nesting, 'nesting');
                    }
                }
            }
        }

        // Recurse
        let childNesting = nesting;
        if (increasesNesting) {
            childNesting = nesting + 1;
        }

        ts.forEachChild(n, child => {
            let nextNesting = childNesting;

            // Special handling for `else if` child
            if (ts.isIfStatement(n) && child === n.elseStatement && ts.isIfStatement(child)) {
                nextNesting = nesting;
            }

            visit(child, nextNesting);
        });
    }

    if (node.body) {
        visit(node.body, 0);
    } else {
        // Arrow function with implicit return: `const a = () => 1`
        // `node.body` is the expression `1`.
        // We should visit it.
        // Wait, `node.body` exists on FunctionLikeDeclaration.
        visit(node.body || node, 0);
    }

    return { score, details };
}
