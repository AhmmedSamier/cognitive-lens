import { expect, test, describe } from "bun:test";
import * as ts from "typescript";
import { calculateComplexity } from "../src/complexity";

function createSourceFile(code: string) {
    return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
}

describe("Nested Functions", () => {
    test("Nested functions do not double count", () => {
        const code = `
        function outer() {
            if (true) { // +1
                function inner() {
                    if (true) {} // Should NOT count towards outer
                }
            }
        }`;
        const source = createSourceFile(code);
        const results = calculateComplexity(source);

        expect(results.length).toBe(2);

        const outer = results.find(r => r.name === 'outer');
        const inner = results.find(r => r.name === 'inner');

        expect(outer).toBeDefined();
        expect(inner).toBeDefined();

        expect(outer!.score).toBe(1);
        expect(inner!.score).toBe(1);
    });
});
