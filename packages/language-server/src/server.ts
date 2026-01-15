import { calculateComplexity, MethodComplexity } from '@cognitive-complexity/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CodeLens,
  CodeLensParams,
  createConnection,
  DidChangeConfigurationNotification,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  InlayHint,
  InlayHintParams,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { Language, Parser } from 'web-tree-sitter';
import { IncrementalParser } from './IncrementalParser';
import { GitService } from './gitService';
import {
  CognitiveComplexitySettings,
  computeCodeLenses,
  computeDiagnostics,
  computeHover,
  computeInlayHints,
  defaultSettings,
} from './logic';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const gitService = new GitService();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let csharpParser: Parser | undefined;
let typescriptParser: Parser | undefined;
let tsxParser: Parser | undefined;
let dartParser: Parser | undefined;
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
        wasmBinary: wasmBuffer,
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

      // Load Dart
      dartParser = new Parser();
      const dartWasmPath = path.resolve(__dirname, 'tree-sitter-dart.wasm');
      connection.console.log(`Loading Dart grammar from ${dartWasmPath}`);
      const dartLang = await Language.load(dartWasmPath);
      dartParser.setLanguage(dartLang);

      incrementalParser = new IncrementalParser({
        csharp: csharpParser,
        typescript: typescriptParser,
        tsx: tsxParser,
        dart: dartParser,
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
  initParser().catch(() => {
    // Logged inside
  });

  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeLensProvider: {
        resolveProvider: true,
      },
      inlayHintProvider: {
        resolveProvider: false,
      },
      hoverProvider: true,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }

  // Check if git is available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process');
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const gitVersion = execSync('git --version').toString().trim();
    connection.console.log(`[LSP] Git detected: ${gitVersion}`);
    connection.console.log(
      `[LSP] Server ready and listening. Deltas will be calculated for Git-tracked files.`,
    );
  } catch (e) {
    connection.console.warn(
      `[LSP] Git not found or failed to execute. Deltas will not be available. Error: ${e}`,
    );
  }
});

let globalSettings: CognitiveComplexitySettings = defaultSettings;

const complexityCache = new Map<string, { version: number; complexities: MethodComplexity[] }>();
const complexityPromises = new Map<
  string,
  { version: number; promise: Promise<MethodComplexity[]> }
>();
const validationTimers = new Map<string, NodeJS.Timeout>();
const settingsCache = new Map<string, Promise<CognitiveComplexitySettings>>();
const baseComplexityCache = new Map<string, MethodComplexity[]>();

gitService.on('headChanged', (root) => {
  connection.console.log(
    `[Git] Branch/HEAD change detected in ${root}. Clearing base complexity cache.`,
  );
  baseComplexityCache.clear();
  documents.all().forEach(validateTextDocumentDebounced);
});

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
  settingsCache.delete(params.textDocument.uri);
  baseComplexityCache.delete(params.textDocument.uri);

  // Clear any pending validation to avoid resurrection
  const timer = validationTimers.get(params.textDocument.uri);
  if (timer) {
    clearTimeout(timer);
    validationTimers.delete(params.textDocument.uri);
  }
});

function validateTextDocumentDebounced(textDocument: TextDocument) {
  const uri = textDocument.uri;
  if (validationTimers.has(uri)) {
    clearTimeout(validationTimers.get(uri));
  }
  validationTimers.set(
    uri,
    setTimeout(() => {
      validationTimers.delete(uri);
      validateTextDocument(textDocument);
    }, 500),
  ); // 500ms delay
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

  const promise = performComplexityCalculation(textDocument);

  complexityPromises.set(textDocument.uri, { version: textDocument.version, promise });
  return promise;
}

