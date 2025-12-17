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

        // Inner should be 1.
        expect(inner!.score).toBe(1);

        // Outer should be 1 (own) + 1 (inner) = 2.
        expect(outer!.score).toBe(2);
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

        expect(C!.score).toBe(1);

        // B = 1 (own) + 1 (C) = 2
        expect(B!.score).toBe(2);

        // A = 1 (own) + 1 (B own) + 1 (C own) = 3
        expect(A!.score).toBe(3);
    });
});
