import { expect, test, describe } from "bun:test";
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

// This test just ensures the import and connection creation works in the test env.
// It doesn't test the full server logic which requires IPC.
describe("Language Server", () => {
    test("Can create connection", () => {
        // We can't really run createConnection here without streams,
        // but we can check if the symbols are available.
        expect(createConnection).toBeDefined();
        expect(ProposedFeatures).toBeDefined();
    });
});
