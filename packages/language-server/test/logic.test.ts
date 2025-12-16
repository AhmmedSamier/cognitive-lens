import { expect, test, describe } from "bun:test";
import {
    computeDiagnostics,
    computeInlayHints,
    computeCodeLenses,
    CognitiveComplexitySettings,
    defaultSettings
} from "../src/logic";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MethodComplexity } from '@cognitive-complexity/core';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

const mockSettings: CognitiveComplexitySettings = {
    threshold: {
        warning: 5,
        error: 10
    },
    showCodeLens: true,
    showDiagnostics: true,
    showInlayHints: {
        methodScore: true,
        details: true
    },
    totalScorePrefix: 'Cognitive Complexity'
};

const mockDocument = TextDocument.create('file:///test.ts', 'typescript', 1,
`function test() {
    console.log('hello');
}
`);

const mockComplexity: MethodComplexity[] = [
    {
        name: 'test',
        score: 6,
        details: [
            { line: 0, score: 1, message: 'if' }
        ],
        startIndex: 0,
        endIndex: 40,
        isCallback: false
    }
];

describe("Language Server Logic", () => {
    test("computeDiagnostics returns warning when score > warning threshold", () => {
        const diagnostics = computeDiagnostics(mockDocument, mockComplexity, mockSettings);
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
    });

    test("computeDiagnostics returns error when score > error threshold", () => {
        const highComplexity = [{ ...mockComplexity[0], score: 15 }];
        const diagnostics = computeDiagnostics(mockDocument, highComplexity, mockSettings);
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });

    test("computeDiagnostics returns empty when score < warning threshold", () => {
        const lowComplexity = [{ ...mockComplexity[0], score: 2 }];
        const diagnostics = computeDiagnostics(mockDocument, lowComplexity, mockSettings);
        expect(diagnostics.length).toBe(0);
    });

    test("computeCodeLenses returns lenses when enabled", () => {
        const lenses = computeCodeLenses(mockDocument, mockComplexity, mockSettings);
        expect(lenses.length).toBe(1);
        // Expect line count (1 line + 1 line for text approx)
        // In mockDocument: start 0, end 40. "function test() {" is 15 chars.
        // The mock document content is:
        // function test() {
        //     console.log('hello');
        // }
        // The mock complexity says startIndex: 0, endIndex: 40.
        // Let's verify line count logic.
        // mockDocument:
        // line 0: function test() {\n (approx 16 chars)
        // line 1:     console.log('hello');\n (approx 26 chars)
        // line 2: }\n
        // length is ~44.
        // 40 is somewhere in line 2 or end of line 1.
        // Let's assume endIndex 40 is valid for test and calculate roughly.
        // positionAt(0) -> line 0.
        // positionAt(40) -> line 2 (probably).
        // So lines = 2 - 0 + 1 = 3.

        // We will just check for "lines)" in the string to be safe against exact calculation in this mock
        expect(lenses[0].command!.title).toContain('Cognitive Complexity: 6');
        expect(lenses[0].command!.title).toContain('lines)');
    });

    test("computeCodeLenses uses custom prefix", () => {
        const customSettings = { ...mockSettings, totalScorePrefix: 'Complexity' };
        const lenses = computeCodeLenses(mockDocument, mockComplexity, customSettings);
        expect(lenses[0].command!.title).toContain('Complexity: 6');
        expect(lenses[0].command!.title).not.toContain('Cognitive Complexity: 6');
    });

    test("computeCodeLenses returns empty when disabled", () => {
        const disabledSettings = { ...mockSettings, showCodeLens: false };
        const lenses = computeCodeLenses(mockDocument, mockComplexity, disabledSettings);
        expect(lenses.length).toBe(0);
    });

    test("computeInlayHints returns hints", () => {
        const range = {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 0 }
        };
        const hints = computeInlayHints(mockDocument, mockComplexity, mockSettings, range);
        // Expect hint for the method and details
        expect(hints.length).toBeGreaterThan(0);
        // Method total hint
        expect(hints.some(h => h.label.toString().includes('Cognitive Complexity: 6'))).toBe(true);
        expect(hints.some(h => h.label.toString().includes('lines)'))).toBe(true);
    });

    test("computeInlayHints uses custom prefix", () => {
        const range = {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 0 }
        };
        const customSettings = { ...mockSettings, totalScorePrefix: 'Complexity' };
        const hints = computeInlayHints(mockDocument, mockComplexity, customSettings, range);

        expect(hints.some(h => h.label.toString().includes('Complexity: 6'))).toBe(true);
        expect(hints.some(h => h.label.toString().includes('Cognitive Complexity: 6'))).toBe(false);
    });
});
