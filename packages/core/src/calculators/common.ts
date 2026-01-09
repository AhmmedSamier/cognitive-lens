// eslint-disable-next-line sonarjs/redundant-type-aliases
export type SyntaxNode = any;
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type Tree = any;
import { MethodComplexity } from '../types';

export type ComplexityNodeType =
  | 'IF'
  | 'SWITCH'
  | 'LOOP'
  | 'CATCH'
  | 'TERNARY'
  | 'BINARY'
  | 'ELSE'
  | 'GOTO';

export interface LanguageAdapter {
  isMethod(node: SyntaxNode): boolean;
  getMethodName(node: SyntaxNode): string;
  isCallback(node: SyntaxNode): boolean;
  getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined;
  getBinaryOperator(node: SyntaxNode): string | undefined;
  isBinaryContinuation(node: SyntaxNode): boolean;
  isElseIf(node: SyntaxNode): boolean;
  shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean;
  lambdaAlwaysNested: boolean;
}

export abstract class BaseLanguageAdapter implements LanguageAdapter {
  abstract isMethod(node: SyntaxNode): boolean;
  abstract getMethodName(node: SyntaxNode): string;
  abstract isCallback(node: SyntaxNode): boolean;
  abstract getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined;
  abstract getBinaryOperator(node: SyntaxNode): string | undefined;
  abstract isElseIf(node: SyntaxNode): boolean;
  abstract shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean;
  lambdaAlwaysNested: boolean = false;

  isBinaryContinuation(node: SyntaxNode): boolean {
    const op = this.getBinaryOperator(node);
    if (!op) return false;

    let left = node.childForFieldName('left');
    while (left && left.type === 'parenthesized_expression') {
      left = left.childForFieldName('expression');
    }

    if (left && left.type === 'binary_expression') {
      const leftOp = this.getBinaryOperator(left);
      if (leftOp === op) {
        return true;
      }
    }
    return false;
  }
}

interface SecondLevelFunction {
  method: MethodComplexity;
  complexityIfNested: number;
  complexityIfTopLevel: number;
}

interface MethodContext {
  method: MethodComplexity;
  depth: number;
  hasStructuralComplexity: boolean;
  secondLevelFunctions: SecondLevelFunction[];
  ownComplexityIfNested: number;
  ownComplexityIfTopLevel: number;
}

class ComplexityCalculator {
  private methods: MethodComplexity[] = [];
  private contextStack: MethodContext[] = [];

  constructor(private adapter: LanguageAdapter) {}

  public calculate(tree: Tree): MethodComplexity[] {
    this.visit(tree.rootNode, 0);
    return this.methods;
  }

  private visit(node: SyntaxNode, currentNesting: number) {
    if (this.adapter.isMethod(node)) {
      this.handleMethodEntry(node, currentNesting);
    } else {
      const nextNesting = this.handleStructuralNode(node, currentNesting);
      this.visitChildren(node, nextNesting);
    }
  }

  private handleMethodEntry(node: SyntaxNode, currentNesting: number) {
    const depth = this.contextStack.length;
    const newMethod: MethodComplexity = {
      name: this.adapter.getMethodName(node),
      score: 0,
      details: [],
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      isCallback: this.adapter.isCallback(node),
      isRoot: depth === 0,
    };

    this.methods.push(newMethod);

    const newContext: MethodContext = {
      method: newMethod,
      depth,
      hasStructuralComplexity: false,
      secondLevelFunctions: [],
      ownComplexityIfNested: 0,
      ownComplexityIfTopLevel: 0,
    };

    this.contextStack.push(newContext);

    const childNesting = this.calculateChildNesting(depth, currentNesting);
    this.visitChildren(node, childNesting);

    this.contextStack.pop();
    this.finalizeMethodComplexity(newMethod, newContext, depth);
  }

  private calculateChildNesting(depth: number, currentNesting: number): number {
    if (this.adapter.lambdaAlwaysNested) {
      return depth >= 1 ? currentNesting + 1 : 0;
    } else {
      return depth >= 2 ? currentNesting + 1 : 0;
    }
  }

  private finalizeMethodComplexity(
    newMethod: MethodComplexity,
    newContext: MethodContext,
    depth: number,
  ) {
    if (depth === 0) {
      this.finalizeTopLevelMethod(newMethod, newContext);
    } else if (depth === 1 && !this.adapter.lambdaAlwaysNested) {
      this.registerSecondLevelFunction(newMethod, newContext);
    } else {
      this.addToParentScore(newMethod);
    }
  }

