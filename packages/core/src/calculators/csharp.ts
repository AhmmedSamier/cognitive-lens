import { MethodComplexity } from '../types';
import {
  BaseLanguageAdapter,
  calculateGenericComplexity,
  ComplexityNodeType,
  SyntaxNode,
  Tree,
} from './common';

const METHOD_TYPES = new Set([
  'method_declaration',
  'local_function_statement',
  'lambda_expression',
  'anonymous_method_expression',
  'constructor_declaration',
  'destructor_declaration',
  'operator_declaration',
]);

class CSharpAdapter extends BaseLanguageAdapter {
  // SonarSource C# always increases nesting for lambdas (unlike SonarJS)
  override lambdaAlwaysNested = true;

  isMethodType(nodeType: string): boolean {
    return METHOD_TYPES.has(nodeType);
  }

  getMethodName(node: SyntaxNode): string {
    if (
      node.type === 'method_declaration' ||
      node.type === 'local_function_statement' ||
      node.type === 'constructor_declaration'
    ) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) return nameNode.text;
    }
    return 'anonymous';
  }

  isCallback(node: SyntaxNode): boolean {
    return !!(node.parent && node.parent.type === 'argument');
  }

  getComplexityType(nodeType: string, currentFieldName?: string | null): ComplexityNodeType | undefined {
    switch (nodeType) {
      case 'if_statement':
        return 'IF';
      case 'switch_statement':
      case 'switch_expression':
        return 'SWITCH';
      case 'for_statement':
      case 'foreach_statement':
      case 'while_statement':
      case 'do_statement':
        return 'LOOP';
      case 'catch_clause':
      case 'catch_filter_clause':
        return 'CATCH';
      case 'conditional_expression':
        return 'TERNARY';
      case 'binary_expression':
        return 'BINARY';
      case 'else_clause':
        return 'ELSE';
      case 'goto_statement':
        return 'GOTO'; // SonarSource C#: goto adds +1 + nesting
      default: {
        // Check for implicit else (alternative field which is not else_clause)
        // C# 'if' structure: if (cond) con alternative
        // If currentFieldName is 'alternative' and nodeType is NOT 'if_statement',
        // it is a pure ELSE branch (e.g. a block).
        if (currentFieldName === 'alternative' && nodeType !== 'if_statement') {
            return 'ELSE';
        }
        return undefined;
      }
    }
  }

  getBinaryOperator(node: SyntaxNode): string | undefined {
    // SonarSource C# counts BOTH && and || (unlike SonarJS which only counts &&)
    // See: sonar-dotnet/CSharpCognitiveComplexityMetric.cs VisitBinaryExpression
    const operatorNode = node.children.find((c: SyntaxNode) => c.type === '&&' || c.type === '||');
    return operatorNode?.type;
  }

  isElseIf(node: SyntaxNode): boolean {
    if (node.type === 'else_clause') {
      return node.children.some((c: SyntaxNode) => c.type === 'if_statement');
    }
    // For inferred ELSE (blocks), they don't wrap 'if' in the same way 'else_clause' does.
    // Even if a block contains an IF, it's nesting, not 'else if' structure.
    return false;
  }

  shouldFlattenNesting(parentType: string, nodeType: string, currentFieldName?: string | null): boolean {
    if (parentType === 'if_statement') {
      // Flatten if the child is the 'else' branch (alternative field).
      // Whether it is 'else if' or just 'else', it shouldn't inherit the 'if's nesting.
      if (currentFieldName === 'alternative') {
        return true;
      }
    }
    return false;
  }
}

export function calculateCSharpComplexity(tree: Tree): MethodComplexity[] {
  return calculateGenericComplexity(tree, new CSharpAdapter());
}
