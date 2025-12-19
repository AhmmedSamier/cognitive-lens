import { Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity } from '../types';
import { calculateGenericComplexity, BaseLanguageAdapter, ComplexityNodeType } from './common';

class CSharpAdapter extends BaseLanguageAdapter {
    isMethod(node: SyntaxNode): boolean {
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

    getMethodName(node: SyntaxNode): string {
        if (node.type === 'method_declaration' || node.type === 'local_function_statement' || node.type === 'constructor_declaration') {
             const nameNode = node.childForFieldName('name');
             if (nameNode) return nameNode.text;
        }
        return 'anonymous';
    }

    isCallback(node: SyntaxNode): boolean {
        return !!(node.parent && node.parent.type === 'argument');
    }

    getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined {
        switch (node.type) {
            case 'if_statement': return 'IF';
            case 'switch_statement':
            case 'switch_expression': return 'SWITCH';
            case 'for_statement':
            case 'foreach_statement':
            case 'while_statement':
            case 'do_statement': return 'LOOP';
            case 'catch_clause':
            case 'catch_filter_clause': return 'CATCH';
            case 'conditional_expression': return 'TERNARY';
            case 'binary_expression': return 'BINARY';
            case 'else_clause': return 'ELSE';
            default:
                // Check for implicit else (alternative field which is not else_clause)
                // C# 'if' structure: if (cond) con alternative
                const alternative = node.parent?.childForFieldName('alternative');
                if (alternative && node.equals(alternative)) {
                    // If the alternative is an 'if_statement', it's an "else if", so it will be handled as IF.
                    // If it is NOT an 'if_statement', it is a pure ELSE branch (e.g. a block).
                    if (node.type !== 'if_statement') {
                        return 'ELSE';
                    }
                }
                return undefined;
        }
    }

    getBinaryOperator(node: SyntaxNode): string | undefined {
        const operatorNode = node.children.find(c => c.type === '&&' || c.type === '||');
        return operatorNode?.type;
    }

    isElseIf(node: SyntaxNode): boolean {
        if (node.type === 'else_clause') {
            return node.children.some(c => c.type === 'if_statement');
        }
        // For inferred ELSE (blocks), they don't wrap 'if' in the same way 'else_clause' does.
        // Even if a block contains an IF, it's nesting, not 'else if' structure.
        return false;
    }

    shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean {
        if (parent.type === 'if_statement') {
             const alternative = parent.childForFieldName('alternative');
             // Flatten if the child is the 'else' branch.
             // Whether it is 'else if' or just 'else', it shouldn't inherit the 'if's nesting.
             if (alternative && child.equals(alternative)) {
                 return true;
             }
        }
        return false;
    }
}

export function calculateCSharpComplexity(tree: Tree): MethodComplexity[] {
    return calculateGenericComplexity(tree, new CSharpAdapter());
}
