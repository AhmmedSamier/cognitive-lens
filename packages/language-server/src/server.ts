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
import { Parser } from 'web-tree-sitter';
import * as path from 'path';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

let csharpParser: Parser | undefined;
let parserInitialized = false;
let initPromise: Promise<void> | undefined;

// Initialize web-tree-sitter
async function initParser() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const treeSitterWasmPath = path.resolve(__dirname, 'tree-sitter.wasm');
            connection.console.log(`Initializing Parser with ${treeSitterWasmPath}`);

            await Parser.init({
                locateFile: () => treeSitterWasmPath
            });

            csharpParser = new Parser();
            // Determine path to wasm.
            // In bundled extension, it should be adjacent to the server file or in a known location.
            // We will assume it is in the same directory as this script.
            const wasmPath = path.resolve(__dirname, 'tree-sitter-c_sharp.wasm');
            connection.console.log(`Loading C# grammar from ${wasmPath}`);

            const lang = await Parser.Language.load(wasmPath);
            csharpParser.setLanguage(lang);
            parserInitialized = true;
            connection.console.log('C# Parser initialized successfully');
        } catch (e) {
            connection.console.error(`Failed to initialize C# parser: ${e}`);
            throw e;
        }
    })();

    return initPromise;
}

connection.onInitialize(async (params: InitializeParams) => {
    // Start parser init
    initParser().catch(e => {
        // Logged inside
    });

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

async function getComplexity(textDocument: TextDocument): Promise<MethodComplexity[]> {
    const cached = complexityCache.get(textDocument.uri);
    if (cached && cached.version === textDocument.version) {
        return cached.complexities;
    }

    const text = textDocument.getText();
    let complexities: MethodComplexity[] = [];

    if (textDocument.languageId === 'csharp') {
        if (!parserInitialized) {
             // Try to wait for initialization
             if (initPromise) {
                 try {
                     await initPromise;
                 } catch (e) {
                     connection.console.warn('C# parser initialization failed, skipping complexity calculation');
                     return [];
                 }
             } else {
                 // Should not happen if onInitialize called it, but safety check
                 initParser();
                 try {
                    await initPromise;
                 } catch (e) {
                     return [];
                 }
             }
        }

        if (!parserInitialized || !csharpParser) {
            connection.console.warn('C# parser not ready yet (unexpected state)');
            return [];
        }

        try {
            const tree = csharpParser.parse(text);
            complexities = await calculateComplexity(tree, 'csharp');
            tree.delete(); // Clean up tree
        } catch (e) {
            connection.console.error(`Error calculating C# complexity: ${e}`);
            return [];
        }
    } else {
        // Default to TypeScript/JavaScript
        const sourceFile = ts.createSourceFile(
            textDocument.uri,
            text,
            ts.ScriptTarget.Latest,
            true
        );
        complexities = await calculateComplexity(sourceFile, 'typescript');
    }

    complexityCache.set(textDocument.uri, { version: textDocument.version, complexities });
    return complexities;
}

documents.onDidChangeContent(async change => {
    await getComplexity(change.document);
});

connection.onCodeLens(async (params: CodeLensParams): Promise<CodeLens[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const complexities = await getComplexity(document);

    return complexities.map(c => {
        // Find start position
        // Using startIndex/endIndex from new generic interface
        const start = document.positionAt(c.startIndex);
        const end = document.positionAt(c.endIndex);

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
connection.languages.inlayHint.on(async (params: InlayHintParams): Promise<InlayHint[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        connection.console.log(`Document not found: ${params.textDocument.uri}`);
        return [];
    }

    // connection.console.log(`Calculating inlay hints for ${params.textDocument.uri} in range ${params.range.start.line}-${params.range.end.line}`);

    const complexities = await getComplexity(document);
    // connection.console.log(`Found ${complexities.length} methods`);

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
        const startPos = document.positionAt(method.startIndex);
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

        const messages = details
            .map(d => d.message)
            .filter(m => m !== 'nesting');

        let uniqueMessages = Array.from(new Set(messages));
        if (uniqueMessages.length === 0 && totalScore > 0) {
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

    // connection.console.log(`Returning ${result.length} inlay hints`);
    return result;
});

documents.listen(connection);
connection.listen();
