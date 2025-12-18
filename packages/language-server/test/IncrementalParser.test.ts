import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { IncrementalParser } from "../src/IncrementalParser";
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Range, Position } from 'vscode-languageserver/node';

let parser: Parser;

beforeAll(async () => {
    await Parser.init();
    parser = new Parser();
    const langPath = path.resolve(__dirname, '../tree-sitter-typescript.wasm');
    const lang = await Language.load(langPath);
    parser.setLanguage(lang);
});

describe("IncrementalParser", () => {
    test("Handles open and full sync", async () => {
        const incrementalParser = new IncrementalParser({ typescript: parser });
        const uri = "file:///test.ts";
        const text = "function test() {}";

        await incrementalParser.handleOpen({
            textDocument: { uri, languageId: "typescript", version: 1, text }
        });

        let tree = incrementalParser.getTree(uri);
        expect(tree).toBeDefined();
        expect(tree?.rootNode.text).toBe(text);

        // Full sync
        const newText = "function changed() {}";
        incrementalParser.handleChange({
            textDocument: { uri, version: 2 },
            contentChanges: [{ text: newText }]
        });

        tree = incrementalParser.getTree(uri);
        expect(tree?.rootNode.text).toBe(newText);
    });

    test("Handles incremental edits", async () => {
        const incrementalParser = new IncrementalParser({ typescript: parser });
        const uri = "file:///incremental.ts";
        const text = "function test() {}";

        await incrementalParser.handleOpen({
            textDocument: { uri, languageId: "typescript", version: 1, text }
        });

        // Change "test" to "foo"
        // "function test() {}"
        //          ^^^^
        // Range: line 0, char 9 to line 0, char 13

        const changes = [
            {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 13 } },
                text: "foo"
            }
        ];

        incrementalParser.handleChange({
            textDocument: { uri, version: 2 },
            contentChanges: changes
        });

        const tree = incrementalParser.getTree(uri);
        expect(tree).toBeDefined();
        expect(tree?.rootNode.text).toBe("function foo() {}");

        // Verify structure (it should be valid tree)
        expect(tree?.rootNode.hasError).toBe(false);
    });

    test("Handles multiple sequential edits", async () => {
        const incrementalParser = new IncrementalParser({ typescript: parser });
        const uri = "file:///multi.ts";
        const text = "function test() {}";

        await incrementalParser.handleOpen({
            textDocument: { uri, languageId: "typescript", version: 1, text }
        });

        // 1. Change "test" to "foo" -> "function foo() {}"
        // 2. Change "foo" to "bar" -> "function bar() {}"
        // Note: The second change range must be relative to "function foo() {}"

        const changes = [
            {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 13 } },
                text: "foo"
            },
            {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, // "foo" is length 3
                text: "bar"
            }
        ];

        incrementalParser.handleChange({
            textDocument: { uri, version: 2 },
            contentChanges: changes
        });

        const tree = incrementalParser.getTree(uri);
        expect(tree?.rootNode.text).toBe("function bar() {}");
    });
});
