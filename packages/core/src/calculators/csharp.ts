import { Parser, Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity, ComplexityDetail } from '../types';

export function calculateCSharpComplexity(tree: Tree): MethodComplexity[] {
    const methods: MethodComplexity[] = [];
    const rootNode = tree.rootNode;

    const rawMethods: { method: MethodComplexity, node: SyntaxNode }[] = [];

    function visit(node: SyntaxNode) {
        if (isMethod(node)) {
            const complexity = computeComplexity(node);

            let name = 'anonymous';
            if (node.type === 'method_declaration' || node.type === 'local_function_statement') {
                 const nameNode = node.childForFieldName('name');
                 if (nameNode) name = nameNode.text;
            } else if (node.type === 'constructor_declaration') {
                 const nameNode = node.childForFieldName('name');
                 if (nameNode) name = nameNode.text;
            }

            const method: MethodComplexity = {
                name,
                score: complexity.score,
                details: complexity.details,
                startIndex: node.startIndex,
                endIndex: node.endIndex
            };
            rawMethods.push({ method, node });
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(rootNode);

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

function isMethod(node: SyntaxNode): boolean {
    return [
        'method_declaration',
        'local_function_statement',
        'lambda_expression',
        'anonymous_method_expression',
        'constructor_declaration',
        'destructor_declaration',
        'operator_declaration'
    ].includes(node.type);
}

function computeComplexity(node: SyntaxNode): { score: number, details: ComplexityDetail[] } {
    let score = 0;
    const details: ComplexityDetail[] = [];

    function add(n: SyntaxNode, amount: number, message: string) {
        if (amount === 0) return;
        score += amount;
        const line = n.startPosition.row;
        details.push({ line, score: amount, message });
    }

    function isLoop(n: SyntaxNode) {
        return [
            'for_statement',
            'foreach_statement',
            'while_statement',
            'do_statement'
        ].includes(n.type);
    }

    function visit(n: SyntaxNode, nesting: number) {
        if (n !== node && isMethod(n)) {
            return;
        }

        let structural = 0;
        let increasesNesting = false;
        let label = '';

        switch (n.type) {
            case 'if_statement':
                label = 'if';
                structural = 1;
                increasesNesting = true;

                // Check for else
                const alternative = n.childForFieldName('alternative');
                if (alternative && alternative.type !== 'if_statement') {
                    add(alternative, 1, 'else');
                    if (nesting > 0) {
                        add(alternative, nesting, 'nesting');
                    }
                }
                break;

            case 'switch_statement':
            case 'switch_expression':
                label = 'switch';
                structural = 1;
                increasesNesting = true;
                break;

            case 'for_statement':
            case 'foreach_statement':
            case 'while_statement':
            case 'do_statement':
                label = 'loop';
                structural = 1;
                increasesNesting = true;
                break;

            case 'catch_clause':
            case 'catch_filter_clause':
                label = 'catch';
                structural = 1;
                increasesNesting = true;
                break;

            case 'conditional_expression':
                label = 'ternary';
                structural = 1;
                increasesNesting = false;
                break;

            case 'binary_expression':
                break;
        }

        if (n.type === 'binary_expression') {
            const operatorNode = n.children.find(c => c.type === '&&' || c.type === '||');
            if (operatorNode) {
                 const op = operatorNode.type;
                 let left = n.childForFieldName('left');
                 let isContinuation = false;

                 while (left && left.type === 'parenthesized_expression') {
                     left = left.childForFieldName('expression');
                 }

                 if (left && left.type === 'binary_expression') {
                     const leftOp = left.children.find(c => c.type === '&&' || c.type === '||');
                     if (leftOp && leftOp.type === op) {
                         isContinuation = true;
                     }
                 }

                 if (!isContinuation) {
                     structural = 1;
                     label = op;
                 }
            }
        }

        // Handling for `else_clause` if it appears in AST (backward compatibility or different grammar version)
        if (n.type === 'else_clause') {
            let isElseIf = false;
            if (n.children.some(c => c.type === 'if_statement')) {
                isElseIf = true;
            }

            if (!isElseIf) {
                add(n, 1, 'else');
                if (nesting > 0) {
                    add(n, nesting, 'nesting');
                }
            }
        }

        if (structural > 0) {
            add(n, structural, label);

            if (increasesNesting) {
                 if (nesting > 0) {
                    add(n, nesting, 'nesting');
                }
            }
        }

        let childNesting = nesting;
        if (increasesNesting) {
            childNesting = nesting + 1;
        }

        for (const child of n.children) {
             let nextNesting = childNesting;

             // Handle `else if` flattening
             if (n.type === 'if_statement') {
                 const alternative = n.childForFieldName('alternative');
                 if (alternative && child.equals(alternative) && child.type === 'if_statement') {
                     nextNesting = nesting; // Pass original nesting
                 }
             }

             visit(child, nextNesting);
        }
    }

    for (const child of node.children) {
        visit(child, 0);
    }

    return { score, details };
}
