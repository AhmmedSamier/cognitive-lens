import { MethodComplexity } from '../types';
import { CFamilyAdapter } from './cFamily';
import {
  calculateGenericComplexity,
  ComplexityNodeType,
  SyntaxNode,
  Tree,
  TreeCursor,
} from './common';

const METHOD_TYPES = new Set(['function_definition', 'lambda_expression']);

class CppAdapter extends CFamilyAdapter {
  isMethodType(nodeType: string): boolean {
    return METHOD_TYPES.has(nodeType);
  }

  getMethodName(node: SyntaxNode): string {
    if (node.type === 'lambda_expression') {
      return 'lambda';
    }
    return this.getNameFromDeclarator(node);
  }

  isCallback(_node: SyntaxNode, parentType: string): boolean {
    return parentType === 'argument_list';
  }

  override getComplexityType(
    nodeType: string,
    cursor: TreeCursor,
    parentType: string,
  ): ComplexityNodeType | undefined {
    if (nodeType === 'catch_clause') {
      return 'CATCH';
    }
    return super.getComplexityType(nodeType, cursor, parentType);
  }
}

export function calculateCppComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new CppAdapter());
}
