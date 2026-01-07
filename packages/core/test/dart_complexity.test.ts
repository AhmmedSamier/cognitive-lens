import { describe, it, expect, beforeAll } from 'bun:test';
import { calculateComplexity, MethodComplexity } from '../src/complexity';
import { Parser, Language } from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';

describe('Dart Complexity', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        // Path to wasm relative to this test file.
        // Assuming we are running from root or packages/core
        // The wasm file is in packages/language-server/tree-sitter-dart.wasm
        const wasmPath = path.resolve(__dirname, '../../../packages/language-server/tree-sitter-dart.wasm');
        if (!fs.existsSync(wasmPath)) {
            console.error('WASM not found at:', wasmPath);
        }
        const lang = await Language.load(wasmPath);
        parser.setLanguage(lang);
    });

    async function analyze(code: string): Promise<MethodComplexity[]> {
        const tree = parser.parse(code);
        return calculateComplexity(tree, 'dart');
    }

    it('should calculate complexity for a simple function', async () => {
        const code = `
            void simple() {
                print("Hello");
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].name).toBe('simple');
        expect(complexities[0].score).toBe(0);
    });

    it('should calculate complexity for if statements', async () => {
        const code = `
            void testIf(bool cond) {
                if (cond) {
                    print("true");
                }
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(1);
    });

    it('should calculate complexity for if-else statements', async () => {
        const code = `
            void testIfElse(bool cond) {
                if (cond) {
                    print("true");
                } else {
                    print("false");
                }
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        // if (+1) + else (+1) = 2
        expect(complexities[0].score).toBe(2);
    });

    it('should calculate complexity for if-else if statements', async () => {
        const code = `
            void testIfElseIf(int x) {
                if (x == 1) {
                    print("1");
                } else if (x == 2) {
                    print("2");
                } else {
                    print("other");
                }
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        // if (+1) + else if (+1) + else (+1) = 3
        // Note: else if is treated as linear, so nest level doesn't increase for else if
        expect(complexities[0].score).toBe(3);
    });

    it('should calculate complexity for loops', async () => {
        const code = `
            void testLoops() {
                for (var i = 0; i < 10; i++) {}
                while (true) {}
                do {} while (false);
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(3);
    });

    it('should calculate complexity for switch', async () => {
        const code = `
            void testSwitch(int x) {
                switch (x) {
                    case 1: break;
                    case 2: break;
                }
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(1);
    });

    it('should calculate complexity for ternary operator', async () => {
        const code = `
            int testTernary(bool c) {
                return c ? 1 : 0;
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(1);
    });

    it('should calculate complexity for binary operators', async () => {
        const code = `
            bool testBinary(bool a, bool b, bool c) {
                return a && b || c;
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        // && (+1), || (+1) = 2
        expect(complexities[0].score).toBe(2);
    });

    it('should handle nesting', async () => {
        const code = `
            void testNesting(bool a, bool b) {
                if (a) { // +1
                    if (b) { // +1 + 1 (nesting) = 2
                        print("nested");
                    }
                }
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(3);
    });

    it('should handle null coalescing', async () => {
        const code = `
            void testNull(String? s) {
                var x = s ?? "default";
            }
        `;
        const complexities = await analyze(code);
        expect(complexities.length).toBe(1);
        expect(complexities[0].score).toBe(1);
    });
});
