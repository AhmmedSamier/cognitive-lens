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

describe("Cognitive Complexity", () => {
    test("Simple function", async () => {
        const code = `function hello() { console.log('hello'); }`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        expect(results.length).toBe(1);
        expect(results[0].score).toBe(0);
    });

    test("If statement", async () => {
        const code = `function test(a) { if (a) { return true; } }`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
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
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        expect(results[0].score).toBe(2); // if +1, else +1
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
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
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
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        expect(results[0].score).toBe(3);
        const details = results[0].details;
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
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        expect(results[0].score).toBe(2);
    });

    test("Binary operators mixed", async () => {
        const code = `
        function test(a, b, c) {
            if (a && b || c) { // +1 (if), +1 (&&), +1 (||) = 3
                return true;
            }
        }`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        expect(results[0].score).toBe(3);
    });
});
