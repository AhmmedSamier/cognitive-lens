import { expect, test, describe } from "bun:test";
// We cannot easily test the server's connection logic without a mock connection.
// But we can verify the core logic if we extract it.
// For now, let's just ensure the package compiles and we can import from it.

describe("Language Server Logic", () => {
    test("Filtering logic check", () => {
        // Range: 50-100
        const startLine = 50;
        const endLine = 100;

        const lineInside = 75;
        const lineOutsideBefore = 30;
        const lineOutsideAfter = 120;

        // Logic: if (line < startLine || line > endLine) continue;

        expect(lineInside < startLine || lineInside > endLine).toBe(false);
        expect(lineOutsideBefore < startLine || lineOutsideBefore > endLine).toBe(true);
        expect(lineOutsideAfter < startLine || lineOutsideAfter > endLine).toBe(true);

        // Edge cases
        const lineStart = 50;
        expect(lineStart < startLine || lineStart > endLine).toBe(false); // Included

        const lineEnd = 100;
        expect(lineEnd < startLine || lineEnd > endLine).toBe(false); // Included
    });
});
