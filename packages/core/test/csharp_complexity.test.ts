import { expect, test, describe, beforeAll } from "bun:test";
import { calculateComplexity } from "../src/complexity";
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';

describe("Cognitive Complexity (C#)", () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();

        const wasmPath = path.resolve(__dirname, '../../language-server/tree-sitter-c_sharp.wasm');
        const lang = await Language.load(wasmPath);
        parser.setLanguage(lang);
    });

    test("Simple function", async () => {
        const code = `
        class Test {
            void Hello() {
                Console.WriteLine("Hello");
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');
        expect(results.length).toBe(1);
        expect(results[0].score).toBe(0);
        expect(results[0].name).toBe("Hello");
    });

    test("If statement", async () => {
        const code = `
        class Test {
            void Test(bool a) {
                if (a) {
                    return;
                }
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');
        expect(results[0].score).toBe(1);
        expect(results[0].details.some(d => d.message === 'if')).toBe(true);
    });

    test("If else", async () => {
        const code = `
        class Test {
            void Test(bool a) {
                if (a) {
                    return;
                } else {
                    return;
                }
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');
        expect(results[0].score).toBe(2); // if +1, else +1
    });

    test("If else if", async () => {
        const code = `
        class Test {
            void Test(bool a, bool b) {
                if (a) {
                    return;
                } else if (b) {
                    return;
                } else {
                    return;
                }
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');
        // if (+1), else if (+1), else (+1) = 3
        expect(results[0].score).toBe(3);
    });

    test("Nesting", async () => {
        const code = `
        class Test {
            void Test(bool a, bool b) {
                if (a) { // +1
                    if (b) { // +1 + 1(nesting)
                        return;
                    }
                }
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');
        expect(results[0].score).toBe(3);
    });
});
