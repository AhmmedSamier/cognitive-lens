import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';
import { ComplexityTreeProvider } from './ComplexityTreeProvider';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

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

  client.start();

  const complexityTreeProvider = new ComplexityTreeProvider();
  vscode.window.registerTreeDataProvider('cognitiveComplexity.explorer', complexityTreeProvider);

  // Cache to store complexities for quick switching
  const complexityCache = new Map<string, any[]>();

  // Listen for notifications from the server
  client.onReady().then(() => {
      client.onNotification('cognitive-complexity/fileAnalyzed', (params) => {
          // Normalize URI
          const paramUri = vscode.Uri.parse(params.uri).toString();
          complexityCache.set(paramUri, params.complexities);

          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor) {
              const activeUri = activeEditor.document.uri.toString();

              // Normalize comparison
              if (activeUri === paramUri || decodeURIComponent(activeUri) === decodeURIComponent(paramUri)) {
                  complexityTreeProvider.refresh(params.complexities);
              }
          }
      });
  });

  // Also update when active editor changes (request refresh)
  vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
          const activeUri = editor.document.uri.toString();
          // Try exact match or decoded match
          let cached = complexityCache.get(activeUri);
          if (!cached) {
              // Try decoding cache keys to find match
              const decodedActive = decodeURIComponent(activeUri);
              for (const [key, value] of complexityCache) {
                  if (decodeURIComponent(key) === decodedActive) {
                      cached = value;
                      break;
                  }
              }
          }

          if (cached) {
              complexityTreeProvider.refresh(cached);
          } else {
              complexityTreeProvider.refresh([]);
          }
      }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('cognitive-complexity.generateReport', async () => {
       // We'll implement this to call the server or CLI
       vscode.window.showInformationMessage('Generating Cognitive Complexity Report...');

       // Since the logic is heavy and requires parsing all files, we should delegate this to the Language Server
       // to avoid blocking the extension host, or spawn a process.
       // For now, let's verify we can trigger it.
       try {
           if (client) {
               // We can send a custom request to the server to generate the report
               const report = await client.sendRequest('cognitive-complexity/generateReport', {
                   rootPath: workspace.workspaceFolders?.[0].uri.fsPath
               });

               // Show the report in a webview
               const panel = vscode.window.createWebviewPanel(
                   'cognitiveComplexityReport',
                   'Cognitive Complexity Report',
                   vscode.ViewColumn.One,
                   { enableScripts: true }
               );
               panel.webview.html = report as string;
           }
       } catch (e) {
           vscode.window.showErrorMessage(`Failed to generate report: ${e}`);
       }
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
