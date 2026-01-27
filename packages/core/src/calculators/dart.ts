import { MethodComplexity } from '../types';
import {
  BaseLanguageAdapter,
  calculateGenericComplexity,
  ComplexityNodeType,
  SyntaxNode,
  Tree,
  TreeCursor,
  isCursor,
} from './common';

const LOOP_TYPES = new Set(['for_statement', 'while_statement', 'do_statement', 'for_element']);
const CATCH_TYPES = new Set(['catch_clause', 'on_part']);
const BINARY_TYPES = new Set([
  'binary_expression',
  'logical_and_expression',
  'logical_or_expression',
  'if_null_expression',
]);
const SIGNATURE_TYPES = new Set([
  'function_signature',
  'method_signature',
  'constructor_signature',
  'getter_signature',
  'setter_signature',
]);

class DartAdapter extends BaseLanguageAdapter {
  isMethodType(nodeType: string): boolean {
    return nodeType === 'function_body';
  }

  getMethodName(node: SyntaxNode): string {
    const sig = this.getSignatureNode(node);
    if (!sig) return 'anonymous';
    return this.getNameFromSignature(sig) || 'anonymous';
  }

  private getSignatureNode(bodyNode: SyntaxNode): SyntaxNode | null {
    const sig = bodyNode.previousNamedSibling;
    if (sig && SIGNATURE_TYPES.has(sig.type)) {
      return sig;
    }
    return null;
  }

  private getNameFromSignature(sig: SyntaxNode): string | null {
    if (sig.type === 'constructor_signature') {
      return 'constructor';
    }

    if (sig.type === 'getter_signature' || sig.type === 'setter_signature') {
      let child = sig.firstChild;
      while (child) {
        if (child.type === 'identifier') return child.text;
        child = child.nextSibling;
      }
    }

    if (sig.type === 'method_signature') {
      return this.getNameFromMethodSignature(sig);
    }

    // function_signature
    return this.getNameFromFunctionSignature(sig);
  }

  private getNameFromMethodSignature(sig: SyntaxNode): string | null {
    let child = sig.firstChild;
    while (child) {
      if (child.type === 'function_signature') {
        return this.getNameFromFunctionSignature(child);
      }
      child = child.nextSibling;
    }

    // direct identifier?
    const nameNode = sig.childForFieldName('name');
    if (nameNode) return nameNode.text;
    return null;
  }

  private getNameFromFunctionSignature(sig: SyntaxNode): string | null {
    const nameNode = sig.childForFieldName('name');
    if (nameNode) return nameNode.text;

    // manual fallback
    let child = sig.firstChild;
    while (child) {
      if (child.type === 'identifier') return child.text;
      child = child.nextSibling;
    }

    return null;
  }

  isCallback(node: SyntaxNode, parentType: string): boolean {
    if (parentType === 'argument' || parentType === 'named_argument') {
      return true;
    }
    if (parentType === 'function_expression') {
      const grandParent = node.parent?.parent;
      return !!(grandParent && (grandParent.type === 'argument' || grandParent.type === 'named_argument'));
    }
    return false;
  }

  getComplexityType(nodeType: string, _currentFieldName?: string | null): ComplexityNodeType | undefined {
    // Map node types to ComplexityNodeType
    if (this.isLoop(nodeType)) return 'LOOP';
    if (this.isCatch(nodeType)) return 'CATCH';
    if (this.isBinary(nodeType)) return 'BINARY';
    if (this.isTernary(nodeType)) return 'TERNARY';
    if (nodeType === 'if_statement' || nodeType === 'if_element') return 'IF';
    if (nodeType === 'switch_statement') return 'SWITCH';
    if (nodeType === 'else_clause' || nodeType === 'else') return 'ELSE';

    return undefined;
  }

  private isLoop(type: string): boolean {
    return LOOP_TYPES.has(type);
  }

  private isCatch(type: string): boolean {
    return CATCH_TYPES.has(type);
  }

  private isBinary(type: string): boolean {
    return BINARY_TYPES.has(type);
  }

  private isTernary(type: string): boolean {
    return type === 'conditional_expression';
  }

  getBinaryOperator(node: SyntaxNode | TreeCursor): string | undefined {
    if (isCursor(node)) {
      const cursor = node;
      if (cursor.nodeType === 'if_null_expression') return '??';

      if (!cursor.gotoFirstChild()) return undefined;

      do {
        const type = cursor.nodeType;
        if (type === 'logical_and_operator') {
          cursor.gotoParent();
          return '&&';
        }
        if (type === 'logical_or_operator') {
          cursor.gotoParent();
          return '||';
        }
        if (type === '??') {
          cursor.gotoParent();
          return '??';
        }
        if (type === '&&' || type === '||') {
          cursor.gotoParent();
          return type;
        }
      } while (cursor.gotoNextSibling());

      cursor.gotoParent();
      return undefined;
    }

    if (node.type === 'if_null_expression') return '??';

    // Performance optimization: Check child(1) first
    const secondChild = node.child(1);
    if (secondChild) {
      if (
        secondChild.type === 'logical_and_operator' ||
        secondChild.type === 'logical_or_operator' ||
        secondChild.type === '??'
      ) {
        return secondChild.text;
      }
      if (secondChild.type === '&&' || secondChild.type === '||' || secondChild.type === '??') {
        return secondChild.type;
      }
    }

    let child = node.firstChild;
    while (child) {
      if (
        child.type === 'logical_and_operator' ||
        child.type === 'logical_or_operator' ||
        child.type === '??'
      ) {
        return child.text;
      }
      child = child.nextSibling;
    }

    child = node.firstChild;
    while (child) {
      if (child.type === '&&' || child.type === '||' || child.type === '??') {
        return child.type;
      }
      child = child.nextSibling;
    }
    return undefined;
  }

  isElseIf(node: SyntaxNode): boolean {
    if (node.type === 'else_clause') {
      return node.firstNamedChild?.type === 'if_statement';
    }
    if (node.type === 'else') {
      const next = node.nextNamedSibling;
      return !!(next && next.type === 'if_statement');
    }
    return false;
  }

  canFlattenNesting(nodeType: string): boolean {
    return nodeType === 'if_statement' || nodeType === 'if_element';
  }

  shouldFlattenNesting(parentType: string, nodeType: string, currentFieldName?: string | null): boolean {
    if (parentType === 'if_statement' || parentType === 'if_element') {
      if (nodeType === 'else' || nodeType === 'else_clause') {
        return true;
      }
      const alternative = currentFieldName;
      if (alternative === 'alternative') {
        return true;
      }
    }
    return false;
  }
}

export function calculateDartComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new DartAdapter());
}
