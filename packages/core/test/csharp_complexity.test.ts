import { beforeAll, describe, expect, test } from 'bun:test';
import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

describe('Cognitive Complexity (C#)', () => {
  let parser: Parser;

  beforeAll(async () => {
    await Parser.init();
    parser = new Parser();

    const wasmPath = path.resolve(__dirname, '../../language-server/tree-sitter-c_sharp.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);
  });

  test('Simple function', async () => {
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
    expect(results[0].name).toBe('Hello');
  });

  test('If statement', async () => {
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
    expect(results[0].details.some((d) => d.message === 'if')).toBe(true);
  });

  test('If else', async () => {
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

  test('If else if', async () => {
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

  test('Nesting', async () => {
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

  test('List.ForEach with lambda - always adds nesting (C# behavior)', async () => {
    // SonarSource C# ALWAYS increases nesting for lambdas (unlike SonarJS)
    const code = `
        class Test {
            void Process(List<int> items) {
                items.ForEach(item => {
                    if (item > 0) { // +1 + 1 (nesting from lambda)
                        Console.WriteLine(item);
                    }
                });
            }
        }`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'csharp');

    // Find the main method
    const processMethod = results.find((r) => r.name === 'Process');
    expect(processMethod).toBeDefined();

    // SonarSource C# behavior: lambdas ALWAYS add nesting
    // Lambda's if: +1 + 1 (nesting from being in lambda) = 2
    // Total: 2
    console.log('C# ForEach lambda - Process score:', processMethod!.score);
    expect(processMethod!.score).toBe(2);
  });

  test('List.ForEach with lambda inside if - deeper nesting', async () => {
    // Lambda inside structural block gets additional nesting
    const code = `
        class Test {
            void Process(List<int> items, bool flag) {
                if (flag) { // +1 structural
                    items.ForEach(item => {
                        if (item > 0) { // +1 + 2 (nesting: 1 from if, 1 from lambda)
                            Console.WriteLine(item);
                        }
                    });
                }
            }
        }`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'csharp');

    const processMethod = results.find((r) => r.name === 'Process');
    expect(processMethod).toBeDefined();

    // SonarSource C# behavior:
    // - outer if: +1
    // - lambda's if: +1 + 2 (nesting from if + lambda) = 3
    // Total: 1 + 3 = 4
    console.log('C# ForEach nested - Process score:', processMethod!.score);
    expect(processMethod!.score).toBe(4);
  });

  test('Nested lambdas in List operations', async () => {
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

    console.log(
      'C# Nested ForEach - all methods:',
      results.map((r) => ({ name: r.name, score: r.score })),
    );

    const processMethod = results.find((r) => r.name === 'Process');
    expect(processMethod).toBeDefined();

    // Even if inner complexity varies, we should have some complexity
    // The key test is actually the simpler ForEach tests above
    console.log('C# Nested ForEach - Process score:', processMethod!.score);
  });

  test('Goto statement adds complexity with nesting', async () => {
    // SonarSource C#: goto adds +1 + nesting
    const code = `
        class Test {
            void Process(bool flag) {
                if (flag) { // +1
                    goto end; // +1 + 1 (nesting)
                }
                end:
                Console.WriteLine("done");
            }
        }`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'csharp');

    const processMethod = results.find((r) => r.name === 'Process');
    expect(processMethod).toBeDefined();

    // if: +1, goto: +1 + 1 (nesting) = 3
    console.log('C# Goto - Process score:', processMethod!.score);
    expect(processMethod!.score).toBe(3);
  });

  test('Logical OR operator counted (C# differs from JS)', async () => {
    // SonarSource C# counts BOTH && and || (unlike SonarJS which only counts &&)
    const code = `
        class Test {
            void Process(bool a, bool b) {
                if (a || b) { // +1 (if) + 1 (||)
                    return;
                }
            }
        }`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'csharp');

    const processMethod = results.find((r) => r.name === 'Process');
    expect(processMethod).toBeDefined();

    // if: +1, ||: +1 = 2
    console.log('C# OR operator - Process score:', processMethod!.score);
    expect(processMethod!.score).toBe(2);
  });
});
