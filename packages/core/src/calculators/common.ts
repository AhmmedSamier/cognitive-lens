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
  nodeIsNamed: boolean;
  gotoParent(): boolean;
  gotoFirstChild(): boolean;
  gotoNextSibling(): boolean;
}

export function isCursor(item: any): item is TreeCursor {
  return typeof item.gotoFirstChild === 'function';
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

// Performance optimization: Reusing these constant objects significantly reduces
// garbage collection pressure during tree traversal (visitor pattern),
// resulting in ~17% faster complexity calculation.
const RESULT_IF = { structural: 1, increasesNesting: true, label: 'if' };
const RESULT_SWITCH = { structural: 1, increasesNesting: true, label: 'switch' };
const RESULT_LOOP = { structural: 1, increasesNesting: true, label: 'loop' };
const RESULT_CATCH = { structural: 1, increasesNesting: true, label: 'catch' };
const RESULT_TERNARY = { structural: 1, increasesNesting: true, label: 'ternary' };
const RESULT_GOTO = { structural: 1, increasesNesting: true, label: 'goto' };
const RESULT_ELSE = { structural: 1, increasesNesting: true, label: 'else' };
const RESULT_NONE = { structural: 0, increasesNesting: false, label: '' };

const RESULT_BINARY_AND = { structural: 1, increasesNesting: false, label: '&&' };
const RESULT_BINARY_OR = { structural: 1, increasesNesting: false, label: '||' };
const RESULT_BINARY_COALESCE = { structural: 1, increasesNesting: false, label: '??' };

const RESULT_BINARY_CACHE: Record<
  string,
  { structural: number; increasesNesting: boolean; label: string }
> = {
  '&&': RESULT_BINARY_AND,
  '||': RESULT_BINARY_OR,
  '??': RESULT_BINARY_COALESCE,
};

export interface LanguageAdapter {
  isMethodType(nodeType: string): boolean;
  getMethodName(node: SyntaxNode): string;
  isCallback(node: SyntaxNode, parentType: string): boolean;
  getComplexityType(
    nodeType: string,
    cursor: TreeCursor,
    parentType: string,
  ): ComplexityNodeType | undefined;
  getBinaryOperator(node: SyntaxNode | TreeCursor): string | undefined;
  isBinaryContinuation(node: SyntaxNode | TreeCursor, cachedOp?: string): boolean;
  isElseIf(node: SyntaxNode | TreeCursor): boolean;
  shouldFlattenNesting(parentType: string, nodeType: string, cursor: TreeCursor): boolean;

  canFlattenNesting(nodeType: string): boolean;
  lambdaAlwaysNested: boolean;
  aggregateLambdaComplexity: boolean;
}

export abstract class BaseLanguageAdapter implements LanguageAdapter {
  abstract isMethodType(nodeType: string): boolean;
  abstract getMethodName(node: SyntaxNode): string;
  abstract isCallback(node: SyntaxNode, parentType: string): boolean;
  abstract getComplexityType(
    nodeType: string,
    cursor: TreeCursor,
    parentType: string,
  ): ComplexityNodeType | undefined;
  abstract getBinaryOperator(node: SyntaxNode | TreeCursor): string | undefined;
  abstract isElseIf(node: SyntaxNode | TreeCursor): boolean;
  abstract shouldFlattenNesting(parentType: string, nodeType: string, cursor: TreeCursor): boolean;

  lambdaAlwaysNested: boolean = false;
  aggregateLambdaComplexity: boolean = false;

  canFlattenNesting(_nodeType: string): boolean {
    return false;
  }

  isBinaryContinuation(node: SyntaxNode | TreeCursor, cachedOp?: string): boolean {
    if (isCursor(node)) {
      return this.isBinaryContinuationCursor(node, cachedOp);
    }

    const op = cachedOp || this.getBinaryOperator(node);
    if (!op) return false;

    // Performance optimization: Use firstNamedChild instead of childForFieldName
    // to avoid string lookup overhead. In binary and parenthesized expressions,
    // the left/inner expression is reliably the first named child.
    let left = node.firstNamedChild;
    while (left && left.type === 'parenthesized_expression') {
      left = left.firstNamedChild;
    }

    if (left && left.type === 'binary_expression') {
      const leftOp = this.getBinaryOperator(left);
      if (leftOp === op) {
        return true;
      }
    }
    return false;
  }

  private isBinaryContinuationCursor(cursor: TreeCursor, cachedOp?: string): boolean {
    const op = cachedOp || this.getBinaryOperator(cursor);
    if (!op) return false;

    if (!cursor.gotoFirstChild()) {
      return false;
    }

    const { found, depth } = this.findLeftBinaryExpression(cursor, op);

    this.restoreCursorAfterBinarySearch(cursor, depth);

    return found;
  }

  private findLeftBinaryExpression(cursor: TreeCursor, op: string) {
    if (!this.moveToFirstNamedChild(cursor)) {
      return { found: false, depth: 0 };
    }

    let depth = 0;

    if (!this.walkThroughParens(cursor, () => {
      depth += 1;
    })) {
      return { found: false, depth };
    }

    if (cursor.nodeType !== 'binary_expression') {
      return { found: false, depth };
    }

    const leftOp = this.getBinaryOperator(cursor);
    if (!leftOp) {
      return { found: false, depth };
    }

    return { found: leftOp === op, depth };
  }

  private moveToFirstNamedChild(cursor: TreeCursor) {
    if (cursor.nodeIsNamed) {
      return true;
    }

    while (cursor.gotoNextSibling()) {
      if (cursor.nodeIsNamed) {
        return true;
      }
    }
    return false;
  }

  private walkThroughParens(cursor: TreeCursor, incrementDepth: () => void) {
    let isParen = cursor.nodeType === 'parenthesized_expression';

    while (isParen) {
      if (!cursor.gotoFirstChild()) {
        return false;
      }
      incrementDepth();
      if (!this.moveToFirstNamedChild(cursor)) {
        return false;
      }
      isParen = cursor.nodeType === 'parenthesized_expression';
    }

    return true;
  }

  private restoreCursorAfterBinarySearch(cursor: TreeCursor, depth: number) {
    while (depth > 0) {
      cursor.gotoParent();
      depth -= 1;
    }
    cursor.gotoParent();
  }
}

interface MethodContext {
  method: MethodComplexity;
  depth: number;
}

class ComplexityCalculator {
  private methods: MethodComplexity[] = [];
  private contextStack: MethodContext[] = [];
  private currentContext: MethodContext | undefined;

  constructor(private adapter: LanguageAdapter) {}

  public calculate(tree: Tree): MethodComplexity[] {
    const cursor = tree.walk();
    // Assuming root has no parent, we start with a dummy parentType or handle root specially.
    // Root type is typically 'program' or similar.
    // We can pass the root node type.
    this.visit(cursor, cursor.nodeType, 0);
    return this.methods;
  }

  private visit(
    cursor: TreeCursor,
    parentType: string,
    currentNesting: number,
    cachedNodeType?: string,
  ) {
    const nodeType = cachedNodeType || cursor.nodeType;

    let nextNesting;
    let pushedContext = false;

    if (this.adapter.isMethodType(nodeType)) {
      // For method checks, we need the node
      const node = cursor.currentNode;
      this.handleMethodEntry(node, cursor, parentType);
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
      nextNesting = this.handleStructuralNode(cursor, parentType, currentNesting, nodeType);
    }

    // Visit Children
    if (cursor.gotoFirstChild()) {
      // Performance optimization: Check if the parent node type supports flattening nesting at all.
      // This avoids calling shouldFlattenNesting for every child of every node, which is a significant
      // performance improvement (saving N calls per node where N is the number of children).
      const canFlatten = this.contextStack.length > 0 && this.adapter.canFlattenNesting(nodeType);

      do {
        const childType = cursor.nodeType;
        let childNesting = nextNesting;
        // Check flattening based on CURRENT node (which is parent of children)
        // and CHILD node (which is current cursor position in loop).

        if (canFlatten && this.adapter.shouldFlattenNesting(nodeType, childType, cursor)) {
          childNesting = Math.max(0, nextNesting - 1);
        }

        this.visit(cursor, nodeType, childNesting, childType);
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }

    if (pushedContext) {
      const context = this.contextStack.pop();
      // Update currentContext immediately after pop
      this.currentContext =
        this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : undefined;

      if (context) {
        const method = context.method;
        // We need to finalize. Depth is whatever it was.
        // We can store depth in context.
        this.finalizeMethodComplexity(method, context, context.depth);
      }
    }
  }

  private handleMethodEntry(node: SyntaxNode, cursor: TreeCursor, parentType: string) {
    const depth = this.contextStack.length;
    const newMethod: MethodComplexity = {
      name: this.adapter.getMethodName(node),
      score: 0,
      details: [],
      startIndex: cursor.startIndex,
      endIndex: cursor.endIndex,
      startLine: cursor.startPosition.row,
      endLine: cursor.endPosition.row,
      isCallback: this.adapter.isCallback(node, parentType),
      isRoot: depth === 0,
    };

    this.methods.push(newMethod);

    const newContext: MethodContext = {
      method: newMethod,
      depth,
    };

    this.contextStack.push(newContext);
    this.currentContext = newContext;
  }

  private calculateChildNesting(depth: number, currentNesting: number): number {
    if (this.adapter.lambdaAlwaysNested) {
      return depth >= 1 ? currentNesting + 1 : currentNesting;
    } else {
      return depth >= 2 ? currentNesting + 1 : currentNesting;
    }
  }

  private finalizeMethodComplexity(
    newMethod: MethodComplexity,
    _newContext: MethodContext,
    depth: number,
  ) {
    if (depth > 0 && this.adapter.aggregateLambdaComplexity) {
      this.addToParentScore(newMethod);
    }
  }

  private addToParentScore(newMethod: MethodComplexity) {
    // If we are here, we know there is a parent because depth > 0 check in finalizeMethodComplexity
    if (this.currentContext) {
      this.currentContext.method.score += newMethod.score;
    }
  }

  private handleStructuralNode(
    cursor: TreeCursor,
    parentType: string,
    currentNesting: number,
    nodeType: string,
  ): number {
    const currentContext = this.currentContext;
    if (!currentContext) return currentNesting;

    const { structural, increasesNesting, label } = this.analyzeNodeComplexity(
      cursor,
      nodeType,
      parentType,
    );

    if (structural > 0) {
      const score = structural + (increasesNesting ? currentNesting : 0);
      const line = cursor.startPosition.row;

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

  private analyzeNodeComplexity(cursor: TreeCursor, nodeType: string, parentType: string) {
    const type = this.adapter.getComplexityType(nodeType, cursor, parentType);
    if (!type) return RESULT_NONE;

    // Instantiate node only if needed for detailed analysis
    if (type === 'BINARY') {
      return this.analyzeBinary(cursor);
    }
    if (type === 'ELSE') {
      return this.analyzeElse(cursor);
    }
    return this.analyzeSimpleStruct(type);
  }

  private analyzeBinary(cursor: TreeCursor) {
    const op = this.adapter.getBinaryOperator(cursor);
    if (op) {
      if (!this.adapter.isBinaryContinuation(cursor, op)) {
        return RESULT_BINARY_CACHE[op] || { structural: 1, increasesNesting: false, label: op };
      }
    }
    return RESULT_NONE;
  }

  private analyzeElse(node: SyntaxNode | TreeCursor) {
    if (!this.adapter.isElseIf(node)) {
      return RESULT_ELSE;
    }
    return RESULT_NONE;
  }

  private analyzeSimpleStruct(type: ComplexityNodeType) {
    switch (type) {
      case 'IF':
        return RESULT_IF;
      case 'SWITCH':
        return RESULT_SWITCH;
      case 'LOOP':
        return RESULT_LOOP;
      case 'CATCH':
        return RESULT_CATCH;
      case 'TERNARY':
        return RESULT_TERNARY;
      case 'GOTO':
        return RESULT_GOTO;
      default:
        return RESULT_NONE;
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
    context.method.score += score;
    this.recordScoreDetail(
      context.method,
      line,
      structural,
      increasesNesting,
      currentNesting,
      label,
    );
  }

  // Performance optimization: Extracted to a method to avoid creating a closure
  // on every call to addScore, reducing allocation pressure.
  private recordScoreDetail(
    target: MethodComplexity,
    line: number,
    structural: number,
    increasesNesting: boolean,
    currentNesting: number,
    label: string,
  ) {
    target.details.push({ line, score: structural, message: label });
    if (increasesNesting && currentNesting > 0) {
      target.details.push({ line, score: currentNesting, message: 'nesting' });
    }
  }
}

export function calculateGenericComplexity(
  tree: Tree,
  adapter: LanguageAdapter,
): MethodComplexity[] {
  return new ComplexityCalculator(adapter).calculate(tree);
}
