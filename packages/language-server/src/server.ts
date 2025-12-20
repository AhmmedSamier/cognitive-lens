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
    DiagnosticSeverity,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    DidCloseTextDocumentParams
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { calculateComplexity, MethodComplexity } from '@cognitive-complexity/core';
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import {
    CognitiveComplexitySettings,
    defaultSettings,
    computeDiagnostics,
    computeInlayHints,
    computeCodeLenses
} from './logic';
import { IncrementalParser } from './IncrementalParser';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

let csharpParser: Parser | undefined;
let typescriptParser: Parser | undefined;
let tsxParser: Parser | undefined;
let parserInitialized = false;
let initPromise: Promise<void> | undefined;

let incrementalParser: IncrementalParser | undefined;

// Initialize web-tree-sitter
async function initParser() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const treeSitterWasmPath = path.resolve(__dirname, 'tree-sitter.wasm');
            connection.console.log(`Initializing Parser with ${treeSitterWasmPath}`);

            if (!fs.existsSync(treeSitterWasmPath)) {
                throw new Error(`tree-sitter.wasm not found at ${treeSitterWasmPath}`);
            }
            const wasmBuffer = fs.readFileSync(treeSitterWasmPath);

            await Parser.init({
                wasmBinary: wasmBuffer
            });

            // Load C#
            csharpParser = new Parser();
            const csharpWasmPath = path.resolve(__dirname, 'tree-sitter-c_sharp.wasm');
            connection.console.log(`Loading C# grammar from ${csharpWasmPath}`);
            const csharpLang = await Language.load(csharpWasmPath);
            csharpParser.setLanguage(csharpLang);

            // Load TypeScript
            typescriptParser = new Parser();
            const typescriptWasmPath = path.resolve(__dirname, 'tree-sitter-typescript.wasm');
            connection.console.log(`Loading TypeScript grammar from ${typescriptWasmPath}`);
            const typescriptLang = await Language.load(typescriptWasmPath);
            typescriptParser.setLanguage(typescriptLang);

            // Load TSX
            tsxParser = new Parser();
            const tsxWasmPath = path.resolve(__dirname, 'tree-sitter-tsx.wasm');
            connection.console.log(`Loading TSX grammar from ${tsxWasmPath}`);
            const tsxLang = await Language.load(tsxWasmPath);
            tsxParser.setLanguage(tsxLang);

            incrementalParser = new IncrementalParser({
                csharp: csharpParser,
                typescript: typescriptParser,
                tsx: tsxParser
            });

            parserInitialized = true;
            connection.console.log('Parsers initialized successfully');
        } catch (e) {
            connection.console.error(`Failed to initialize parser: ${e}`);
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

let globalSettings: CognitiveComplexitySettings = defaultSettings;

const complexityCache = new Map<string, { version: number, complexities: MethodComplexity[] }>();
const complexityPromises = new Map<string, { version: number, promise: Promise<MethodComplexity[]> }>();
const validationTimers = new Map<string, NodeJS.Timeout>();
const settingsCache = new Map<string, Promise<CognitiveComplexitySettings>>();

// Handle document lifecycle for incremental parsing
connection.onDidOpenTextDocument(async (params: DidOpenTextDocumentParams) => {
    if (!parserInitialized) await initParser();
    if (incrementalParser) {
        await incrementalParser.handleOpen(params);
    }
});

connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
    // Synchronously update the tree
    if (incrementalParser) {
        try {
            incrementalParser.handleChange(params);
        } catch (e) {
            connection.console.error(`Error in handle change: ${e}`);
        }
    }
});

connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
    if (incrementalParser) {
        incrementalParser.handleClose(params);
    }
    complexityCache.delete(params.textDocument.uri);
    complexityPromises.delete(params.textDocument.uri);
});

function validateTextDocumentDebounced(textDocument: TextDocument) {
    const uri = textDocument.uri;
    if (validationTimers.has(uri)) {
        clearTimeout(validationTimers.get(uri));
    }
    validationTimers.set(uri, setTimeout(() => {
        validationTimers.delete(uri);
        validateTextDocument(textDocument);
    }, 500)); // 500ms delay
}

