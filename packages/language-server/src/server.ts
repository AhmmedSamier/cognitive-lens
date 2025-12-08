import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    InitializeResult,
    CodeLens,
    CodeLensParams,
    InlayHint,
    InlayHintParams,
    InlayHintKind,
    Position
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import * as ts from 'typescript';
import { calculateComplexity, MethodComplexity } from '@cognitive-complexity/core';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            codeLensProvider: {
                resolveProvider: true
            },
            inlayHintProvider: {
                resolveProvider: true
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

const complexityCache = new Map<string, MethodComplexity[]>();

function getComplexity(textDocument: TextDocument): MethodComplexity[] {
    const text = textDocument.getText();
    const sourceFile = ts.createSourceFile(
        textDocument.uri,
        text,
        ts.ScriptTarget.Latest,
        true
    );
    const complexities = calculateComplexity(sourceFile);
    complexityCache.set(textDocument.uri, complexities);
    return complexities;
}

documents.onDidChangeContent(change => {
    getComplexity(change.document);
});

connection.onCodeLens((params: CodeLensParams): CodeLens[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const complexities = getComplexity(document); // Or use cache

    return complexities.map(c => {
        // Find start position
        const start = document.positionAt(c.node.getStart());
        const end = document.positionAt(c.node.getEnd());

        return {
            range: { start, end },
            command: {
                title: `Cognitive Complexity: ${c.score}`,
                command: '',
                arguments: []
            },
            data: c.name
        };
    });
});

connection.onCodeLensResolve((codeLens: CodeLens): CodeLens => {
    return codeLens;
});

// Use connection.languages.inlayHint.on instead of connection.onInlayHint
connection.languages.inlayHint.on((params: InlayHintParams): InlayHint[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const complexities = getComplexity(document);

    // Group by line
    const hintsByLine = new Map<number, { score: number, message: string }[]>();
    for (const method of complexities) {
        for (const detail of method.details) {
            if (!hintsByLine.has(detail.line)) {
                hintsByLine.set(detail.line, []);
            }
            hintsByLine.get(detail.line)!.push(detail);
        }
    }

    const result: InlayHint[] = [];
    for (const [line, details] of hintsByLine) {
        const label = details.map(d => `(+${d.score} ${d.message})`).join(' ');

        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        result.push({
            position: { line, character: len },
            label: ` ${label}`,
            kind: InlayHintKind.Parameter,
            paddingLeft: true
        });
    }

    return result;
});

documents.listen(connection);
connection.listen();
