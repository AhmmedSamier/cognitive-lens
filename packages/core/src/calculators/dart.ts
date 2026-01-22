import { MethodComplexity } from '../types';
import {
  BaseLanguageAdapter,
  calculateGenericComplexity,
  ComplexityNodeType,
  SyntaxNode,
  Tree,
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
    return nodeType === 'function_body' || SIGNATURE_TYPES.has(nodeType);
  }

  getMethodName(node: SyntaxNode): string {
    if (SIGNATURE_TYPES.has(node.type)) {
      const name = this.getNameFromSignature(node);
      return name ? `__SIG__${name}` : 'anonymous';
    }

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

  getBinaryOperator(node: SyntaxNode): string | undefined {
    if (node.type === 'if_null_expression') return '??';

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
  const adapter = new DartAdapter();
  const rawMethods = calculateGenericComplexity(tree, adapter);
  return mergeDartMethods(rawMethods);
}

function mergeDartMethods(methods: MethodComplexity[]): MethodComplexity[] {
  const merged: MethodComplexity[] = [];

  for (let i = 0; i < methods.length; i++) {
    const current = methods[i];

    if (current.name.startsWith('__SIG__')) {
      const realName = current.name.substring(7); // remove __SIG__

      // Check if there is a next method
      if (i + 1 < methods.length) {
        const next = methods[i + 1];

        // If next method has the same name (without prefix), it's the body
        if (next.name === realName) {
          // Merge
          next.score += current.score;
          // Prepend signature details to body details
          next.details = [...current.details, ...next.details];
          // Use signature start position
          next.startIndex = current.startIndex;
          next.startLine = current.startLine;

          // Skip next iteration as we merged it
          i++;
          merged.push(next);
          continue;
        }
      }

      // If we are here, it means we didn't merge (e.g. abstract method or signature without body)
      // Just rename it and keep it
      current.name = realName;
      merged.push(current);
    } else {
      // Normal method (or body that wasn't preceded by signature - e.g. anonymous or already processed?)
      // Anonymous functions don't get __SIG__ prefix so they fall here.
      merged.push(current);
    }
  }

  return merged;
}
