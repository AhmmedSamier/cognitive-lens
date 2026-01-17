// eslint-disable-next-line sonarjs/redundant-type-aliases
export type SyntaxNode = any;
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type Tree = any;

export interface TreeCursor {
  nodeType: string;
  currentFieldName: string | null;
  currentNode: SyntaxNode;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  gotoParent(): boolean;
  gotoFirstChild(): boolean;
  gotoNextSibling(): boolean;
}

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
  isMethodType(nodeType: string): boolean;
  getMethodName(node: SyntaxNode): string;
  isCallback(node: SyntaxNode): boolean;
  getComplexityType(nodeType: string, currentFieldName?: string | null): ComplexityNodeType | undefined;
  getBinaryOperator(node: SyntaxNode): string | undefined;
  isBinaryContinuation(node: SyntaxNode): boolean;
  isElseIf(node: SyntaxNode): boolean;
  shouldFlattenNesting(parentType: string, nodeType: string, currentFieldName?: string | null): boolean;
  lambdaAlwaysNested: boolean;
}

export abstract class BaseLanguageAdapter implements LanguageAdapter {
  abstract isMethodType(nodeType: string): boolean;
  abstract getMethodName(node: SyntaxNode): string;
  abstract isCallback(node: SyntaxNode): boolean;
  abstract getComplexityType(nodeType: string, currentFieldName?: string | null): ComplexityNodeType | undefined;
  abstract getBinaryOperator(node: SyntaxNode): string | undefined;
  abstract isElseIf(node: SyntaxNode): boolean;
  abstract shouldFlattenNesting(parentType: string, nodeType: string, currentFieldName?: string | null): boolean;
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
    const cursor = tree.walk();
    // Assuming root has no parent, we start with a dummy parentType or handle root specially.
    // Root type is typically 'program' or similar.
    // We can pass the root node type.
    this.visit(cursor, cursor.nodeType, 0);
    return this.methods;
  }

  private visit(cursor: TreeCursor, parentType: string, currentNesting: number) {
    const nodeType = cursor.nodeType;
    const fieldName = cursor.currentFieldName;

    let nextNesting = currentNesting;
    let pushedContext = false;

    if (this.adapter.isMethodType(nodeType)) {
      // For method checks, we need the node
      const node = cursor.currentNode;
      this.handleMethodEntry(node, cursor, parentType, currentNesting);
      // handleMethodEntry pushes context and calls visitChildren logic internally?
      // No, we should avoid recursion in handleMethodEntry if we want to stick to cursor logic.
      // But we are using recursive visit(cursor).
      // So handleMethodEntry should just set up the state.
      pushedContext = true;

      // Calculate child nesting for the NEW context
      // The context was pushed in handleMethodEntry.
      // We need to determine the nesting for children of this method.
      const depth = this.contextStack.length - 1; // 0-based
      nextNesting = this.calculateChildNesting(depth, currentNesting);

    } else {
      nextNesting = this.handleStructuralNode(cursor, parentType, currentNesting);
    }

    // Visit Children
    if (cursor.gotoFirstChild()) {
      do {
        let childNesting = nextNesting;
        // Check flattening based on CURRENT node (which is parent of children)
        // and CHILD node (which is current cursor position in loop).
        // Wait, 'parentType' argument to visit is the type of the node that CALLED visit.
        // So 'nodeType' here is the parent of the children we are about to visit.

        if (this.contextStack.length > 0 && this.adapter.shouldFlattenNesting(nodeType, cursor.nodeType, cursor.currentFieldName)) {
           childNesting = Math.max(0, nextNesting - 1);
        }

        this.visit(cursor, nodeType, childNesting);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }

    if (pushedContext) {
        const context = this.contextStack.pop();
        if (context) {
             const method = context.method;
             // We need to finalize. Depth is whatever it was.
             // We can store depth in context.
             this.finalizeMethodComplexity(method, context, context.depth);
        }
    }
  }

  private handleMethodEntry(node: SyntaxNode, cursor: TreeCursor, parentType: string, currentNesting: number) {
    const depth = this.contextStack.length;
    const newMethod: MethodComplexity = {
      name: this.adapter.getMethodName(node),
      score: 0,
      details: [],
      startIndex: cursor.startIndex,
      endIndex: cursor.endIndex,
      startLine: cursor.startPosition.row,
      endLine: cursor.endPosition.row,
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

  private handleStructuralNode(cursor: TreeCursor, parentType: string, currentNesting: number): number {
    const currentContext = this.contextStack[this.contextStack.length - 1];
    if (!currentContext) return currentNesting;

    const { structural, increasesNesting, label } = this.analyzeNodeComplexity(cursor);

    if (structural > 0) {
      const score = structural + (increasesNesting ? currentNesting : 0);
      const line = cursor.startPosition.row;

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

  private analyzeNodeComplexity(cursor: TreeCursor) {
    const type = this.adapter.getComplexityType(cursor.nodeType, cursor.currentFieldName);
    if (!type) return { structural: 0, increasesNesting: false, label: '' };

    // Instantiate node only if needed for detailed analysis
    if (type === 'BINARY') {
      return this.analyzeBinary(cursor.currentNode);
    }
    if (type === 'ELSE') {
      return this.analyzeElse(cursor.currentNode);
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
}

export function calculateGenericComplexity(
  tree: Tree,
  adapter: LanguageAdapter,
): MethodComplexity[] {
  return new ComplexityCalculator(adapter).calculate(tree);
}