async function performComplexityCalculation(textDocument: TextDocument): Promise<MethodComplexity[]> {
  if (!(await ensureParserForAnalysis())) {
    return [];
  }

  if (!incrementalParser) return [];

  let complexities: MethodComplexity[] = [];

  try {
    const tree = await getOrRecoverTree(textDocument);
    if (!tree) return [];

    const languageId = textDocument.languageId.toLowerCase();

    // We already have a switch for this in analyzeContent, but here we work on 'tree'
    // Reuse the calc logic if possible, but tree is already parsed here.
    if (languageId === 'csharp') {
      complexities = await calculateComplexity(tree, 'csharp');
    } else if (languageId === 'dart') {
      complexities = await calculateComplexity(tree, 'dart');
    } else if (
      languageId === 'typescript' ||
      languageId === 'javascript' ||
      languageId === 'typescriptreact' ||
      languageId === 'javascriptreact'
    ) {
      complexities = await calculateComplexity(tree, 'typescript');
    }
  } catch (e) {
    connection.console.error(`Error calculating complexity: ${e}`);
  }

  complexityCache.set(textDocument.uri, { version: textDocument.version, complexities });

  // Calculate deltas if not already cached
  await calculateGitDeltas(textDocument, complexities);

  const currentPending = complexityPromises.get(textDocument.uri);
  if (currentPending && currentPending.version === textDocument.version) {
    complexityPromises.delete(textDocument.uri);
  }
  return complexities;
}

async function getOrRecoverTree(textDocument: TextDocument): Promise<any> {
  if (!incrementalParser) return null;

  // Retrieve tree from IncrementalParser
  // It should be up-to-date if onDidChangeTextDocument was handled
  let tree = incrementalParser.getTree(textDocument.uri);
  const treeVersion = incrementalParser.getVersion(textDocument.uri);

  // Check if tree is missing OR if it's out of sync (version mismatch)
  // Note: treeVersion might be undefined if tree is missing.
  if (!tree || (treeVersion !== undefined && treeVersion !== textDocument.version)) {
    // Try to recover by simulating handleOpen.
    // This can happen if didOpen was missed/failed OR if didChange wasn't processed correctly.
    connection.console.warn(
      `Tree not found or out of sync for ${textDocument.uri} (TreeVer: ${treeVersion}, DocVer: ${textDocument.version}). Recovering...`,
    );
    await incrementalParser.handleOpen({
      textDocument: {
        uri: textDocument.uri,
        languageId: textDocument.languageId,
        version: textDocument.version,
        text: textDocument.getText(),
      },
    });
    tree = incrementalParser.getTree(textDocument.uri);
  }
  return tree;
}

async function calculateGitDeltas(textDocument: TextDocument, complexities: MethodComplexity[]) {
  try {
    if (textDocument.uri.startsWith('file://')) {
      const fsPath = fileURLToPath(textDocument.uri);
      if (!baseComplexityCache.has(textDocument.uri)) {
        connection.console.log(`[Git] Fetching base complexity for ${fsPath}`);
        const baseContentBuffer = await gitService.getGitHeadContent(fsPath);
        if (baseContentBuffer) {
          const baseContent = baseContentBuffer.toString('utf8');
          const baseComplexities = await analyzeContent(baseContent, textDocument.languageId);
          baseComplexityCache.set(textDocument.uri, baseComplexities);
          connection.console.log(
            `[Git] Cached base complexity for ${fsPath} (${baseComplexities.length} methods)`,
          );
        } else {
          connection.console.log(`[Git] No base content found for ${fsPath}`);
          baseComplexityCache.set(textDocument.uri, []);
        }
      }

      const baseComplexities = baseComplexityCache.get(textDocument.uri) || [];
      if (baseComplexities.length > 0) {
        let deltasCalculated = 0;
        complexities.forEach((current) => {
          if (current.isCallback) return;
          const base = baseComplexities.find((b) => b.name === current.name);
          if (base) {
            current.complexityDelta = current.score - base.score;
            if (current.complexityDelta !== 0) deltasCalculated++;
          }
        });
        if (deltasCalculated > 0) {
          connection.console.log(
            `[Git] Calculated ${deltasCalculated} non-zero deltas for ${fsPath}`,
          );
        }
      }
    }
  } catch (e) {
    connection.console.error(`[Git] Error calculating deltas for ${textDocument.uri}: ${e}`);
    baseComplexityCache.set(textDocument.uri, []);
  }
}

connection.onDidChangeConfiguration((change) => {
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
      complexities,
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
    result = connection.workspace
      .getConfiguration({
        scopeUri: resource,
        section: 'cognitiveComplexity',
      })
      .then((settings) => {
        return { ...defaultSettings, ...settings };
      });
    settingsCache.set(resource, result);
  }
  return result;
}

