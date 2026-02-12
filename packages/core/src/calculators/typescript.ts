import { MethodComplexity } from '../types';
import {
  BaseLanguageAdapter,
  calculateGenericComplexity,
  ComplexityNodeType,
  isCursor,
  SyntaxNode,
  Tree,
  TreeCursor,
} from './common';

const METHOD_TYPES = new Set([
  'function_declaration',
  'method_definition',
  'arrow_function',
  'function_expression',
  'generator_function_declaration',
]);

class TypeScriptAdapter extends BaseLanguageAdapter {
  isMethodType(nodeType: string): boolean {
    return METHOD_TYPES.has(nodeType);
  }

  getMethodName(node: SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    const parent = node.parent;
    if (parent) {
      if (parent.type === 'variable_declarator') {
        const parentName = parent.childForFieldName('name');
        if (parentName) return parentName.text;
      } else if (parent.type === 'pair') {
        const key = parent.childForFieldName('key');
        if (key) return key.text;
      } else if (parent.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) return left.text;
      }
    }
    return 'anonymous';
  }

  isCallback(_node: SyntaxNode, parentType: string): boolean {
    return parentType === 'arguments';
  }

  getComplexityType(nodeType: string, _cursor: TreeCursor): ComplexityNodeType | undefined {
    switch (nodeType) {
      case 'if_statement':
        return 'IF';
      case 'switch_statement':
        return 'SWITCH';
      case 'for_statement':
      case 'for_in_statement':
      case 'for_of_statement':
      case 'while_statement':
      case 'do_statement':
        return 'LOOP';
      case 'catch_clause':
        return 'CATCH';
      case 'ternary_expression':
      case 'conditional_expression':
        return 'TERNARY';
      case 'binary_expression':
        return 'BINARY';
      case 'else_clause':
        return 'ELSE';
      default:
        return undefined;
    }
  }

  getBinaryOperator(node: SyntaxNode | TreeCursor): string | undefined {
    if (isCursor(node)) {
      const cursor = node;
      if (!cursor.gotoFirstChild()) {
        return undefined;
      }

      do {
        if (cursor.nodeType === '&&') {
          const op = cursor.nodeType;
          cursor.gotoParent();
          return op;
        }
      } while (cursor.gotoNextSibling());

      cursor.gotoParent();
      return undefined;
    }

    // Performance optimization: Check child(1) first as it is usually the operator
    // in a binary expression (left, op, right). This avoids iterating children
    // and creating wrapper objects for them in the common case.
    const secondChild = node.child(1);
    if (secondChild && secondChild.type === '&&') {
      return secondChild.type;
    }

    let child = node.firstChild;
    while (child) {
      // SonarJS only counts && sequences, not || or ??
      // See S3776/rule.ts: current.operator !== '||' && current.operator !== '??'
      if (child.type === '&&') {
        return child.type;
      }
      child = child.nextSibling;
    }
    return undefined;
  }

  isElseIf(node: SyntaxNode | TreeCursor): boolean {
    if (isCursor(node)) {
      if (node.gotoFirstChild()) {
        let found = false;
        do {
          if (node.nodeIsNamed) {
            if (node.nodeType === 'if_statement') {
              found = true;
            }
            break;
          }
        } while (node.gotoNextSibling());
        node.gotoParent();
        return found;
      }
      return false;
    }
    return node.firstNamedChild?.type === 'if_statement';
  }

  canFlattenNesting(nodeType: string): boolean {
    return nodeType === 'if_statement';
  }

  shouldFlattenNesting(parentType: string, nodeType: string, _cursor: TreeCursor): boolean {
    // Flatten nesting for any else_clause.
    // The else_clause itself (if not else-if) will add +1 score,
    // but it shouldn't inherit the nesting penalty from the parent IF.
    return parentType === 'if_statement' && nodeType === 'else_clause';
  }
}

export function calculateTypeScriptComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new TypeScriptAdapter());
}
