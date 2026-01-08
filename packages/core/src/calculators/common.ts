import { SyntaxNode, Tree } from 'web-tree-sitter';
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

  // Returns the complexity type of the node. undefined if it doesn't contribute.
  getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined;

  // Used for BINARY nodes to determine the operator label (e.g. "&&")
  getBinaryOperator(node: SyntaxNode): string | undefined;

  // Checks if this node is a continuation of a binary sequence (e.g. a && b && c)
  // If true, it receives no score.
  isBinaryContinuation(node: SyntaxNode): boolean;

  // Checks if this node is an 'else if' style clause that shouldn't receive the ELSE penalty
  // (Usually handled by checking if it contains an IF child)
  isElseIf(node: SyntaxNode): boolean;

  // Checks if the nesting should be flattened for a specific child
  // (e.g. parent is IF, child is ELSE IF -> don't increase nesting for the child)
  shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean;

  // If true, lambdas/callbacks ALWAYS increase nesting (SonarSource C# behavior).
  // If false, uses second-level function handling (SonarJS behavior).
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

  // Default: SonarJS behavior (second-level function handling)
  // Override to true for C# behavior (lambdas always nest)
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

/**
 * Internal tracking for second-level functions (SonarJS behavior)
 */
interface SecondLevelFunction {
  method: MethodComplexity;
  // Complexity if this function is treated as nested (+1 nesting from parent)
  complexityIfNested: number;
  // Complexity if this function is treated as top-level (no nesting penalty)
  complexityIfTopLevel: number;
}

/**
 * Calculates cognitive complexity using SonarJS-compatible algorithm.
 *
 * Key SonarJS behavior implemented:
 * - If a top-level function has NO structural complexity in its own body,
 *   second-level functions (callbacks) are treated as independent top-level functions.
 * - This means their internal complexity doesn't include nesting from the parent.
 */
