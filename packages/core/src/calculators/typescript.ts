import * as ts from 'typescript';
import { MethodComplexity, ComplexityDetail } from '../types';

export function calculateTypeScriptComplexity(sourceFile: ts.SourceFile): MethodComplexity[] {
    const methods: MethodComplexity[] = [];

    const rawMethods: { method: MethodComplexity, node: ts.FunctionLikeDeclaration }[] = [];

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

            // Check if it is a callback (argument to a call)
            // Or typically any function passed as argument.
            const isCallback = ts.isCallExpression(node.parent) ||
                               (ts.isNewExpression(node.parent));

            const method: MethodComplexity = {
                name,
                score: complexity.score,
                details: complexity.details,
                startIndex: node.getStart(sourceFile),
                endIndex: node.getEnd(),
                isCallback
            };

            rawMethods.push({ method, node: node as ts.FunctionLikeDeclaration });
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Aggregate scores
    const originalScores = new Map<MethodComplexity, number>();
    for (const { method } of rawMethods) {
        originalScores.set(method, method.score);
    }

    for (const parent of rawMethods) {
        for (const child of rawMethods) {
            if (parent === child) continue;

            if (child.method.startIndex >= parent.method.startIndex &&
                child.method.endIndex <= parent.method.endIndex) {

                parent.method.score += originalScores.get(child.method)!;
            }
        }
    }

    return rawMethods.map(m => m.method);
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

        if (ts.isIfStatement(n) && n.elseStatement && !ts.isIfStatement(n.elseStatement)) {
            add(n.elseStatement, 1, 'else');
            if (nesting > 0) {
                add(n.elseStatement, nesting, 'nesting');
            }
        }

        if (structural > 0) {
            add(n, structural, label);

            if (increasesNesting) {
                if (!(ts.isIfStatement(n) && ts.isIfStatement(n.parent) && n.parent.elseStatement === n)) {
                    if (nesting > 0) {
                        add(n, nesting, 'nesting');
                    }
                }
            }
        }

        let childNesting = nesting;
        if (increasesNesting) {
            childNesting = nesting + 1;
        }

        ts.forEachChild(n, child => {
            let nextNesting = childNesting;

            if (ts.isIfStatement(n) && child === n.elseStatement && ts.isIfStatement(child)) {
                nextNesting = nesting;
            }

            visit(child, nextNesting);
        });
    }

    if (node.body) {
        visit(node.body, 0);
    } else {
        visit(node.body || node, 0);
    }

    return { score, details };
}