documents.onDidChangeContent((change) => {
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

connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  try {
    const complexities = await getComplexity(document);
    return computeHover(document, params.position, complexities);
  } catch (e) {
    connection.console.error(`Error in onHover: ${e}`);
    return null;
  }
});

// Use connection.languages.inlayHint.on instead of connection.onInlayHint
connection.languages.inlayHint.on(async (params: InlayHintParams): Promise<InlayHint[]> => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
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


async function analyzeContent(text: string, languageId: string): Promise<MethodComplexity[]> {
  if (!(await ensureParserForAnalysis())) {
    return [];
  }

  const parser = selectParser(languageId);
  if (!parser) return [];

  return executeAnalysis(parser, text, languageId);
}

async function ensureParserForAnalysis(): Promise<boolean> {
  if (!parserInitialized) {
    if (initPromise) {
      try {
        await initPromise;
      } catch {
        return false;
      }
    } else {
      await initParser();
      try {
        await initPromise;
      } catch {
        return false;
      }
    }
  }
  return parserInitialized;
}

function selectParser(languageId: string): Parser | undefined {
  const normalizedLangId = languageId.toLowerCase();

  if (normalizedLangId === 'csharp') return csharpParser;
  if (normalizedLangId === 'dart') return dartParser;
  if (['typescript', 'javascript'].includes(normalizedLangId)) return typescriptParser;
  if (['typescriptreact', 'javascriptreact'].includes(normalizedLangId)) return tsxParser;

  return undefined;
}

async function executeAnalysis(
  parser: Parser,
  text: string,
  languageId: string
): Promise<MethodComplexity[]> {
  let tree: any;
  try {
    tree = parser.parse(text);
    const normalizedLangId = languageId.toLowerCase();

    if (normalizedLangId === 'csharp') {
      return await calculateComplexity(tree, 'csharp');
    } else if (normalizedLangId === 'dart') {
      return await calculateComplexity(tree, 'dart');
    } else {
      return await calculateComplexity(tree, 'typescript');
    }
  } catch (e) {
    connection.console.error(`Error in analyzeContent: ${e}`);
    return [];
  } finally {
    if (tree) {
      tree.delete();
    }
  }
}

// Handler for ad-hoc analysis (e.g., for Git HEAD comparison)
connection.onRequest(
  'cognitive-complexity/analyzeText',
  async (params: { text: string; languageId: string }): Promise<MethodComplexity[]> => {
    return analyzeContent(params.text, params.languageId);
  },
);

// Handler for file-based analysis (e.g., project report)
connection.onRequest(
  'cognitive-complexity/analyzeFile',
  async (params: {
    uri: string;
    languageId: string;
    content?: string;
  }): Promise<MethodComplexity[]> => {
    try {
      // ... existing analyzeFile logic ...
      // 1. Use provided content if available (Optimization: avoids double I/O)
      if (params.content !== undefined) {
        return analyzeContent(params.content, params.languageId);
      }

      // 2. Check if document is already open/managed
      const document = documents.get(params.uri);
      if (document) {
        return analyzeContent(document.getText(), params.languageId);
      }

      // 3. If not managed and no content provided, read from disk (Fallback)
      // Note: This assumes file scheme.
      if (params.uri.startsWith('file://')) {
        const fsPath = fileURLToPath(params.uri);
        if (fs.existsSync(fsPath)) {
          const text = fs.readFileSync(fsPath, 'utf-8');
          return analyzeContent(text, params.languageId);
        }
      }

      connection.console.warn(`Could not resolve content for analyzeFile: ${params.uri}`);
      return [];
    } catch (e) {
      connection.console.error(`Error in analyzeFile: ${e}`);
      return [];
    }
  },
);

// Handler for filtering ignored files
connection.onRequest(
  'cognitive-complexity/filterIgnored',
  async (params: { filePaths: string[] }): Promise<string[]> => {
    try {
      return await gitService.filterIgnored(params.filePaths);
    } catch (e) {
      connection.console.error(`Error in filterIgnored: ${e}`);
      return params.filePaths;
    }
  },
);

documents.listen(connection);
connection.listen();
