import * as path from 'path';
import { workspace, ExtensionContext, window, Range, Uri, TextEditorDecorationType, DecorationRangeBehavior, TextEditor, commands, Selection, TreeView } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';
import { MethodComplexity } from './types';
import { ComplexityTreeDataProvider } from './ComplexityTreeDataProvider';

let client: LanguageClient;

// SVGs for gutter icons
const greenIcon = Uri.parse('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PGNpcmNsZSBjeD0iNSIgY3k9IjUiIHI9IjQiIGZpbGw9ImdyZWVuIiAvPjwvc3ZnPg==');
const yellowIcon = Uri.parse('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PGNpcmNsZSBjeD0iNSIgY3k9IjUiIHI9IjQiIGZpbGw9Im9yYW5nZSIgLz48L3N2Zz4=');
const redIcon = Uri.parse('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PGNpcmNsZSBjeD0iNSIgY3k9IjUiIHI9IjQiIGZpbGw9InJlZCIgLz48L3N2Zz4=');

let greenDecorationType: TextEditorDecorationType | undefined;
let yellowDecorationType: TextEditorDecorationType | undefined;
let redDecorationType: TextEditorDecorationType | undefined;

// Cache complexities to restore decorations on tab switch
const complexityCache = new Map<string, MethodComplexity[]>();
let treeDataProvider: ComplexityTreeDataProvider;
let treeView: TreeView<MethodComplexity>;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'csharp' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  client = new LanguageClient(
    'cognitiveComplexity',
    'Cognitive Complexity',
    serverOptions,
    clientOptions
  );

  // Initialize decoration types
  createDecorations();

  // Initialize Tree Data Provider
  treeDataProvider = new ComplexityTreeDataProvider(complexityCache);
  treeView = window.createTreeView('cognitiveComplexityListView', {
      treeDataProvider: treeDataProvider,
      showCollapseAll: true
  });

  // Register command for navigation
  context.subscriptions.push(commands.registerCommand('cognitive-complexity.navigateToMethod', (method: MethodComplexity) => {
    const editor = window.activeTextEditor;
    if (editor) {
        // Verify if the method belongs to the current editor
        // Ideally we check URI, but the tree view is updated based on active editor, so it should be fine.
        // However, if user switches tabs quickly, we might want to check if complexityCache matches?
        // But method object is just data.

        const start = editor.document.positionAt(method.startIndex);
        const end = editor.document.positionAt(method.endIndex);
        const range = new Range(start, end);

        editor.selection = new Selection(start, start);
        editor.revealRange(range, 1); // TextEditorRevealType.InCenter = 1
    }
  }));

  client.start().then(() => {
    client.onNotification('cognitive-complexity/fileAnalyzed', (params: { uri: string, complexities: MethodComplexity[] }) => {
        // Update cache
        complexityCache.set(params.uri, params.complexities);
        // Update visible editors
        updateDecorations(params.uri, params.complexities);
        // Refresh tree view
        treeDataProvider.refresh();
    });
  });

  // Handle active editor change (tab switch)
  window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
          const uri = editor.document.uri.toString();
          const cached = complexityCache.get(uri);
          if (cached) {
              updateEditorDecorations(editor, cached);
          }
          treeDataProvider.refresh();
      }
  }, null, context.subscriptions);

  // Handle cursor movement to reveal in tree view
  window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor && treeView.visible) {
          const uri = event.textEditor.document.uri.toString();
          const cached = complexityCache.get(uri);
          if (cached) {
              const position = event.selections[0].active;
              const offset = event.textEditor.document.offsetAt(position);

              const method = cached.find(m => offset >= m.startIndex && offset <= m.endIndex && !m.isCallback);

              if (method) {
                  // Reveal method in tree view without taking focus and selecting it
                  treeView.reveal(method, { select: true, focus: false, expand: true });
              }
          }
      }
  }, null, context.subscriptions);

  // Re-create decorations if configuration changes
  workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('cognitiveComplexity.showGutterIcon') ||
          e.affectsConfiguration('cognitiveComplexity.threshold')) {
          createDecorations();

          // Re-apply to all visible editors
          window.visibleTextEditors.forEach(editor => {
              const uri = editor.document.uri.toString();
              const cached = complexityCache.get(uri);
              if (cached) {
                  updateEditorDecorations(editor, cached);
              }
          });
          treeDataProvider.refresh(); // Threshold changes might affect icon colors
      }
  }, null, context.subscriptions);
}

function createDecorations() {
    // Dispose existing
    if (greenDecorationType) { greenDecorationType.dispose(); greenDecorationType = undefined; }
    if (yellowDecorationType) { yellowDecorationType.dispose(); yellowDecorationType = undefined; }
    if (redDecorationType) { redDecorationType.dispose(); redDecorationType = undefined; }

    const config = workspace.getConfiguration('cognitiveComplexity');
    const showGutter = config.get<boolean>('showGutterIcon', true);

    if (!showGutter) {
        return;
    }

    greenDecorationType = window.createTextEditorDecorationType({
        gutterIconPath: greenIcon,
        gutterIconSize: 'contain',
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    });
    yellowDecorationType = window.createTextEditorDecorationType({
        gutterIconPath: yellowIcon,
        gutterIconSize: 'contain',
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    });
    redDecorationType = window.createTextEditorDecorationType({
        gutterIconPath: redIcon,
        gutterIconSize: 'contain',
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    });
}

function updateDecorations(uri: string, complexities: MethodComplexity[]) {
    // Find all visible editors for this URI (e.g., split view)
    const editors = window.visibleTextEditors.filter(e => e.document.uri.toString() === uri);
    for (const editor of editors) {
        updateEditorDecorations(editor, complexities);
    }
}

function updateEditorDecorations(editor: TextEditor, complexities: MethodComplexity[]) {
    const config = workspace.getConfiguration('cognitiveComplexity', editor.document.uri);
    if (!config.get<boolean>('showGutterIcon', true)) {
        // Clear decorations if disabled for this resource
        if (greenDecorationType) editor.setDecorations(greenDecorationType, []);
        if (yellowDecorationType) editor.setDecorations(yellowDecorationType, []);
        if (redDecorationType) editor.setDecorations(redDecorationType, []);
        return;
    }

    // Ensure decorations exist (global check, but good to be safe)
    if (!greenDecorationType) createDecorations();
    if (!greenDecorationType) return; // Still disabled or failed

    const warningThreshold = config.get<number>('threshold.warning', 15);
    const errorThreshold = config.get<number>('threshold.error', 25);

    const greenRanges: Range[] = [];
    const yellowRanges: Range[] = [];
    const redRanges: Range[] = [];

    for (const method of complexities) {
        if (method.isCallback) continue;

        const startPos = editor.document.positionAt(method.startIndex);
        // We only want the gutter icon on the first line of the method
        const range = new Range(startPos, startPos);

        if (method.score >= errorThreshold) {
            redRanges.push(range);
        } else if (method.score >= warningThreshold) {
            yellowRanges.push(range);
        } else {
             if (method.score > 0) {
                 greenRanges.push(range);
             }
        }
    }

    // Force non-null assertion since we checked earlier
    editor.setDecorations(greenDecorationType!, greenRanges);
    editor.setDecorations(yellowDecorationType!, yellowRanges);
    editor.setDecorations(redDecorationType!, redRanges);
}

export function deactivate(): Thenable<void> | undefined {
  if (greenDecorationType) greenDecorationType.dispose();
  if (yellowDecorationType) yellowDecorationType.dispose();
  if (redDecorationType) redDecorationType.dispose();

  complexityCache.clear();

  if (!client) {
    return undefined;
  }
  return client.stop();
}
