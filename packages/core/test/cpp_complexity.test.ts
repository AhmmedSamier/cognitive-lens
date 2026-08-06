import { beforeAll, describe, expect, test } from 'bun:test';
import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

describe('Cognitive Complexity (C++)', () => {
  let parser: Parser;

  beforeAll(async () => {
    await Parser.init();
    parser = new Parser();

    const wasmPath = path.resolve(__dirname, '../../vscode-extension/tree-sitter-cpp.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);
  });

  test('Simple function', async () => {
    const code = `
void hello() {
    std::cout << "Hello";
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(0);
    expect(results[0].name).toBe('hello');
  });

  test('Class method', async () => {
    const code = `
class Foo {
public:
    void bar() {
        return;
    }
};`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    const barMethod = results.find((r) => r.name === 'bar');
    expect(barMethod).toBeDefined();
    expect(barMethod!.score).toBe(0);
  });

  test('If statement', async () => {
    const code = `
void test(bool a) {
    if (a) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'if')).toBe(true);
  });

  test('If else', async () => {
    const code = `
void test(bool a) {
    if (a) {
        return;
    } else {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(2);
  });

  test('If else if', async () => {
    const code = `
void test(bool a, bool b) {
    if (a) {
        return;
    } else if (b) {
        return;
    } else {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(3);
  });

  test('Nesting', async () => {
    const code = `
void test(bool a, bool b) {
    if (a) {
        if (b) {
            return;
        }
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(3);
  });

  test('For loop', async () => {
    const code = `
void test(int n) {
    for (int i = 0; i < n; i++) {
        std::cout << i;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(1);
  });

  test('Range-based for loop', async () => {
    const code = `
void test(std::vector<int>& items) {
    for (auto item : items) {
        std::cout << item;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'loop')).toBe(true);
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
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBeGreaterThanOrEqual(2);
    expect(results[0].details.some((d) => d.message === 'switch')).toBe(true);
  });

  test('Try catch', async () => {
    const code = `
void test() {
    try {
        throw std::runtime_error("error");
    } catch (const std::exception& e) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'catch')).toBe(true);
  });

  test('Ternary expression', async () => {
    const code = `
int test(bool flag) {
    return flag ? 1 : 2;
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(1);
    expect(results[0].details.some((d) => d.message === 'ternary')).toBe(true);
  });

  test('Logical OR operator', async () => {
    const code = `
void test(bool a, bool b) {
    if (a || b) {
        return;
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(2);
  });

  test('Goto statement', async () => {
    const code = `
void test(bool flag) {
    if (flag) {
        goto end;
    }
    end:
    return;
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');
    expect(results[0].score).toBe(3);
  });

  test('Lambda nesting adds complexity', async () => {
    const code = `
void process(std::vector<int>& items) {
    std::for_each(items.begin(), items.end(), [](int item) {
        if (item > 0) {
            std::cout << item;
        }
    });
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');

    const processMethod = results.find((r) => r.name === 'process');
    expect(processMethod).toBeDefined();
    expect(processMethod!.score).toBe(2);
  });

  test('Lambda inside if adds deeper nesting', async () => {
    const code = `
void process(std::vector<int>& items, bool flag) {
    if (flag) {
        std::for_each(items.begin(), items.end(), [](int item) {
            if (item > 0) {
                std::cout << item;
            }
        });
    }
}`;
    const tree = parser.parse(code);
    const results = await calculateComplexity(tree, 'cpp');

    const processMethod = results.find((r) => r.name === 'process');
    expect(processMethod).toBeDefined();
    expect(processMethod!.score).toBe(4);
  });
});
