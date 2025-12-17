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

        if (!parserInitialized) return [];

        const text = textDocument.getText();
        let complexities: MethodComplexity[] = [];
        let tree: any;

        try {
            if (textDocument.languageId === 'csharp') {
                if (!csharpParser) return [];
                tree = csharpParser.parse(text);
                complexities = await calculateComplexity(tree, 'csharp');
            } else if (textDocument.languageId === 'typescript' || textDocument.languageId === 'javascript') {
                if (!typescriptParser) return [];
                tree = typescriptParser.parse(text);
                complexities = await calculateComplexity(tree, 'typescript');
            } else if (textDocument.languageId === 'typescriptreact' || textDocument.languageId === 'javascriptreact') {
                if (!tsxParser) return [];
                tree = tsxParser.parse(text);
                complexities = await calculateComplexity(tree, 'typescript');
            }
        } catch (e) {
            connection.console.error(`Error calculating complexity: ${e}`);
        } finally {
            if (tree) {
                tree.delete();
            }
        }

        complexityCache.set(textDocument.uri, { version: textDocument.version, complexities });

        // Only remove from promises if it's still the current one (handle race conditions)
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