  private finalizeTopLevelMethod(newMethod: MethodComplexity, newContext: MethodContext) {
    let totalComplexity = newMethod.score;
    for (const secondLevel of newContext.secondLevelFunctions) {
      if (newContext.hasStructuralComplexity) {
        totalComplexity += secondLevel.complexityIfNested;
        secondLevel.method.score = secondLevel.complexityIfNested;
      } else {
        totalComplexity += secondLevel.complexityIfTopLevel;
        secondLevel.method.score = secondLevel.complexityIfTopLevel;
      }
    }
    newMethod.score = totalComplexity;
  }

  private registerSecondLevelFunction(newMethod: MethodComplexity, newContext: MethodContext) {
    const parentContext = this.contextStack[0];
    parentContext.secondLevelFunctions.push({
      method: newMethod,
      complexityIfNested: newContext.ownComplexityIfNested,
      complexityIfTopLevel: newContext.ownComplexityIfTopLevel,
    });
  }

  private addToParentScore(newMethod: MethodComplexity) {
    const parentContext = this.contextStack[this.contextStack.length - 1];
    parentContext.method.score += newMethod.score;
  }

  private handleStructuralNode(node: SyntaxNode, currentNesting: number): number {
    const currentContext = this.contextStack[this.contextStack.length - 1];
    if (!currentContext) return currentNesting;

    const { structural, increasesNesting, label } = this.analyzeNodeComplexity(node);

    if (structural > 0) {
      const score = structural + (increasesNesting ? currentNesting : 0);
      const line = node.startPosition.row;

      if (currentContext.depth === 0) {
        currentContext.hasStructuralComplexity = true;
      }

      this.addScore(
        currentContext,
        score,
        structural,
        increasesNesting,
        currentNesting,
        label,
        line,
      );

      if (increasesNesting) {
        return currentNesting + 1;
      }
    }
    return currentNesting;
  }

  private analyzeNodeComplexity(node: SyntaxNode) {
    const type = this.adapter.getComplexityType(node);
    if (!type) return { structural: 0, increasesNesting: false, label: '' };

    if (type === 'BINARY') {
      return this.analyzeBinary(node);
    }
    if (type === 'ELSE') {
      return this.analyzeElse(node);
    }
    return this.analyzeSimpleStruct(type);
  }

  private analyzeBinary(node: SyntaxNode) {
    const op = this.adapter.getBinaryOperator(node);
    if (op && !this.adapter.isBinaryContinuation(node)) {
      return { structural: 1, increasesNesting: false, label: op };
    }
    return { structural: 0, increasesNesting: false, label: '' };
  }

  private analyzeElse(node: SyntaxNode) {
    if (!this.adapter.isElseIf(node)) {
      return { structural: 1, increasesNesting: true, label: 'else' };
    }
    return { structural: 0, increasesNesting: false, label: '' };
  }

  private analyzeSimpleStruct(type: ComplexityNodeType) {
    switch (type) {
      case 'IF':
        return { structural: 1, increasesNesting: true, label: 'if' };
      case 'SWITCH':
        return { structural: 1, increasesNesting: true, label: 'switch' };
      case 'LOOP':
        return { structural: 1, increasesNesting: true, label: 'loop' };
      case 'CATCH':
        return { structural: 1, increasesNesting: true, label: 'catch' };
      case 'TERNARY':
        return { structural: 1, increasesNesting: true, label: 'ternary' };
      case 'GOTO':
        return { structural: 1, increasesNesting: true, label: 'goto' };
      default:
        return { structural: 0, increasesNesting: false, label: '' };
    }
  }

  private addScore(
    context: MethodContext,
    score: number,
    structural: number,
    increasesNesting: boolean,
    currentNesting: number,
    label: string,
    line: number,
  ) {
    const recordDetails = (target: MethodComplexity) => {
      target.details.push({ line, score: structural, message: label });
      if (increasesNesting && currentNesting > 0) {
        target.details.push({ line, score: currentNesting, message: 'nesting' });
      }
    };

    if (context.depth === 1 && !this.adapter.lambdaAlwaysNested) {
      context.ownComplexityIfTopLevel += structural;
      context.ownComplexityIfNested += structural + (increasesNesting ? currentNesting + 1 : 0);
      recordDetails(context.method);
    } else {
      context.method.score += score;
      recordDetails(context.method);
    }
  }

  private visitChildren(node: SyntaxNode, currentNesting: number) {
    let child = node.firstChild;
    while (child) {
      let nextNesting = currentNesting;
      if (this.contextStack.length > 0 && this.adapter.shouldFlattenNesting(node, child)) {
        nextNesting = Math.max(0, currentNesting - 1);
      }
      this.visit(child, nextNesting);
      child = child.nextSibling;
    }
  }
}

export function calculateGenericComplexity(
  tree: Tree,
  adapter: LanguageAdapter,
): MethodComplexity[] {
  return new ComplexityCalculator(adapter).calculate(tree);
}
