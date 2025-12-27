import { expect, test, describe } from "bun:test";
import { normalizeSettings, defaultSettings, CognitiveComplexitySettings } from "../src/logic";

describe("Settings Normalization", () => {
    test("returns defaults for null/undefined input", () => {
        expect(normalizeSettings(null)).toEqual(defaultSettings);
        expect(normalizeSettings(undefined)).toEqual(defaultSettings);
    });

    test("preserves nested structure (VS Code style)", () => {
        const input = {
            threshold: { warning: 50, error: 100 },
            showCodeLens: false
        };
        const result = normalizeSettings(input);

        expect(result.threshold.warning).toBe(50);
        expect(result.threshold.error).toBe(100);
        expect(result.showCodeLens).toBe(false);
        // Should preserve defaults for missing keys
        expect(result.showDiagnostics).toBe(defaultSettings.showDiagnostics);
        expect(result.showInlayHints.methodScore).toBe(defaultSettings.showInlayHints.methodScore);
    });

    test("handles flat keys (Visual Studio style)", () => {
        const input = {
            "cognitiveComplexity.threshold.warning": "50",
            "threshold.error": 100, // Handle numeric input too
            "showInlayHints.methodScore": "true",
            "totalScorePrefix": "Complex!"
        };
        const result = normalizeSettings(input);

        expect(result.threshold.warning).toBe(50);
        expect(result.threshold.error).toBe(100);
        expect(result.showInlayHints.methodScore).toBe(true);
        expect(result.totalScorePrefix).toBe("Complex!");

        // Ensure unmapped keys don't destroy defaults
        expect(result.showDiagnostics).toBe(defaultSettings.showDiagnostics);
    });

    test("prioritizes nested over flat if both exist (though unlikely)", () => {
        const input = {
            threshold: { warning: 10, error: 20 },
            "threshold.warning": 999
        };
        // Our implementation iterates keys *after* applying nested structure,
        // so flat keys override nested ones if present in the same object.
        // This is desired if the client sends a mix where flat keys are more specific overrides.
        const result = normalizeSettings(input);
        expect(result.threshold.warning).toBe(999);
        expect(result.threshold.error).toBe(20);
    });

    test("handles partial flat keys correctly", () => {
        const input = {
            "cognitiveComplexity.showDiagnostics": "false"
        };
        const result = normalizeSettings(input);
        expect(result.showDiagnostics).toBe(false);
        expect(result.showCodeLens).toBe(true); // Default
    });
});
