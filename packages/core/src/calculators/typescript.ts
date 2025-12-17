import { Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity, ComplexityDetail } from '../types';

export function calculateTypeScriptComplexity(tree: Tree): MethodComplexity[] {
    const methods: MethodComplexity[] = [];
    const rootNode = tree.rootNode;
    const ancestors: MethodComplexity[] = [];

    function visit(node: SyntaxNode) {
        let isMethodNode = isMethod(node);
        let method: MethodComplexity | undefined;

        if (isMethodNode) {
            const complexity = computeComplexity(node);

            let name = 'anonymous';
            if (node.childForFieldName('name')) {
                name = node.childForFieldName('name')!.text;
            } else if (node.parent && node.parent.type === 'variable_declarator' && node.parent.childForFieldName('name')) {
                name = node.parent.childForFieldName('name')!.text;
            } else if (node.parent && node.parent.type === 'pair' && node.parent.childForFieldName('key')) {
                name = node.parent.childForFieldName('key')!.text;
            } else if (node.parent && node.parent.type === 'assignment_expression' && node.parent.childForFieldName('left')) {
                name = node.parent.childForFieldName('left')!.text;
            }

            // Check if it is a callback/argument.
            let isCallback = false;
            if (node.parent && node.parent.type === 'arguments') {
                 isCallback = true;
            }

            method = {
                name,
                score: complexity.score,
                details: complexity.details,
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                isCallback
            };

            for (const ancestor of ancestors) {
                ancestor.score += method.score;
            }

            ancestors.push(method);
            methods.push(method);
        }

        let child = node.firstChild;
        while (child) {
            visit(child);
            child = child.nextSibling;
        }

        if (isMethodNode) {
            ancestors.pop();
        }
    }

    visit(rootNode);

    return methods;
}

function isMethod(node: SyntaxNode): boolean {
    return [
        'function_declaration',
        'method_definition',
        'arrow_function',
        'function_expression',
        'generator_function_declaration'
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
            'for_in_statement',
            'for_of_statement',
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
                break;

            case 'switch_statement':
                label = 'switch';
                structural = 1;
                increasesNesting = true;
                break;

            case 'for_statement':
            case 'for_in_statement':
            case 'for_of_statement':
            case 'while_statement':
            case 'do_statement':
                label = 'loop';
                structural = 1;
                increasesNesting = true;
                break;

            case 'catch_clause':
                label = 'catch';
                structural = 1;
                increasesNesting = true;
                break;

            case 'ternary_expression':
            case 'conditional_expression':
                label = 'ternary';
                structural = 1;
                increasesNesting = false;
                break;

            case 'binary_expression':
                break;
        }

        if (n.type === 'binary_expression') {
            // Find operator by traversing all children (including anonymous)
            let operator: string | undefined;
            let child = n.firstChild;
            while(child) {
                if (child.type === '&&' || child.type === '||') {
                    operator = child.type;
                    break;
                }
                child = child.nextSibling;
            }

            if (operator) {
                 let left = n.childForFieldName('left');
                 let isContinuation = false;

                 while (left && left.type === 'parenthesized_expression') {
                     left = left.childForFieldName('expression');
                 }

                 if (left && left.type === 'binary_expression') {
                     // Check left child's operator
                     let leftOp: string | undefined;
                     let leftChild = left.firstChild;
                     while(leftChild) {
                         if (leftChild.type === '&&' || leftChild.type === '||') {
                             leftOp = leftChild.type;
                             break;
                         }
                         leftChild = leftChild.nextSibling;
                     }

                     if (leftOp === operator) {
                         isContinuation = true;
                     }
                 }

                 if (!isContinuation) {
                     structural = 1;
                     label = operator;
                 }
            }
        }

        if (n.type === 'else_clause') {
            let isElseIf = false;
            let child = n.firstChild;
            while (child) {
                if (child.type === 'if_statement') {
                    isElseIf = true;
                    break;
                }
                child = child.nextSibling;
            }

            if (!isElseIf) {
                add(n, 1, 'else');
                if (nesting > 0) {
                    add(n, nesting, 'nesting');
                }
                increasesNesting = true;
            } else {
                increasesNesting = false;
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

        let child = n.firstChild;
        while (child) {
             let nextNesting = childNesting;

             if (n.type === 'if_statement' && child.type === 'else_clause') {
                 nextNesting = nesting;
             }

             visit(child, nextNesting);
             child = child.nextSibling;
        }
    }

    let child = node.firstChild;
    while (child) {
        visit(child, 0);
        child = child.nextSibling;
    }

    return { score, details };
}
