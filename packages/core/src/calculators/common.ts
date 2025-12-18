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
    const rootNode = tree.rootNode;
    const ancestors: MethodComplexity[] = [];

    function visit(node: SyntaxNode) {
        let isMethodNode = adapter.isMethod(node);
        let method: MethodComplexity | undefined;

        if (isMethodNode) {
            const complexity = computeComplexity(node, adapter);

            const name = adapter.getMethodName(node);
            const isCallback = adapter.isCallback(node);

            method = {
                name,
                score: complexity.score,
                details: complexity.details,
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                isCallback
            };

            for (const ancestor of ancestors) {
                ancestor.score += method.score;
            }

            ancestors.push(method);
            methods.push(method);
        }

        let child = node.firstChild;
        while (child) {
            visit(child);
            child = child.nextSibling;
        }

        if (isMethodNode) {
            ancestors.pop();
        }
    }

    visit(rootNode);

    return methods;
}

function computeComplexity(node: SyntaxNode, adapter: LanguageAdapter): { score: number, details: ComplexityDetail[] } {
    let score = 0;
    const details: ComplexityDetail[] = [];

    function add(n: SyntaxNode, amount: number, message: string) {
        if (amount === 0) return;
        score += amount;
        const line = n.startPosition.row;
        details.push({ line, score: amount, message });
    }

    function visit(n: SyntaxNode, nesting: number) {
        if (n.id !== node.id && adapter.isMethod(n)) {
            return;
        }

        let structural = 0;
        let increasesNesting = false;
        let label = '';

        const type = adapter.getComplexityType(n);

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
                    // Check if it's an "else if" wrapper (if logic requires it)
                    if (!adapter.isElseIf(n)) {
                        label = 'else';
                        structural = 1;
                        increasesNesting = true; // ELSE usually increases nesting unless it's else-if
                    } else {
                        // It is an else-if, so we skip the ELSE penalty.
                        // However, we need to decide if it increases nesting.
                        // Usually 'else if' is flattened, handled by shouldFlattenNesting in recursion.
                        // But the node itself (the else clause) shouldn't score if it's just a wrapper.
                        structural = 0;
                        increasesNesting = false;
                    }
                    break;
                case 'BINARY':
                    const op = adapter.getBinaryOperator(n);
                    if (op && !adapter.isBinaryContinuation(n)) {
                        label = op;
                        structural = 1;
                        increasesNesting = false;
                    }
                    break;
            }
        }

        if (structural > 0) {
            add(n, structural, label);
            if (increasesNesting && nesting > 0) {
                add(n, nesting, 'nesting');
            }
        }

        let childNesting = nesting;
        if (increasesNesting) {
            childNesting = nesting + 1;
        }

        let child = n.firstChild;
        while (child) {
            let nextNesting = childNesting;
            if (adapter.shouldFlattenNesting(n, child)) {
                nextNesting = nesting;
            }
            visit(child, nextNesting);
            child = child.nextSibling;
        }
    }

    let child = node.firstChild;
    while (child) {
        visit(child, 0);
        child = child.nextSibling;
    }

    return { score, details };
}
