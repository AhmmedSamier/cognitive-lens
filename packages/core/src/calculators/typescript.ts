import { Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity } from '../types';
import { calculateGenericComplexity, BaseLanguageAdapter, ComplexityNodeType } from './common';

class TypeScriptAdapter extends BaseLanguageAdapter {
    isMethod(node: SyntaxNode): boolean {
        return [
            'function_declaration',
            'method_definition',
            'arrow_function',
            'function_expression',
            'generator_function_declaration'
        ].includes(node.type);
    }

    getMethodName(node: SyntaxNode): string {
        if (node.childForFieldName('name')) {
            return node.childForFieldName('name')!.text;
        } else if (node.parent && node.parent.type === 'variable_declarator' && node.parent.childForFieldName('name')) {
            return node.parent.childForFieldName('name')!.text;
        } else if (node.parent && node.parent.type === 'pair' && node.parent.childForFieldName('key')) {
            return node.parent.childForFieldName('key')!.text;
        } else if (node.parent && node.parent.type === 'assignment_expression' && node.parent.childForFieldName('left')) {
            return node.parent.childForFieldName('left')!.text;
        }
        return 'anonymous';
    }

    isCallback(node: SyntaxNode): boolean {
        return !!(node.parent && node.parent.type === 'arguments');
    }

    getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined {
        switch (node.type) {
            case 'if_statement': return 'IF';
            case 'switch_statement': return 'SWITCH';
            case 'for_statement':
            case 'for_in_statement':
            case 'for_of_statement':
            case 'while_statement':
            case 'do_statement': return 'LOOP';
            case 'catch_clause': return 'CATCH';
            case 'ternary_expression':
            case 'conditional_expression': return 'TERNARY';
            case 'binary_expression': return 'BINARY';
            case 'else_clause': return 'ELSE';
            default: return undefined;
        }
    }

    getBinaryOperator(node: SyntaxNode): string | undefined {
        let child = node.firstChild;
        while(child) {
            if (child.type === '&&' || child.type === '||') {
                return child.type;
            }
            child = child.nextSibling;
        }
        return undefined;
    }

    isElseIf(node: SyntaxNode): boolean {
        let child = node.firstChild;
        while (child) {
            if (child.type === 'if_statement') {
                return true;
            }
            child = child.nextSibling;
        }
        return false;
    }

    shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean {
        // Flatten nesting for any else_clause.
        // The else_clause itself (if not else-if) will add +1 score,
        // but it shouldn't inherit the nesting penalty from the parent IF.
        if (parent.type === 'if_statement' && child.type === 'else_clause') {
             return true;
        }
        return false;
    }
}

export function calculateTypeScriptComplexity(tree: Tree): MethodComplexity[] {
    return calculateGenericComplexity(tree, new TypeScriptAdapter());
}
