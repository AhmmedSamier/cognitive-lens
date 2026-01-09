/**
 * Parity tests to ensure our cognitive complexity calculations match SonarJS.
 * Uses eslint-plugin-sonarjs to validate our implementation.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

let parser: Parser;

beforeAll(async () => {
  await Parser.init();
  parser = new Parser();
  const langPath = path.resolve(
    __dirname,
    '../../vscode-extension/public/tree-sitter-typescript.wasm',
  );
  const lang = await Language.load(langPath);
  parser.setLanguage(lang);
});

function createTree(code: string) {
  return parser.parse(code) as any;
}

interface SonarComplexity {
  functionLine: number;
  complexity: number;
}

/**
 * Get cognitive complexity from SonarJS eslint plugin.
 * We use threshold 0 to report all functions and parse the message to extract complexity.
 */
function getSonarJSComplexity(code: string): SonarComplexity[] {
  const linter = new Linter({ configType: 'flat' });

  const results = linter.verify(code, {
    plugins: {
      sonarjs,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 0], // threshold 0 = report all
    },
  });

  return results.map((result) => {
    // Message format: "Refactor this function to reduce its Cognitive Complexity from X to the 0 allowed."
    const match = result.message.match(/from (\d+) to/);
    const complexity = match ? parseInt(match[1], 10) : 0;
    return {
      functionLine: result.line,
      complexity,
    };
  });
}

describe('SonarJS Parity Tests', () => {
  test('Simple if statement', async () => {
    const code = `function test(a) { if (a) { return true; } }`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Nested if statements', async () => {
    const code = `
function test(a, b) {
    if (a) {
        if (b) {
            return true;
        }
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // Nested if: +1 (first if) + +2 (nested if = 1 + 1 nesting) = 3
    expect(sonarResults[0].complexity).toBe(3);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('If-else chain', async () => {
    const code = `
function test(a, b) {
    if (a) {
        return 1;
    } else if (b) {
        return 2;
    } else {
        return 3;
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // if (+1), else if (+1), else (+1) = 3
    expect(sonarResults[0].complexity).toBe(3);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Logical AND sequence', async () => {
    const code = `
function test(a, b, c) {
    if (a && b && c) {
        return true;
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // if (+1), && sequence (+1) = 2
    expect(sonarResults[0].complexity).toBe(2);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Logical OR sequence', async () => {
    const code = `
function test(a, b, c) {
    if (a || b || c) {
        return true;
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // SonarJS: if (+1) only - || sequences are NOT counted
    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Mixed logical operators', async () => {
    const code = `
function test(a, b, c) {
    if (a && b || c) {
        return true;
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // SonarJS: if (+1), && (+1) = 2 - || is NOT counted
    expect(sonarResults[0].complexity).toBe(2);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('For loop', async () => {
    const code = `
function test(arr) {
    for (let i = 0; i < arr.length; i++) {
        console.log(arr[i]);
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Nested loop with if', async () => {
    const code = `
function test(arr) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > 0) {
            console.log(arr[i]);
        }
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // for (+1), if nested (+2) = 3
    expect(sonarResults[0].complexity).toBe(3);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Switch statement', async () => {
    const code = `
function test(x) {
    switch(x) {
        case 1: return 'one';
        case 2: return 'two';
        default: return 'other';
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // switch (+1)
    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Try-catch', async () => {
    const code = `
function test() {
    try {
        riskyOperation();
    } catch (e) {
        handleError(e);
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // catch (+1)
    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Ternary operator', async () => {
    const code = `
function test(a) {
    return a ? 'yes' : 'no';
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // ternary (+1)
    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Nested ternary', async () => {
    const code = `
function test(a, b) {
    return a ? (b ? 'both' : 'a only') : 'none';
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // outer ternary (+1), inner ternary (+2 = 1 + 1 nesting) = 3
    expect(sonarResults[0].complexity).toBe(3);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('While loop', async () => {
    const code = `
function test() {
    let i = 0;
    while (i < 10) {
        i++;
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Do-while loop', async () => {
    const code = `
function test() {
    let i = 0;
    do {
        i++;
    } while (i < 10);
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    expect(sonarResults[0].complexity).toBe(1);
    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Complex nested structure', async () => {
    const code = `
function complex(a, b, c) {
    if (a) {                        // +1
        for (let i = 0; i < 10; i++) {  // +2 (1 + 1 nesting)
            if (b && c) {           // +3 (1 + 2 nesting) + 1 (&& seq)
                try {
                    work();
                } catch (e) {       // +4 (1 + 3 nesting)
                    handleError();
                }
            }
        }
    }
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    expect(ourResults[0].score).toBe(sonarResults[0].complexity);
  });

  test('Arrow function callback', async () => {
    const code = `
function test(arr) {
    arr.forEach((item) => {
        if (item > 0) {
            console.log(item);
        }
    });
}`;

    const tree = createTree(code);
    const ourResults = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // Find the main test function in our results
    const testFunction = ourResults.find((r) => r.name === 'test');
    expect(testFunction).toBeDefined();

    // SonarJS "second-level function" handling is now implemented:
    // Since the parent function (test) has NO structural complexity (no if/for/while in its own body),
    // the callback is treated as an independent top-level function.
    // The if inside the callback gets +1 without nesting penalty.
    expect(sonarResults[0].complexity).toBe(1); // SonarJS value
    expect(testFunction!.score).toBe(sonarResults[0].complexity); // We now match!
  });
});
