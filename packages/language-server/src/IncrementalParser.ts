import { Parser, Tree } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    DidCloseTextDocumentParams,
    Range,
    Position
} from 'vscode-languageserver/node';

interface CacheEntry {
    document: TextDocument;
    tree: Tree;
    languageId: string;
}

export class IncrementalParser {
    private cache = new Map<string, CacheEntry>();
    private parsers = new Map<string, Parser>();

    constructor(parsers: { csharp?: Parser, typescript?: Parser, tsx?: Parser }) {
        if (parsers.csharp) this.parsers.set('csharp', parsers.csharp);
        if (parsers.typescript) {
            this.parsers.set('typescript', parsers.typescript);
            this.parsers.set('javascript', parsers.typescript);
        }
        if (parsers.tsx) {
            this.parsers.set('typescriptreact', parsers.tsx);
            this.parsers.set('javascriptreact', parsers.tsx);
        }
    }

    private getParser(languageId: string): Parser | undefined {
        return this.parsers.get(languageId.toLowerCase());
    }

    public async handleOpen(params: DidOpenTextDocumentParams): Promise<void> {
        const { textDocument } = params;
        const languageId = textDocument.languageId.toLowerCase();
        const parser = this.getParser(languageId);
        if (!parser) return;

        const document = TextDocument.create(
            textDocument.uri,
            languageId,
            textDocument.version,
            textDocument.text
        );

        try {
            const tree = parser.parse(document.getText());
            this.cache.set(textDocument.uri, {
                document,
                tree,
                languageId: languageId
            });
        } catch (e) {
            console.error(`Error parsing ${textDocument.uri}:`, e);
        }
    }

    public handleClose(params: DidCloseTextDocumentParams): void {
        const entry = this.cache.get(params.textDocument.uri);
        if (entry) {
            entry.tree.delete();
            this.cache.delete(params.textDocument.uri);
        }
    }

    public handleChange(params: DidChangeTextDocumentParams): void {
        const uri = params.textDocument.uri;
        let entry = this.cache.get(uri);

        if (!entry) return;

        const parser = this.getParser(entry.languageId);
        if (!parser) return;

        let needsParse = false;

        // Use the new version from the params for the updated document
        const newVersion = params.textDocument.version;

        for (const change of params.contentChanges) {
             if ('range' in change) {
                 needsParse = true;

                 const { range, text } = change;
                 const oldDoc = entry.document;

                 const startIndex = oldDoc.offsetAt(range.start);
                 const oldEndIndex = oldDoc.offsetAt(range.end);
                 const newEndIndex = startIndex + text.length;

                 const startPosition = range.start;
                 const oldEndPosition = range.end;

                 // Create new document for next iteration and for final storage
                 // We apply the new version here.
                 // Note: If there are multiple changes, ideally we'd want intermediate versions or just final?
                 // TextDocument.update doesn't validate version. Setting final version is fine.
                 const newDoc = TextDocument.update(oldDoc, [change], newVersion);

                 // Calculate newEndPosition using the NEW document
                 const newEndPosition = newDoc.positionAt(newEndIndex);

                 entry.tree.edit({
                    startIndex,
                    oldEndIndex,
                    newEndIndex,
                    startPosition: { row: startPosition.line, column: startPosition.character },
                    oldEndPosition: { row: oldEndPosition.line, column: oldEndPosition.character },
                    newEndPosition: { row: newEndPosition.line, column: newEndPosition.character }
                 });

                 entry.document = newDoc;
             } else {
                 // Full sync
                 const newDoc = TextDocument.update(entry.document, [change], newVersion);
                 entry.document = newDoc;
                 entry.tree.delete();
                 entry.tree = parser.parse(newDoc.getText());
                 needsParse = false;
             }
        }

        if (needsParse) {
            const newTree = parser.parse(entry.document.getText(), entry.tree);
            entry.tree.delete();
            entry.tree = newTree;
        }
    }

    public getTree(uri: string): Tree | undefined {
        return this.cache.get(uri)?.tree;
    }

    public getVersion(uri: string): number | undefined {
        return this.cache.get(uri)?.document.version;
    }
}