async function getComplexity(textDocument: TextDocument): Promise<MethodComplexity[]> {
    const cached = complexityCache.get(textDocument.uri);
    if (cached && cached.version === textDocument.version) {
        return cached.complexities;
    }

    // Check for pending calculation for the *same* version
    const pending = complexityPromises.get(textDocument.uri);
    if (pending && pending.version === textDocument.version) {
        return pending.promise;
    }

    const promise = (async () => {
        if (!parserInitialized) {
             if (initPromise) {
                 try { await initPromise; } catch(e) { return []; }
             } else {
                 await initParser(); // Await initParser
                 try { await initPromise; } catch(e) { return []; }
             }
        }

        if (!parserInitialized || !incrementalParser) return [];

        let complexities: MethodComplexity[] = [];

        try {
            // Retrieve tree from IncrementalParser
            // It should be up-to-date if onDidChangeTextDocument was handled
            let tree = incrementalParser.getTree(textDocument.uri);
            const treeVersion = incrementalParser.getVersion(textDocument.uri);

            // Check if tree is missing OR if it's out of sync (version mismatch)
            // Note: treeVersion might be undefined if tree is missing.
            if (!tree || (treeVersion !== undefined && treeVersion !== textDocument.version)) {
                // Try to recover by simulating handleOpen.
                // This can happen if didOpen was missed/failed OR if didChange wasn't processed correctly.
                connection.console.warn(`Tree not found or out of sync for ${textDocument.uri} (TreeVer: ${treeVersion}, DocVer: ${textDocument.version}). Recovering...`);
                await incrementalParser.handleOpen({
                    textDocument: {
                        uri: textDocument.uri,
                        languageId: textDocument.languageId,
                        version: textDocument.version,
                        text: textDocument.getText()
                    }
                });
                tree = incrementalParser.getTree(textDocument.uri);
            }

            if (tree) {
                // Calculate complexity using the cached (and incrementally updated) tree
                const languageId = textDocument.languageId.toLowerCase();
                if (languageId === 'csharp') {
                    complexities = await calculateComplexity(tree, 'csharp');
                } else if (languageId === 'typescript' || languageId === 'javascript' ||
                           languageId === 'typescriptreact' || languageId === 'javascriptreact') {
                    complexities = await calculateComplexity(tree, 'typescript');
                }
            }
        } catch (e) {
            connection.console.error(`Error calculating complexity: ${e}`);
        }

        complexityCache.set(textDocument.uri, { version: textDocument.version, complexities });

        const currentPending = complexityPromises.get(textDocument.uri);
        if (currentPending && currentPending.version === textDocument.version) {
            complexityPromises.delete(textDocument.uri);
        }
        return complexities;
    })();

    complexityPromises.set(textDocument.uri, { version: textDocument.version, promise });
    return promise;
}

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        settingsCache.clear();
    } else {
        globalSettings = <CognitiveComplexitySettings>(
            (change.settings.cognitiveComplexity || defaultSettings)
        );
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocumentDebounced);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    try {
        let settings = defaultSettings;
        try {
            settings = await getDocumentSettings(textDocument.uri);
            if (!settings || !settings.threshold) {
                settings = defaultSettings;
            }
        } catch (e) {
            connection.console.warn(`Failed to get settings for diagnostics, using defaults: ${e}`);
            settings = defaultSettings;
        }

        const complexities = await getComplexity(textDocument);

        // Notify client about analysis for gutter icons etc
        connection.sendNotification('cognitive-complexity/fileAnalyzed', {
            uri: textDocument.uri,
            complexities
        });

        const diagnostics = computeDiagnostics(textDocument, complexities, settings);

        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (e) {
        connection.console.error(`Error in validateTextDocument: ${e}`);
    }
}

async function getDocumentSettings(resource: string): Promise<CognitiveComplexitySettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = settingsCache.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'cognitiveComplexity'
        }).then(settings => {
            return { ...defaultSettings, ...settings };
        });
        settingsCache.set(resource, result);
    }
    return result;
}

documents.onDidChangeContent(change => {
    validateTextDocumentDebounced(change.document);
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

        return computeCodeLenses(document, complexities, settings);
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

        return computeInlayHints(document, complexities, settings, params.range);
    } catch (e) {
        connection.console.error(`Error in onInlayHint: ${e}`);
        return [];
    }
});

documents.listen(connection);
connection.listen();
