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

        const newVersion = params.textDocument.version;

        // Perform full document update
        // We iterate to respect the sequence of changes if there are multiple,
        // although for full sync we just want the final text.
        // But TextDocument.update correctly handles array of changes.

        const newDoc = TextDocument.update(entry.document, params.contentChanges, newVersion);
        entry.document = newDoc;

        // Force full re-parse to ensure correctness and avoid offset issues with incremental edits.
        // We delete the old tree to free memory.
        entry.tree.delete();
        entry.tree = parser.parse(newDoc.getText());
    }

    public getTree(uri: string): Tree | undefined {
        return this.cache.get(uri)?.tree;
    }

    public getVersion(uri: string): number | undefined {
        return this.cache.get(uri)?.document.version;
    }
}
