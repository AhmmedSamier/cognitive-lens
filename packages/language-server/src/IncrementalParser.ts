import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
} from 'vscode-languageserver/node';
import { Parser, Tree } from 'web-tree-sitter';

interface CacheEntry {
  document: TextDocument;
  tree: Tree;
  languageId: string;
}

export class IncrementalParser {
  private cache = new Map<string, CacheEntry>();
  private parsers = new Map<string, Parser>();

  constructor(parsers: { csharp?: Parser; typescript?: Parser; tsx?: Parser; dart?: Parser }) {
    if (parsers.csharp) this.parsers.set('csharp', parsers.csharp);
    if (parsers.dart) this.parsers.set('dart', parsers.dart);
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
      textDocument.text,
    );

    try {
      const tree = parser.parse(document.getText());
      this.cache.set(textDocument.uri, {
        document,
        tree,
        languageId: languageId,
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
    const entry = this.cache.get(uri);

    if (!entry) return;

    const parser = this.getParser(entry.languageId);
    if (!parser) return;

    let doc = entry.document;
    let oldTree = entry.tree;
    let useOldTree = true;

    for (const change of params.contentChanges) {
      if ('range' in change) {
        if (useOldTree) {
          const startIndex = doc.offsetAt(change.range.start);
          const oldEndIndex = doc.offsetAt(change.range.end);
          const newEndIndex = startIndex + change.text.length;

          const startPos = change.range.start;
          const oldEndPos = change.range.end;

          // Apply change to doc to get new positions
          // We update the doc incrementally to ensure subsequent changes in the array are calculated against the correct state
          const nextDoc = TextDocument.update(doc, [change], doc.version);
          const newEndPos = nextDoc.positionAt(newEndIndex);

          oldTree.edit({
            startIndex,
            oldEndIndex,
            newEndIndex,
            startPosition: { row: startPos.line, column: startPos.character },
            oldEndPosition: { row: oldEndPos.line, column: oldEndPos.character },
            newEndPosition: { row: newEndPos.line, column: newEndPos.character },
          });

          doc = nextDoc;
        } else {
          // If we already had a full update, just update the doc text
          doc = TextDocument.update(doc, [change], doc.version);
        }
      } else {
        // Full update
        doc = TextDocument.update(doc, [change], doc.version);
        useOldTree = false;
      }
    }

    entry.document = doc;
    // Pass the edited tree to parse() to enable incremental parsing
    if (useOldTree) {
      const newTree = parser.parse(doc.getText(), oldTree);
      oldTree.delete();
      entry.tree = newTree;
    } else {
      oldTree.delete();
      entry.tree = parser.parse(doc.getText());
    }
  }

  public getTree(uri: string): Tree | undefined {
    return this.cache.get(uri)?.tree;
  }

  public getVersion(uri: string): number | undefined {
    return this.cache.get(uri)?.document.version;
  }
}
