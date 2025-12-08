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
