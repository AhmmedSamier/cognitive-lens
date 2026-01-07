import { Tree, SyntaxNode } from 'web-tree-sitter';
import { MethodComplexity } from '../types';
import { calculateGenericComplexity, BaseLanguageAdapter, ComplexityNodeType } from './common';

class DartAdapter extends BaseLanguageAdapter {
    isMethod(node: SyntaxNode): boolean {
        // Based on debug output, it seems tree-sitter-dart doesn't wrap method declaration in a single node?
        // Wait, 'method_signature' and 'function_body' are siblings inside 'class_body'.
        // They are NOT children of 'method_declaration'.
        // This is very strange for a tree-sitter grammar. Usually they group them.
        // It implies the grammar is flat.

        // However, looking at the previous 'program' example:
        // program -> function_signature, function_body

        // This means we don't have a single node representing the "Function".
        // This breaks the `isMethod` logic because `visit` iterates nodes.
        // If I say `function_signature` is the method, the complexity (in `function_body`) is a sibling, not a child.
        // `visit` only recurses into children.

        // So, if `function_body` is a sibling, visiting `function_signature` won't visit the body.
        // And visiting `function_body` directly?
        // If I mark `function_body` as the method, then its children (the code) are processed.
        // But `function_body` doesn't have the name. The name is in `function_signature` (sibling).

        // So, if I use `function_body` as the method node:
        // 1. `isMethod` returns true for `function_body`.
        // 2. `getMethodName` needs to look at `node.previousSibling`.

        // Let's verify if `function_body` is unique to methods/functions.
        return node.type === 'function_body';
    }

    getMethodName(node: SyntaxNode): string {
        // The name is in the signature, which is likely the previous sibling.
        // Note: There might be comments or whitespace nodes? web-tree-sitter usually skips them in named children traversal?
        // But `previousSibling` gives named node if `named: true`? No, it gives any node.
        // Actually, `previousNamedSibling` is safer.

        const sig = node.previousNamedSibling;
        if (sig) {
            if (sig.type === 'function_signature' || sig.type === 'method_signature') {
                // function_signature -> identifier
                // method_signature -> function_signature -> identifier

                // Let's recurse to find identifier?
                // Or use childForFieldName if applicable?
                // The debug output:
                // method_signature
                //   function_signature
                //     identifier

                // top level:
                // function_signature
                //   identifier

                let nameNode = sig.childForFieldName('name'); // often 'name' field
                if (!nameNode) {
                    // Try to find identifier manually
                    // In `function_signature` -> `identifier` is usually the name.
                    // But it might be wrapped.

                    // debug output:
                    // function_signature [1:8-1:21]
                    //   void_type [1:8-1:12]
                    //   identifier [1:13-1:19]

                    // so it is a direct child of function_signature.
                    // If sig is method_signature, it has a child function_signature?

                    let targetSig = sig;
                    if (targetSig.type === 'method_signature') {
                        const inner = targetSig.children.find(c => c.type === 'function_signature');
                        if (inner) targetSig = inner;
                    }

                    // In function_signature
                    const id = targetSig.children.find(c => c.type === 'identifier');
                    if (id) return id.text;
                } else {
                    return nameNode.text;
                }
            } else if (sig.type === 'constructor_signature') {
                 // handle constructor
                 // constructor_signature -> identifier (class name) . identifier (name)?
                 return 'constructor';
            } else if (sig.type === 'getter_signature' || sig.type === 'setter_signature') {
                 const id = sig.children.find(c => c.type === 'identifier');
                 if (id) return id.text;
            }
        }
        return 'anonymous';
    }

    isCallback(node: SyntaxNode): boolean {
        // If the method is `function_body` (and implied signature),
        // we need to check if this structure is inside an argument.
        // `function_expression` usually wraps signature/body for lambdas?
        // Let's check lambda syntax in Dart: `() => expr` or `() { stmt }`

        // If it's `function_expression`, it might be the parent of `function_body`.
        // If so, `isMethod` might trigger on `function_body` inside `function_expression`.

        // Let's assume standard named functions for now.
        // Callbacks often appear as arguments.
        // `node` is `function_body`. Parent is `function_expression`?

        // If `function_body` parent is `function_expression`, and `function_expression` parent is `argument`, then yes.
        let p = node.parent;
        if (p && p.type === 'function_expression') {
            p = p.parent;
        }
        return !!(p && (p.type === 'argument' || p.type === 'named_argument'));
    }

    getComplexityType(node: SyntaxNode): ComplexityNodeType | undefined {
        switch (node.type) {
            case 'if_statement': return 'IF';
            case 'switch_statement': return 'SWITCH';
            case 'for_statement':
            case 'while_statement':
            case 'do_statement': return 'LOOP';
            case 'catch_clause':
            case 'on_part': return 'CATCH';
            case 'conditional_expression': return 'TERNARY';
            case 'binary_expression':
            case 'logical_and_expression':
            case 'logical_or_expression':
            case 'if_null_expression': return 'BINARY';
            case 'else_clause': return 'ELSE';
            case 'else': return 'ELSE';
            case 'if_element': return 'IF';
            case 'for_element': return 'LOOP';
            default:
                return undefined;
        }
    }

    getBinaryOperator(node: SyntaxNode): string | undefined {
        // logical_and_expression has child 'logical_and_operator' -> '&&'
        // logical_or_expression has child 'logical_or_operator' -> '||'
        // if_null_expression has child '??' directly?

        if (node.type === 'if_null_expression') {
            return '??';
        }

        // Check for operator nodes
        const opNode = node.children.find(c =>
            c.type === 'logical_and_operator' ||
            c.type === 'logical_or_operator' ||
            c.type === '??'
        );

        if (opNode) {
            // If it is an operator wrapper, get the text
            return opNode.text;
        }

        // Sometimes binary_expression has direct operator children
        const directOp = node.children.find(c => ['&&', '||', '??'].includes(c.type));
        return directOp?.type;
    }

