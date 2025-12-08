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
                resolveProvider: false
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

const complexityCache = new Map<string, { version: number, complexities: MethodComplexity[] }>();

function getComplexity(textDocument: TextDocument): MethodComplexity[] {
    const cached = complexityCache.get(textDocument.uri);
    if (cached && cached.version === textDocument.version) {
        return cached.complexities;
    }

    const text = textDocument.getText();
    const sourceFile = ts.createSourceFile(
        textDocument.uri,
        text,
        ts.ScriptTarget.Latest,
        true
    );
    const complexities = calculateComplexity(sourceFile);
    complexityCache.set(textDocument.uri, { version: textDocument.version, complexities });
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
    if (!document) {
        connection.console.log(`Document not found: ${params.textDocument.uri}`);
        return [];
    }

    connection.console.log(`Calculating inlay hints for ${params.textDocument.uri} in range ${params.range.start.line}-${params.range.end.line}`);

    const complexities = getComplexity(document);
    connection.console.log(`Found ${complexities.length} methods`);

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

    const startLine = params.range.start.line;
    const endLine = params.range.end.line;

    // Add method total score as inlay hint
    for (const method of complexities) {
        const startPos = document.positionAt(method.node.getStart());
        const line = startPos.line;

        if (line < startLine || line > endLine) continue;

        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        result.push({
            position: { line, character: len },
            label: ` Cognitive Complexity: ${method.score}`,
            kind: InlayHintKind.Type,
            paddingLeft: true
        });
    }

    for (const [line, details] of hintsByLine) {
        if (line < startLine || line > endLine) continue;

        const totalScore = details.reduce((sum, d) => sum + d.score, 0);
        // Collect unique messages, excluding "nesting" if there are other messages?
        // Actually, just exclude "nesting" from the text label as per request (+2 if).
        // If "nesting" is the ONLY message, we might keep it?
        // But nesting is usually associated with a structural element on the same line.
        // If I have `else` (+1) + `nesting` (+1), I want `(+2 else)`.

        const messages = details
            .map(d => d.message)
            .filter(m => m !== 'nesting');

        // If messages is empty (only nesting?), fallback to 'nesting' or original behavior?
        // With current logic, nesting always comes with something unless it's pure nesting?
        // Pure nesting happens for `else`? No, `else` is "else".

        let uniqueMessages = Array.from(new Set(messages));
        if (uniqueMessages.length === 0 && totalScore > 0) {
            // Should not happen based on current logic, but fallback
             uniqueMessages = ['nesting'];
        }

        const label = `(+${totalScore} ${uniqueMessages.join(', ')})`;

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

    connection.console.log(`Returning ${result.length} inlay hints`);
    return result;
});

documents.listen(connection);
connection.listen();
