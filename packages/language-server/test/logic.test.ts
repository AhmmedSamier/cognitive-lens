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
    showCodeLens: true
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
        expect(lenses[0].command!.title).toContain('Cognitive Complexity: 6');
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
    });
});
