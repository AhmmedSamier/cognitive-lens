import { MethodComplexity } from '../types';
import { CFamilyAdapter } from './cFamily';
import { calculateGenericComplexity, SyntaxNode, Tree } from './common';

class CAdapter extends CFamilyAdapter {
  isMethodType(nodeType: string): boolean {
    return nodeType === 'function_definition';
  }

  getMethodName(node: SyntaxNode): string {
    return this.getNameFromDeclarator(node);
  }

  isCallback(_node: SyntaxNode, _parentType: string): boolean {
    return false;
  }
}

export function calculateCComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new CAdapter());
}
