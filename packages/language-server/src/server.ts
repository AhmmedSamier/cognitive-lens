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

connection.onInlayHint((params: InlayHintParams): InlayHint[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const complexities = getComplexity(document);
    const hints: InlayHint[] = [];

    for (const method of complexities) {
        for (const detail of method.details) {
            // Check if line is within range requested (optional optimization)

            // The detail has a line number. We need to convert it to a Position.
            // But wait, `detail.line` comes from `sourceFile.getLineAndCharacterOfPosition`.
            // This is 0-indexed line number.

            // We want to place the hint at the end of the line, or at the structural element?
            // The prompt says "details for each line about how this line contributes".
            // Typically placed at the end of the line or next to the token.
            // "Show details ... as inlay hints".
            // If I place it at the end of the line, it's clear.

            // Get the line content to find the end position?
            // Or just append to the token position if we have it?
            // My `detail` only has `line`. I should probably have stored the position or node.

            // Let's improve `core` to return position/node in details, OR just assume end of line.
            // Getting end of line from `TextDocument`:
            const lineContent = document.getText({
                start: { line: detail.line, character: 0 },
                end: { line: detail.line + 1, character: 0 }
            });
            const lineLength = lineContent.trimEnd().length; // Trim newline

            // Position for hint
            const position = { line: detail.line, character: lineLength + 1 }; // Add a space

            // Format: (+score message)
            // If multiple details on same line, we might want to group them?
            // My loop adds them individually. If they are at same position, VS Code might stack them.

            hints.push({
                position: { line: detail.line, character: 1000 }, // VS Code usually clamps this to end of line if too large?
                // Better: calculate real length.
                // Or: use paddingLeft?
                label: ` (+${detail.score} ${detail.message})`,
                kind: InlayHintKind.Type,
                paddingLeft: true
            });
        }
    }

    // De-duplicate hints on same line if possible?
    // If I have (+1 if) and (+1 nesting) on same line.
    // I will emit two hints.
    // Placement: I used character 1000. They might overlap.
    // Better: Sort by line. For each line, concatenate?
    // But InlayHint is an object.
    // VS Code displays them in order?

    // Let's improve placement.
    // I should get the actual end of line character index.

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
        // Construct label
        // " (+1 if) (+1 nesting)"
        const label = details.map(d => `(+${d.score} ${d.message})`).join(' ');

        // Find end of line
        const offset = document.offsetAt({ line: line + 1, character: 0 }) - 1; // Before newline
        // If line is empty, offset might be wrong.
        // Safer:
        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        result.push({
            position: { line, character: len },
            label: ` ${label}`, // Add leading space
            kind: InlayHintKind.Parameter,
            paddingLeft: true
        });
    }

    return result;
});

documents.listen(connection);
connection.listen();