export function calculateGenericComplexity(
  tree: Tree,
  adapter: LanguageAdapter,
): MethodComplexity[] {
  const methods: MethodComplexity[] = [];

  // Stack of method contexts
  interface MethodContext {
    method: MethodComplexity;
    depth: number; // 0 = top-level, 1 = second-level, 2+ = deeper
    hasStructuralComplexity: boolean; // For top-level: does it have structural nodes in its own body?
    secondLevelFunctions: SecondLevelFunction[]; // Only used for top-level
    // For second-level functions: track complexity both ways
    ownComplexityIfNested: number;
    ownComplexityIfTopLevel: number;
  }

  const contextStack: MethodContext[] = [];

  function visit(node: SyntaxNode, currentNesting: number) {
    // 1. Check if we are entering a new method definition
    if (adapter.isMethod(node)) {
      const name = adapter.getMethodName(node);
      const isCallback = adapter.isCallback(node);
      const depth = contextStack.length;

      const newMethod: MethodComplexity = {
        name,
        score: 0,
        details: [],
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        isCallback,
        isRoot: depth === 0,
      };

      methods.push(newMethod);

      const newContext: MethodContext = {
        method: newMethod,
        depth,
        hasStructuralComplexity: false,
        secondLevelFunctions: [],
        ownComplexityIfNested: 0,
        ownComplexityIfTopLevel: 0,
      };

      contextStack.push(newContext);

      // Determine nesting for children:
      // - Root method (depth 0): nesting starts at 0
      // - For lambdaAlwaysNested=true (C#): all nested functions inherit nesting + 1
      // - For lambdaAlwaysNested=false (JS): second-level uses special handling
      let childNesting = 0;
      if (adapter.lambdaAlwaysNested) {
        // C# behavior: lambdas always add nesting
        if (depth >= 1) {
          childNesting = currentNesting + 1;
        }
      } else {
        // JS behavior: only depth 2+ inherits nesting
        if (depth >= 2) {
          childNesting = currentNesting + 1;
        }
      }

      // Visit children
      let child = node.firstChild;
      while (child) {
        visit(child, childNesting);
        child = child.nextSibling;
      }

      // Leaving this function
      contextStack.pop();

      if (depth === 0) {
        // Top-level function: finalize second-level function complexity
        let totalComplexity = newMethod.score; // Own direct complexity

        for (const secondLevel of newContext.secondLevelFunctions) {
          if (newContext.hasStructuralComplexity) {
            // Parent has structure, so callbacks count as nested
            totalComplexity += secondLevel.complexityIfNested;
            secondLevel.method.score = secondLevel.complexityIfNested;
          } else {
            // Parent has no structure, so callbacks count as independent
            totalComplexity += secondLevel.complexityIfTopLevel;
            secondLevel.method.score = secondLevel.complexityIfTopLevel;
          }
        }

        newMethod.score = totalComplexity;
      } else if (depth === 1 && !adapter.lambdaAlwaysNested) {
        // Second-level function (SonarJS behavior): register with parent
        const parentContext = contextStack[0]; // Top-level is always at index 0
        parentContext.secondLevelFunctions.push({
          method: newMethod,
          complexityIfNested: newContext.ownComplexityIfNested,
          complexityIfTopLevel: newContext.ownComplexityIfTopLevel,
        });
        // Don't add to parent score yet - will be decided when top-level exits
      } else {
        // Deeper nested OR lambdaAlwaysNested: add to parent's score directly
        const parentContext = contextStack[contextStack.length - 1];
        parentContext.method.score += newMethod.score;
      }

      return; // Don't process further, we handled children above
    }

    // 2. Check if this node contributes to complexity
    const currentContext = contextStack[contextStack.length - 1];
    if (currentContext) {
      let structural = 0;
      let increasesNesting = false;
      let label = '';

      const type = adapter.getComplexityType(node);

      if (type) {
        switch (type) {
          case 'IF':
            label = 'if';
            structural = 1;
            increasesNesting = true;
            break;
          case 'SWITCH':
            label = 'switch';
            structural = 1;
            increasesNesting = true;
            break;
          case 'LOOP':
            label = 'loop';
            structural = 1;
            increasesNesting = true;
            break;
          case 'CATCH':
            label = 'catch';
            structural = 1;
            increasesNesting = true;
            break;
          case 'TERNARY':
            label = 'ternary';
            structural = 1;
            increasesNesting = true;
            break;
          case 'ELSE':
            if (!adapter.isElseIf(node)) {
              label = 'else';
              structural = 1;
              increasesNesting = true;
            } else {
              structural = 0;
              increasesNesting = false;
            }
            break;
          case 'BINARY':
            const op = adapter.getBinaryOperator(node);
            if (op && !adapter.isBinaryContinuation(node)) {
              label = op;
              structural = 1;
              increasesNesting = false;
            }
            break;
          case 'GOTO':
            label = 'goto';
            structural = 1;
            increasesNesting = true; // SonarSource C#: goto adds nesting penalty
            break;
        }
      }

      if (structural > 0) {
        const score = structural + (increasesNesting ? currentNesting : 0);
        const line = node.startPosition.row;

        // Mark that this level has structural complexity
        if (currentContext.depth === 0) {
          currentContext.hasStructuralComplexity = true;
        }

        // Add score based on depth
        if (currentContext.depth === 0) {
          // Top-level: add directly to own score
          currentContext.method.score += score;
          currentContext.method.details.push({ line, score: structural, message: label });
          if (increasesNesting && currentNesting > 0) {
            currentContext.method.details.push({ line, score: currentNesting, message: 'nesting' });
          }
        } else if (currentContext.depth === 1 && !adapter.lambdaAlwaysNested) {
          // Second-level (SonarJS): track both ways for later decision
          const scoreIfTopLevel = structural; // No nesting penalty
          const scoreIfNested = structural + (increasesNesting ? currentNesting + 1 : 0); // +1 for being in callback

          currentContext.ownComplexityIfTopLevel += scoreIfTopLevel;
          currentContext.ownComplexityIfNested += scoreIfNested;

          // Temporarily store in method for detail tracking
          currentContext.method.details.push({ line, score: structural, message: label });
          if (increasesNesting && currentNesting > 0) {
            currentContext.method.details.push({ line, score: currentNesting, message: 'nesting' });
          }
        } else {
          // Deeper OR lambdaAlwaysNested (C#): add score with full nesting
          currentContext.method.score += score;
          currentContext.method.details.push({ line, score: structural, message: label });
          if (increasesNesting && currentNesting > 0) {
            currentContext.method.details.push({ line, score: currentNesting, message: 'nesting' });
          }
        }

        // Update nesting for children
        if (increasesNesting) {
          currentNesting++;
        }
      }
    }

    // 3. Recurse into children
    let child = node.firstChild;
    while (child) {
      let nextNesting = currentNesting;

      // Handle flattening (e.g. IF -> ELSE IF)
      if (currentContext && adapter.shouldFlattenNesting(node, child)) {
        // For else-if chains, don't increase nesting
        nextNesting = Math.max(0, currentNesting - 1);
      }

      visit(child, nextNesting);
      child = child.nextSibling;
    }
  }

  visit(tree.rootNode, 0);

  return methods;
}
