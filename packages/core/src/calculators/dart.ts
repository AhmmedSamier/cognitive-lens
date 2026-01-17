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
      const id = sig.children.find((c: SyntaxNode) => c.type === 'identifier');
      if (id) return id.text;
    }

    if (sig.type === 'method_signature') {
      return this.getNameFromMethodSignature(sig);
    }

    // function_signature
    return this.getNameFromFunctionSignature(sig);
  }

  private getNameFromMethodSignature(sig: SyntaxNode): string | null {
    const inner = sig.children.find((c: SyntaxNode) => c.type === 'function_signature');
    if (inner) {
      // Check in function_signature
      return this.getNameFromFunctionSignature(inner);
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
    const id = sig.children.find((c: SyntaxNode) => c.type === 'identifier');
    if (id) return id.text;

    return null;
  }

  isCallback(node: SyntaxNode): boolean {
    let p = node.parent;
    if (p && p.type === 'function_expression') {
      p = p.parent;
    }
    return !!(p && (p.type === 'argument' || p.type === 'named_argument'));
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

    const opNode = node.children.find((c: SyntaxNode) =>
      ['logical_and_operator', 'logical_or_operator', '??'].includes(c.type),
    );
    if (opNode) return opNode.text;

    const directOp = node.children.find((c: SyntaxNode) => ['&&', '||', '??'].includes(c.type));
    return directOp?.type;
  }

  isElseIf(node: SyntaxNode): boolean {
    if (node.type === 'else_clause') {
      return node.children.some((c: SyntaxNode) => c.type === 'if_statement');
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
  return calculateGenericComplexity(tree, new DartAdapter());
}
