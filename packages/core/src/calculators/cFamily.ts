import {
  BaseLanguageAdapter,
  ComplexityNodeType,
  isCursor,
  SyntaxNode,
  TreeCursor,
} from './common';

export abstract class CFamilyAdapter extends BaseLanguageAdapter {
  override lambdaAlwaysNested = true;
  override aggregateLambdaComplexity = true;

  abstract isMethodType(nodeType: string): boolean;
  abstract getMethodName(node: SyntaxNode): string;
  abstract isCallback(node: SyntaxNode, parentType: string): boolean;

  getComplexityType(
    nodeType: string,
    cursor: TreeCursor,
    parentType: string,
  ): ComplexityNodeType | undefined {
    switch (nodeType) {
      case 'if_statement':
        return 'IF';
      case 'switch_statement':
      case 'case_statement':
        return 'SWITCH';
      case 'for_statement':
      case 'for_range_loop':
      case 'while_statement':
      case 'do_statement':
        return 'LOOP';
      case 'conditional_expression':
        return 'TERNARY';
      case 'binary_expression':
        return 'BINARY';
      case 'else_clause':
        return 'ELSE';
      case 'goto_statement':
        return 'GOTO';
      default: {
        if (
          parentType === 'if_statement' &&
          nodeType !== 'if_statement' &&
          cursor.currentFieldName === 'alternative'
        ) {
          return 'ELSE';
        }
        return undefined;
      }
    }
  }

  getBinaryOperator(node: SyntaxNode | TreeCursor): string | undefined {
    if (isCursor(node)) {
      const cursor = node;
      if (!cursor.gotoFirstChild()) return undefined;

      do {
        const type = cursor.nodeType;
        if (type === '&&' || type === '||') {
          cursor.gotoParent();
          return type;
        }
      } while (cursor.gotoNextSibling());

      cursor.gotoParent();
      return undefined;
    }

    const secondChild = node.child(1);
    if (secondChild && (secondChild.type === '&&' || secondChild.type === '||')) {
      return secondChild.type;
    }

    let child = node.firstChild;
    while (child) {
      if (child.type === '&&' || child.type === '||') {
        return child.type;
      }
      child = child.nextSibling;
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
    if (cursor.nodeType !== 'else_clause') {
      return false;
    }
    if (!cursor.gotoFirstChild()) {
      return false;
    }
    const found = this.firstNamedChildIsIfStatement(cursor);
    cursor.gotoParent();
    return found;
  }

  private firstNamedChildIsIfStatement(cursor: TreeCursor): boolean {
    do {
      if (cursor.nodeIsNamed) {
        return cursor.nodeType === 'if_statement';
      }
    } while (cursor.gotoNextSibling());
    return false;
  }

  private isElseIfNode(node: SyntaxNode): boolean {
    if (node.type !== 'else_clause') {
      return false;
    }
    return node.firstNamedChild?.type === 'if_statement';
  }

  canFlattenNesting(nodeType: string): boolean {
    return nodeType === 'if_statement';
  }

  shouldFlattenNesting(parentType: string, _nodeType: string, cursor: TreeCursor): boolean {
    return parentType === 'if_statement' && cursor.currentFieldName === 'alternative';
  }

  protected unwrapDeclarator(node: SyntaxNode | undefined): SyntaxNode | undefined {
    let current = node;
    while (current) {
      if (
        current.type === 'identifier' ||
        current.type === 'qualified_identifier' ||
        current.type === 'operator_name' ||
        current.type === 'destructor_name' ||
        current.type === 'field_identifier'
      ) {
        return current;
      }
      if (
        current.type === 'function_declarator' ||
        current.type === 'pointer_declarator' ||
        current.type === 'array_declarator' ||
        current.type === 'parenthesized_declarator' ||
        current.type === 'reference_declarator'
      ) {
        current = current.childForFieldName('declarator') ?? current.firstNamedChild ?? undefined;
        continue;
      }
      break;
    }
    return current;
  }

  protected getNameFromDeclarator(node: SyntaxNode): string {
    const declarator = node.childForFieldName('declarator');
    const nameNode = this.unwrapDeclarator(declarator ?? undefined);
    if (!nameNode) return 'anonymous';

    if (nameNode.type === 'qualified_identifier') {
      const name = nameNode.childForFieldName('name');
      return name?.text ?? nameNode.text;
    }

    return nameNode.text;
  }
}
