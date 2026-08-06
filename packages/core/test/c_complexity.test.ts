import { beforeAll, describe, expect, test } from 'bun:test';
import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

describe('Cognitive Complexity (C)', () => {
  let parser: Parser;

  beforeAll(async () => {
    await Parser.init();
    parser = new Parser();

    const wasmPath = path.resolve(__dirname, '../../vscode-extension/tree-sitter-c.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);
  });

  test('Simple function', async () => {
    const code = `
void hello(void) {
    printf("Hello");
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(0);
    expect(results[0].name).toBe('hello');
  });

  test('If statement', async () => {
    const code = `
void test(int a) {
    if (a) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'if')).toBe(true);
  });

  test('If else', async () => {
    const code = `
void test(int a) {
    if (a) {
        return;
    } else {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(2);
  });

  test('If else if', async () => {
    const code = `
void test(int a, int b) {
    if (a) {
        return;
    } else if (b) {
        return;
    } else {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(3);
  });

  test('Nesting', async () => {
    const code = `
void test(int a, int b) {
    if (a) {
        if (b) {
            return;
        }
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(3);
  });

  test('For loop', async () => {
    const code = `
void test(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'loop')).toBe(true);
  });

  test('While loop', async () => {
    const code = `
void test(int n) {
    while (n > 0) {
        n--;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(1);
  });

  test('Switch case', async () => {
    const code = `
void test(int x) {
    switch (x) {
        case 1:
            return;
        case 2:
            return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBeGreaterThanOrEqual(2);
    expect(results[0].details.some((d) => d.message === 'switch')).toBe(true);
  });

  test('Ternary expression', async () => {
    const code = `
int test(int flag) {
    return flag ? 1 : 2;
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'ternary')).toBe(true);
  });

  test('Logical OR operator', async () => {
    const code = `
void test(int a, int b) {
    if (a || b) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(2);
  });

  test('Logical AND operator', async () => {
    const code = `
void test(int a, int b) {
    if (a && b) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(2);
  });

  test('Goto statement adds complexity with nesting', async () => {
    const code = `
void test(int flag) {
    if (flag) {
        goto end;
    }
    end:
    return;
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'c');
    expect(results[0].score).toBe(3);
    expect(results[0].details.some((d) => d.message === 'goto')).toBe(true);
  });
});
