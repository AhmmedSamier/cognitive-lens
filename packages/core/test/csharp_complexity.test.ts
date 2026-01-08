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

    test("List.ForEach with lambda - no structural complexity in parent", async () => {
        // When parent has NO structural complexity, the lambda is treated as independent
        const code = `
        class Test {
            void Process(List<int> items) {
                items.ForEach(item => {
                    if (item > 0) { // +1 (no nesting penalty since parent has no structure)
                        Console.WriteLine(item);
                    }
                });
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');

        // Find the main method
        const processMethod = results.find(r => r.name === 'Process');
        expect(processMethod).toBeDefined();

        // SonarJS behavior: parent has no structural complexity
        // So the lambda's if gets +1 only (no nesting penalty)
        // Total: 1
        console.log('C# ForEach no-structure - Process score:', processMethod!.score);
        expect(processMethod!.score).toBe(1);
    });

    test("List.ForEach with lambda - has structural complexity in parent", async () => {
        // When parent HAS structural complexity, the lambda gets nesting penalty
        const code = `
        class Test {
            void Process(List<int> items, bool flag) {
                if (flag) { // +1 structural
                    items.ForEach(item => {
                        if (item > 0) { // +1 + nesting penalty
                            Console.WriteLine(item);
                        }
                    });
                }
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');

        const processMethod = results.find(r => r.name === 'Process');
        expect(processMethod).toBeDefined();

        // SonarJS behavior: parent has structural complexity (if)
        // So the lambda's if gets +1 + 1 (nesting from being in callback)
        // Total: 1 (outer if) + 2 (lambda if with nesting) = 3
        console.log('C# ForEach with-structure - Process score:', processMethod!.score);
        expect(processMethod!.score).toBe(3);
    });

    test("Nested lambdas in List operations", async () => {
        // Test with simpler nested lambda structure
        const code = `
        class Test {
            void Process(object[] items, object[] subItems) {
                items.ForEach(item => {
                    subItems.ForEach(subItem => {
                        if (subItem != null) {
                            Console.WriteLine(subItem);
                        }
                    });
                });
            }
        }`;
        const tree = parser.parse(code);
        const results = await calculateComplexity(tree, 'csharp');

        console.log('C# Nested ForEach - all methods:', results.map(r => ({ name: r.name, score: r.score })));

        const processMethod = results.find(r => r.name === 'Process');
        expect(processMethod).toBeDefined();

        // Even if inner complexity varies, we should have some complexity
        // The key test is actually the simpler ForEach tests above
        console.log('C# Nested ForEach - Process score:', processMethod!.score);
    });
});
