import { expect, test, describe, beforeAll } from "bun:test";
import { calculateComplexity } from "../src/complexity";
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';

let parser: Parser;

beforeAll(async () => {
    await Parser.init();
    parser = new Parser();
    const langPath = path.resolve(__dirname, '../../vscode-extension/public/tree-sitter-typescript.wasm');
    const lang = await Language.load(langPath);
    parser.setLanguage(lang);
});

function createTree(code: string) {
    return parser.parse(code);
}

describe("Nested Functions Aggregation", () => {
    test("Nested functions are aggregated into parent", async () => {
        const code = `
        function outer() {
            if (true) { // +1
                function inner() {
                    if (true) {} // +1
                }
            }
        }`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');

        const outer = results.find(r => r.name === 'outer');
        const inner = results.find(r => r.name === 'inner');

        // Inner: nesting level 2 (inherited from outer(0) -> if(1) + 1).
        // if(true) -> 1 + 2 = 3.
        expect(inner!.score).toBe(3);

        // Outer: nesting 0.
        // if(true) -> 1 + 0 = 1.
        // Total Outer = 1 (own) + 3 (inner) = 4.
        expect(outer!.score).toBe(4);
    });

    test("Deep nesting aggregation", async () => {
        const code = `
        function A() {
            if (a) {} // +1
            function B() {
                if (b) {} // +1
                function C() {
                    if (c) {} // +1
                }
            }
        }`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');

        const A = results.find(r => r.name === 'A');
        const B = results.find(r => r.name === 'B');
        const C = results.find(r => r.name === 'C');

        // C: nesting level 2 (inherited from B(1) + 1).
        // if(c) -> 1 + 2 = 3.
        expect(C!.score).toBe(3);

        // B: nesting level 1 (inherited from A(0) + 1).
        // if(b) -> 1 + 1 = 2.
        // Total B = 2 (own) + 3 (C) = 5.
        expect(B!.score).toBe(5);

        // A: nesting level 0.
        // if(a) -> 1 + 0 = 1.
        // Total A = 1 (own) + 5 (B) = 6.
        expect(A!.score).toBe(6);
    });
});
