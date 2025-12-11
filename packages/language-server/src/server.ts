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
    Position,
    Diagnostic,
    DiagnosticSeverity
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import * as ts from 'typescript';
import { calculateComplexity, MethodComplexity } from '@cognitive-complexity/core';
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';

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

            // Read wasm file manually to avoid resolution issues in bundled environment
            if (!fs.existsSync(treeSitterWasmPath)) {
                throw new Error(`tree-sitter.wasm not found at ${treeSitterWasmPath}`);
            }
            const wasmBuffer = fs.readFileSync(treeSitterWasmPath);

            await Parser.init({
                wasmBinary: wasmBuffer
            });

            csharpParser = new Parser();
            // Determine path to wasm.
            // In bundled extension, it should be adjacent to the server file or in a known location.
            // We will assume it is in the same directory as this script.
            const csharpWasmPath = path.resolve(__dirname, 'tree-sitter-c_sharp.wasm');
            connection.console.log(`Loading C# grammar from ${csharpWasmPath}`);

            const lang = await Language.load(csharpWasmPath);
            csharpParser.setLanguage(lang);
            parserInitialized = true;
            connection.console.log('C# Parser initialized successfully');
        } catch (e) {
            connection.console.error(`Failed to initialize C# parser: ${e}`);
            // Log stack trace if available
            if (e instanceof Error && e.stack) {
                connection.console.error(e.stack);
            }
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

interface CognitiveComplexitySettings {
    threshold: {
        warning: number;
        error: number;
    };
}

const defaultSettings: CognitiveComplexitySettings = {
    threshold: {
        warning: 15,
        error: 30
    }
};

let globalSettings: CognitiveComplexitySettings = defaultSettings;

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
                     // Already logged
                     return [];
                 }
             } else {
                 initParser();
                 try {
                    await initPromise;
                 } catch (e) {
                     return [];
                 }
             }
        }

        if (!parserInitialized || !csharpParser) {
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

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
    } else {
        globalSettings = <CognitiveComplexitySettings>(
            (change.settings.cognitiveComplexity || defaultSettings)
        );
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    const settings = await getDocumentSettings(textDocument.uri);

    const complexities = await getComplexity(textDocument);
    const diagnostics: Diagnostic[] = [];

    for (const complexity of complexities) {
        if (complexity.score >= settings.threshold.warning) {
            const start = textDocument.positionAt(complexity.startIndex);
            const end = textDocument.positionAt(complexity.endIndex);

            // Limit range to the first line (method signature)
            // Or ideally, just the method name if we had that location.
            // Since startIndex/endIndex covers the whole method block, we need to be careful.
            // For now, let's just highlight the first line of the method definition.

            let range = { start, end };

            // Try to approximate the method signature line
            if (end.line > start.line) {
                 const lineText = textDocument.getText({
                     start: { line: start.line, character: 0 },
                     end: { line: start.line + 1, character: 0 }
                 });
                 // Use line length to stay within LSP bounds
                 range.end = { line: start.line, character: lineText.length };
            }

            const severity = complexity.score >= settings.threshold.error
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning;

            const diagnostic: Diagnostic = {
                severity,
                range,
                message: `Cognitive Complexity is ${complexity.score} (threshold: ${
                    severity === DiagnosticSeverity.Error
                        ? settings.threshold.error
                        : settings.threshold.warning
                })`,
                source: 'Cognitive Complexity'
            };
            diagnostics.push(diagnostic);
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function getDocumentSettings(resource: string): Promise<CognitiveComplexitySettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    // For now return global configuration from client
    return connection.workspace.getConfiguration({
        scopeUri: resource,
        section: 'cognitiveComplexity'
    });
}

documents.onDidChangeContent(async change => {
    await validateTextDocument(change.document);
});

connection.onCodeLens(async (params: CodeLensParams): Promise<CodeLens[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    try {
        const complexities = await getComplexity(document);
        let settings = defaultSettings;
        try {
            settings = await getDocumentSettings(document.uri);
            if (!settings || !settings.threshold) {
                settings = defaultSettings;
            }
        } catch (e) {
            // Fallback to default settings
            connection.console.warn(`Failed to get settings, using defaults: ${e}`);
            settings = defaultSettings;
        }

        return complexities.map(c => {
            // Find start position
            // Using startIndex/endIndex from new generic interface
            const start = document.positionAt(c.startIndex);
            const end = document.positionAt(c.endIndex);

            let icon = '🟢';
            if (c.score >= settings.threshold.error) {
                icon = '🔴';
            } else if (c.score >= settings.threshold.warning) {
                icon = '🟡';
            }

            return {
                range: { start, end },
                command: {
                    title: `${icon} Cognitive Complexity: ${c.score}`,
                    command: '',
                    arguments: []
                },
                data: c.name
            };
        });
    } catch (e) {
        connection.console.error(`Error in onCodeLens: ${e}`);
        return [];
    }
});

connection.onCodeLensResolve((codeLens: CodeLens): CodeLens => {
    return codeLens;
});

// Use connection.languages.inlayHint.on instead of connection.onInlayHint
connection.languages.inlayHint.on(async (params: InlayHintParams): Promise<InlayHint[]> => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            // connection.console.log(`Document not found: ${params.textDocument.uri}`);
            return [];
        }

        const complexities = await getComplexity(document);
        let settings = defaultSettings;
        try {
            settings = await getDocumentSettings(document.uri);
            if (!settings || !settings.threshold) {
                settings = defaultSettings;
            }
        } catch (e) {
             connection.console.warn(`Failed to get settings for inlay hints, using defaults: ${e}`);
             settings = defaultSettings;
        }

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
        if (method.isCallback) continue;

        const startPos = document.positionAt(method.startIndex);
        const line = startPos.line;

        if (line < startLine || line > endLine) continue;

        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        let icon = '🟢';
        if (method.score >= settings.threshold.error) {
            icon = '🔴';
        } else if (method.score >= settings.threshold.warning) {
            icon = '🟡';
        }

        result.push({
            position: { line, character: len },
            label: ` ${icon} Cognitive Complexity: ${method.score}`,
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

        return result;
    } catch (e) {
        connection.console.error(`Error in onInlayHint: ${e}`);
        return [];
    }
});

documents.listen(connection);
connection.listen();
