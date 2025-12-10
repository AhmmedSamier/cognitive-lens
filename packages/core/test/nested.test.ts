import { expect, test, describe } from "bun:test";
import * as ts from "typescript";
import { calculateComplexity } from "../src/complexity";

function createSourceFile(code: string) {
    return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
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
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');

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
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');

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
