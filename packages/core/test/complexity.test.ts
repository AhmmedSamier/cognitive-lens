import { expect, test, describe } from "bun:test";
import * as ts from "typescript";
import { calculateComplexity } from "../src/complexity";

function createSourceFile(code: string) {
    return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
}

describe("Cognitive Complexity", () => {
    test("Simple function", async () => {
        const code = `function hello() { console.log('hello'); }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results.length).toBe(1);
        expect(results[0].score).toBe(0);
    });

    test("If statement", async () => {
        const code = `function test(a) { if (a) { return true; } }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results[0].score).toBe(1);
        expect(results[0].details).toEqual([{ line: 0, score: 1, message: "if" }]);
    });

    test("If else", async () => {
        const code = `
        function test(a) {
            if (a) {
                return true;
            } else {
                return false;
            }
        }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results[0].score).toBe(2); // if +1, else +1
        // Details: line 2 (if), line 4 (else)
        expect(results[0].details.length).toBe(2);
    });

    test("If else if else", async () => {
        const code = `
        function test(a) {
            if (a) {
                return true;
            } else if (b) {
                return false;
            } else {
                return 0;
            }
        }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        // if (+1), else if (+1), else (+1) = 3
        expect(results[0].score).toBe(3);
    });

    test("Nesting", async () => {
        const code = `
        function test(a, b) {
            if (a) { // +1
                if (b) { // +1 + 1(nesting) = 2
                    return true;
                }
            }
        }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results[0].score).toBe(3);
        const details = results[0].details;
        // Verify details
        // Line 2: if (+1)
        // Line 3: if (+1), nesting (+1)
        // Wait, details order might vary or be separate entries
        const scores = details.map(d => d.score);
        expect(scores.reduce((a,b)=>a+b, 0)).toBe(3);
        expect(details.length).toBe(3); // if, if, nesting
    });

    test("Binary operators", async () => {
        const code = `
        function test(a, b, c) {
            if (a && b && c) { // +1 (if), +1 (&& sequence)
                return true;
            }
        }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results[0].score).toBe(2);
    });

    test("Binary operators mixed", async () => {
        const code = `
        function test(a, b, c) {
            if (a && b || c) { // +1 (if), +1 (&&), +1 (||) = 3
                return true;
            }
        }`;
        const source = createSourceFile(code);
        const results = await calculateComplexity(source, 'typescript');
        expect(results[0].score).toBe(3);
    });
});
