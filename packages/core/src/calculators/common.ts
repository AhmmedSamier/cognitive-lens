import { Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity, ComplexityDetail } from '../types';

export type ComplexityNodeType =
    | 'IF'
    | 'SWITCH'
    | 'LOOP'
    | 'CATCH'
    | 'TERNARY'
    | 'BINARY'
    | 'ELSE';

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
}

export function calculateGenericComplexity(tree: Tree, adapter: LanguageAdapter): MethodComplexity[] {
    const methods: MethodComplexity[] = [];
    // Stack of ancestors (methods) that are currently being visited.
    const methodStack: MethodComplexity[] = [];

    function visit(node: SyntaxNode, currentMethod: MethodComplexity | undefined, currentNesting: number) {
        let activeMethod = currentMethod;
        let activeNesting = currentNesting;

        // 1. Check if we are entering a new method definition
        if (adapter.isMethod(node)) {
            const name = adapter.getMethodName(node);
            const isCallback = adapter.isCallback(node);

            const newMethod: MethodComplexity = {
                name,
                score: 0,
                details: [],
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                isCallback
            };

            methods.push(newMethod);
            methodStack.push(newMethod);

            // Switch context:
            // - activeMethod becomes the new method
            // - activeNesting resets to 0
            activeMethod = newMethod;
            activeNesting = 0;

            // Note: We do NOT process the method node itself as a complexity contributor (e.g. IF/ELSE logic)
            // for the parent method, nor for the new method.
            // But we must process its children.
        }
        else if (activeMethod) {
            // 2. We are inside a method, check if this node contributes to complexity
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
                        increasesNesting = false;
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
                }
            }

            if (structural > 0) {
                const score = structural + (increasesNesting ? activeNesting : 0);

                // Add score to the immediate method
                activeMethod.score += score;
                const line = node.startPosition.row;
                activeMethod.details.push({ line, score: structural, message: label }); // Detail usually just shows structural
                if (increasesNesting && activeNesting > 0) {
                    activeMethod.details.push({ line, score: activeNesting, message: 'nesting' });
                }

                // Add score to all *other* ancestors in the stack (propagate complexity)
                // Note: The top of the stack is activeMethod, which we just updated.
                for (let i = 0; i < methodStack.length - 1; i++) {
                     methodStack[i].score += score;
                }
            }

            // Update nesting for children
            if (increasesNesting) {
                activeNesting++;
            }
        }

        // 3. Recurse into children
        let child = node.firstChild;
        while (child) {
            let nextNesting = activeNesting;

            // Handle flattening (e.g. IF -> ELSE IF)
            // Note: This logic applies within the context of the *current* method (activeMethod).
            // If we just entered a new method, flattening logic between ParentNode and ChildNode
            // might not apply if ParentNode was outside the method?
            // Actually, `shouldFlattenNesting` takes parent and child.
            // If `node` is the method definition, and `child` is the first statement...
            // `shouldFlattenNesting` usually checks structural nodes (IF, ELSE).
            // A method definition is not usually involved in flattening logic.

            if (activeMethod && adapter.shouldFlattenNesting(node, child)) {
                // If flattening, revert to the nesting level *before* the increment
                // The `activeNesting` was potentially incremented above.
                // We need the `currentNesting` passed to this function?
                // No, `activeNesting` is the nesting level *inside* `node`.
                // If `node` was IF, `activeNesting` is `currentNesting + 1`.
                // If we flatten, we want `currentNesting`.

                // Wait, let's trace:
                // visit(IF, nest=0) -> structural=1, increases=true -> activeNesting becomes 1.
                // child is ELSE_CLAUSE.
                // shouldFlatten(IF, ELSE) -> true.
                // nextNesting = currentNesting (0).

                // But `activeNesting` variable is modified.
                // We need to be careful. `activeNesting` represents the nesting for children generally.
                // But for *specific* children we might override.

                // We should reconstruct `activeNesting` from `currentNesting` logic to be safe?
                // Or just use `currentNesting` if flatten is true.

                // If `node` was a method definition, `currentNesting` was the *parent's* nesting.
                // `activeNesting` became 0.
                // We should not use `currentNesting` (parent's) for flattening inside the method.
                // But `shouldFlattenNesting` won't be true for MethodDef -> Child.

                // So: if we flattened, we want `activeNesting - 1` (assuming it increased)?
                // Or simply `currentNesting` (if we are in the same method context).

                // If `activeMethod === currentMethod` (we didn't switch context),
                // then `activeNesting` is `currentNesting + (increasesNesting ? 1 : 0)`.
                // If we flatten, we want `currentNesting`.

                // What if we switched context?
                // `activeMethod != currentMethod`. `activeNesting` = 0.
                // `node` is MethodDef. `increasesNesting` = false (MethodDef is not structural).
                // `activeNesting` = 0.
                // `flatten` is false.

                // So this only applies when `activeMethod === currentMethod`.

                if (activeMethod === currentMethod) {
                     nextNesting = currentNesting;
                }
            }

            visit(child, activeMethod, nextNesting);
            child = child.nextSibling;
        }

        // 4. Cleanup
        if (adapter.isMethod(node)) {
            methodStack.pop();
        }
    }

    visit(tree.rootNode, undefined, 0);

    return methods;
}
