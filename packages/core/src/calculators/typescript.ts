import * as ts from 'typescript';
import { MethodComplexity, ComplexityDetail } from '../types';

export function calculateTypeScriptComplexity(sourceFile: ts.SourceFile): MethodComplexity[] {
    const methods: MethodComplexity[] = [];
    const ancestors: MethodComplexity[] = [];

    function visit(node: ts.Node, parent?: ts.Node) {
        let isMethodNode = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
        let method: MethodComplexity | undefined;

        if (isMethodNode) {
            const complexity = computeComplexity(node as ts.FunctionLikeDeclaration, sourceFile);

            let name = 'anonymous';
            if ((node as any).name) {
                name = (node as any).name.getText(sourceFile);
            } else if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
                name = parent.name.text;
            } else if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
                name = parent.name.text;
            }

            // Check if it is a callback (argument to a call)
            // Or typically any function passed as argument.
            const isCallback = parent ? (ts.isCallExpression(parent) || ts.isNewExpression(parent)) : false;

            method = {
                name,
                score: complexity.score,
                details: complexity.details,
                startIndex: node.getStart(sourceFile),
                endIndex: node.getEnd(),
                isCallback
            };

            // Aggregate score to all ancestors
            for (const ancestor of ancestors) {
                ancestor.score += method.score;
            }

            ancestors.push(method);
            methods.push(method);
        }

        ts.forEachChild(node, child => visit(child, node));

        if (isMethodNode) {
            ancestors.pop();
        }
    }

    visit(sourceFile);

    return methods;
}

function computeComplexity(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): { score: number, details: ComplexityDetail[] } {
    let score = 0;
    const details: ComplexityDetail[] = [];
    // const sourceFile = node.getSourceFile(); // Removed: Avoid dependency on setParentNodes

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

    function visit(n: ts.Node, nesting: number, parent?: ts.Node) {
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
                if (parent && ts.isIfStatement(parent) && parent.elseStatement === n) {
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
                // If it's an 'else if', we don't increase nesting cost for the 'if' itself relative to the parent 'if'
                // But we still count it as structural.
                // Logic: else if (parent is if, n is elseStatement of parent)
                if (!(ts.isIfStatement(n) && parent && ts.isIfStatement(parent) && parent.elseStatement === n)) {
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

            visit(child, nextNesting, n);
        });
    }

    if (node.body) {
        visit(node.body, 0, node);
    } else {
        // node.body should be present for Block, but if it's expression body arrow function, it's the expression
        visit(node.body || node, 0, node);
    }

    return { score, details };
}