    isElseIf(node: SyntaxNode): boolean {
        if (node.type === 'else') { // Dart might output 'else' as node type if it's not wrapped?
             // Debug needed.
             // But standard tree-sitter-dart uses 'else_clause'.
        }

        // In the debug output:
        // else [4:14-4:18]
        // if_statement [4:19-8:13]
        //
        // Wait, they are SIBLINGS in the debug output!
        // if_statement
        // ...
        // else
        // if_statement (this is the else-if)

        // If they are siblings, then 'else' is just a keyword node?
        // Let's look at the debug output again.

        // if_statement [2:12-8:13]
        //   if
        //   (...)
        //   block
        //   else
        //   if_statement (the else-if part)

        // So the parent 'if_statement' contains 'else' and the 'if_statement' (else-if).
        // It does NOT have an 'else_clause' wrapper node for the 'else-if'.

        // But for the final else:
        // else
        // block

        // So `else_clause` node type might NOT EXIST in this version of tree-sitter-dart.
        // Instead, `if_statement` has an `else` child which is just the keyword, followed by the alternative block or if_statement.

        // This complicates things because `getComplexityType` returns 'ELSE' for `else_clause`.
        // If there is no `else_clause`, we need to detect the `else` keyword?
        // But `else` keyword is just syntax.

        // However, the `if_statement` node itself has the structure.
        // `if_statement` -> `if` `(` `cond` `)` `consequent` `else` `alternative`.

        // We visit `if_statement`. It counts as IF.
        // Then we visit children.
        // Children: `if`, `(`, `cond`, `)`, `consequent` (block), `else`, `alternative` (block or if_statement).

        // If `alternative` is `block`, it represents the ELSE branch.
        // If `alternative` is `if_statement`, it is an ELSE IF.

        // We need to count complexity for the ELSE branch.
        // Usually, `visit` checks if `node` type contributes.
        // If `else` is just a keyword, it doesn't contribute (unless we map `else` token to ELSE type).

        // Or, we check if `node` is `else` keyword? No, usually we check the wrapper.
        // If there is no wrapper, we might need to handle it in the parent `if_statement` or map the `else` keyword to 'ELSE'.

        // Let's try mapping the `else` node type to 'ELSE'.
        // In the debug output: `else [4:14-4:18]`. The type is 'else'.

        if (node.type === 'else_clause') {
             return node.children.some(c => c.type === 'if_statement');
        }

        // If we map 'else' keyword to complexity type ELSE:
        // We need to know if it is followed by 'if_statement'.
        // The `else` node is a leaf (keyword). We can check its sibling.

        if (node.type === 'else') {
            const next = node.nextNamedSibling;
            if (next && next.type === 'if_statement') {
                return true;
            }
        }

        return false;
    }

    shouldFlattenNesting(parent: SyntaxNode, child: SyntaxNode): boolean {
        // If we treat 'else' keyword as ELSE type, we are calculating score for it.
        // But the nesting level for the code AFTER 'else' needs to be flattened?

        // Wait, 'visit' logic:
        // IF -> structural=1, nesting++ (activeNesting=1).
        // visit child: ELSE (keyword).
        // ELSE -> structural=1, nesting++ (activeNesting=2).

        // If it is 'else if':
        // IF -> structural=1, nesting=1.
        // child: ELSE (keyword).
        // isElseIf(ELSE) -> true (checked sibling).
        // ELSE -> structural=0, nesting=0 (from logic in common.ts).
        // child: IF (nested).

        // The issue with "Received: 3" for if-else (Expected 2):
        // Code: if (c) {} else {}
        // IF (+1).
        // ELSE (+1).
        // Since nesting increases for ELSE, maybe we are double counting or nesting penalty?

        // common.ts:
        // case 'ELSE':
        //   if (!isElseIf) { label='else', score=1, increasesNesting=true }

        // So IF=1. ELSE=1. Total=2 structural.
        // Plus nesting?
        // IF increases nesting. So children of IF get +1.
        // The ELSE keyword is a child of IF_STATEMENT?

        // Debug tree:
        // if_statement
        //   if
        //   ...
        //   block (consequent)
        //   else
        //   block (alternative)

        // IF_STATEMENT is the parent. 'isMethod' handles method context.
        // visit(IF_STATEMENT): type=IF -> score=1. increasesNesting=true.
        // Children:
        //   block (consequent): not structural.
        //   else: type=ELSE.
        //     isElseIf(else) -> false (followed by block).
        //     score=1. increasesNesting=true.
        //     It receives current nesting from parent (IF)?
        //     Parent is IF_STATEMENT. activeNesting=1.
        //     So ELSE score = 1 + 1 (nesting) = 2?
        //     Yes!

        // We do NOT want ELSE to inherit nesting from its own IF statement.
        // That's what `shouldFlattenNesting` is for.

        // parent: IF_STATEMENT. child: ELSE (keyword).
        // We should flatten nesting for ELSE.

        if (parent.type === 'if_statement' || parent.type === 'if_element') {
             // If child is the 'else' keyword or 'else_clause' or the alternative block?
             // Usually we flatten for the *alternative branch*.
             // But here 'else' IS the node causing complexity.

             if (child.type === 'else' || child.type === 'else_clause') {
                 return true;
             }

             const alternative = parent.childForFieldName('alternative');
             if (alternative && child.equals(alternative)) {
                 return true;
             }
        }
        return false;
    }
}

export function calculateDartComplexity(tree: Tree): MethodComplexity[] {
    return calculateGenericComplexity(tree, new DartAdapter());
}
