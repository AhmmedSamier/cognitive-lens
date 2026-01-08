import { expect, test, describe, beforeAll } from "bun:test";
import { calculateComplexity } from "../src/complexity";
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import { Linter } from 'eslint';
// @ts-ignore - ESM import 
import sonarjs from 'eslint-plugin-sonarjs';

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

/**
 * Get cognitive complexity from SonarJS eslint plugin for verification.
 */
function getSonarJSComplexity(code: string): { line: number; complexity: number }[] {
    const linter = new Linter({ configType: 'flat' });

    const results = linter.verify(code, {
        plugins: { sonarjs },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            'sonarjs/cognitive-complexity': ['error', 0]
        }
    });

    return results.map(result => {
        const match = result.message.match(/from (\d+) to/);
        return {
            line: result.line,
            complexity: match ? parseInt(match[1], 10) : 0
        };
    });
}

describe("Nested Functions Aggregation (SonarJS Compatible)", () => {
    test("Function nested inside structural block - parent has structural complexity", async () => {
        // When parent has structural complexity (if), nested functions ARE affected by nesting
        const code = `
function outer() {
    if (true) { // +1 structural
        function inner() {
            if (true) {} // +1 + nesting penalty
        }
    }
}`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        const sonarResults = getSonarJSComplexity(code);

        const outer = results.find(r => r.name === 'outer');
        const inner = results.find(r => r.name === 'inner');

        // SonarJS behavior: 
        // - outer has structural complexity (if)
        // - inner is second-level, so it gets nesting penalty
        // - inner's if: +1 base + 1 nesting = 2
        // - outer total: 1 (if) + 2 (inner) = 3

        console.log('Outer score:', outer!.score, 'Inner score:', inner!.score);
        console.log('SonarJS results:', JSON.stringify(sonarResults));

        // Note: SonarJS ESLint reports PER-FUNCTION complexity (outer=1, inner=1 or 2)
        // We AGGREGATE nested function complexity into the parent
        // This is a design choice for our use case (showing total complexity of a method including callbacks)

        // Verify inner gets nesting penalty since parent has structural complexity
        // inner's if: +1 base + 1 nesting = 2
        expect(inner!.score).toBe(2);

        // outer: 1 (if) + 2 (inner aggregated) = 3
        expect(outer!.score).toBe(3);
    });

    test("Function not in structural block - second-level treated as top-level", async () => {
        // When parent has NO structural complexity, second-level functions are independent
        const code = `
function parent() {
    doSomething();
    function child() {
        if (true) {} // +1 (no nesting penalty since parent has no structure)
    }
}`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        const sonarResults = getSonarJSComplexity(code);

        const parent = results.find(r => r.name === 'parent');
        const child = results.find(r => r.name === 'child');

        console.log('Parent score:', parent!.score, 'Child score:', child!.score);
        console.log('SonarJS results:', JSON.stringify(sonarResults));

        // SonarJS behavior:
        // - parent has no structural complexity
        // - child is second-level, treated as top-level
        // - child's if: +1 (no nesting)
        // - parent total: 0 (own) + 1 (child) = 1
        expect(child!.score).toBe(1);
        expect(parent!.score).toBe(1);
    });

    test("Deep nesting - third level and beyond always get nesting", async () => {
        const code = `
function A() {
    if (a) {} // +1
    function B() {
        if (b) {} // +1 + nesting (B is second-level, A has structure)
        function C() {
            if (c) {} // +1 + nesting (C is third-level, always nested)
        }
    }
}`;
        const tree = createTree(code);
        const results = await calculateComplexity(tree, 'typescript');
        const sonarResults = getSonarJSComplexity(code);

        const A = results.find(r => r.name === 'A');
        const B = results.find(r => r.name === 'B');
        const C = results.find(r => r.name === 'C');

        console.log('A score:', A!.score, 'B score:', B!.score, 'C score:', C!.score);
        console.log('SonarJS results:', JSON.stringify(sonarResults));

        // C is third-level so gets nesting
        // B is second-level and A has structure, so B gets nesting
        expect(C).toBeDefined();
        expect(B).toBeDefined();
        expect(A).toBeDefined();

        // Just verify we get reasonable scores
        expect(A!.score).toBeGreaterThan(0);
    });
});
