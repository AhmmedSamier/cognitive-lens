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
  // Aggregate lambda complexity into the parent method
  override aggregateLambdaComplexity = true;

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
      return !!(
        grandParent &&
        (grandParent.type === 'argument' || grandParent.type === 'named_argument')
      );
    }
    return false;
  }

  getComplexityType(
    nodeType: string,
    _cursor: TreeCursor,
    _parentType: string,
  ): ComplexityNodeType | undefined {
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
      return this.getBinaryOperatorCursor(node);
    }
    return this.getBinaryOperatorNode(node);
  }

  private getBinaryOperatorCursor(cursor: TreeCursor): string | undefined {
    if (cursor.nodeType === 'if_null_expression') return '??';

    if (!cursor.gotoFirstChild()) return undefined;

    const result = this.findBinaryOperatorInCursor(cursor);

    cursor.gotoParent();
    return result;
  }

  private findBinaryOperatorInCursor(cursor: TreeCursor): string | undefined {
    do {
      const type = cursor.nodeType;
      if (type === 'logical_and_operator') {
        return '&&';
      }
      if (type === 'logical_or_operator') {
        return '||';
      }
      if (type === '??') {
        return '??';
      }
      if (type === '&&' || type === '||') {
        return type;
      }
    } while (cursor.gotoNextSibling());

    return undefined;
  }

  private getBinaryOperatorNode(node: SyntaxNode): string | undefined {
    if (node.type === 'if_null_expression') return '??';

    const secondChild = node.child(1);
    if (secondChild) {
      const fromSecond = this.binaryOperatorFromChild(secondChild);
      if (fromSecond) {
        return fromSecond;
      }
    }

    const fromLogical = this.findLogicalOperator(node.firstChild);
    if (fromLogical) {
      return fromLogical;
    }

    return this.findSymbolOperator(node.firstChild);
  }

  private binaryOperatorFromChild(child: SyntaxNode): string | undefined {
    if (
      child.type === 'logical_and_operator' ||
      child.type === 'logical_or_operator' ||
      child.type === '??'
    ) {
      return child.text;
    }
    if (child.type === '&&' || child.type === '||' || child.type === '??') {
      return child.type;
    }
    return undefined;
  }

  private findLogicalOperator(child: SyntaxNode | null): string | undefined {
    let current = child;
    while (current) {
      if (
        current.type === 'logical_and_operator' ||
        current.type === 'logical_or_operator' ||
        current.type === '??'
      ) {
        return current.text;
      }
      current = current.nextSibling;
    }
    return undefined;
  }

  private findSymbolOperator(child: SyntaxNode | null): string | undefined {
    let current = child;
    while (current) {
      if (current.type === '&&' || current.type === '||' || current.type === '??') {
        return current.type;
      }
      current = current.nextSibling;
    }
    return undefined;
  }

  isElseIf(node: SyntaxNode | TreeCursor): boolean {
    if (isCursor(node)) {
      return this.isElseIfCursor(node);
    }
    return this.isElseIfNode(node);
  }

  private isElseIfCursor(cursor: TreeCursor): boolean {
    if (cursor.nodeType === 'else_clause') {
      return this.cursorElseClauseIsElseIf(cursor);
    }
    if (cursor.nodeType === 'else') {
      return this.cursorElseTokenIsElseIf(cursor);
    }
    return false;
  }

  private cursorElseClauseIsElseIf(cursor: TreeCursor): boolean {
    if (!cursor.gotoFirstChild()) {
      return false;
    }
    const found = this.cursorFirstNamedChildIsIf(cursor);
    cursor.gotoParent();
    return found;
  }

  private cursorFirstNamedChildIsIf(cursor: TreeCursor): boolean {
    do {
      if (cursor.nodeIsNamed) {
        return cursor.nodeType === 'if_statement';
      }
    } while (cursor.gotoNextSibling());
    return false;
  }

  private cursorElseTokenIsElseIf(cursor: TreeCursor): boolean {
    const node = cursor.currentNode;
    const next = node.nextNamedSibling;
    return !!(next && next.type === 'if_statement');
  }

  private isElseIfNode(node: SyntaxNode): boolean {
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

  shouldFlattenNesting(parentType: string, nodeType: string, cursor: TreeCursor): boolean {
    if (parentType === 'if_statement' || parentType === 'if_element') {
      if (nodeType === 'else' || nodeType === 'else_clause') {
        return true;
      }
      if (cursor.currentFieldName === 'alternative') {
        return true;
      }
    }
    return false;
  }
}

export function calculateDartComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new DartAdapter());
}
