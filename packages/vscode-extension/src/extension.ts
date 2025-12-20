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

  // Listen for notifications from the server
  client.onReady().then(() => {
      client.onNotification('cognitive-complexity/fileAnalyzed', (params) => {
          if (vscode.window.activeTextEditor?.document.uri.toString() === params.uri) {
              complexityTreeProvider.refresh(params.complexities);
          }
      });
  });

  // Also update when active editor changes (request refresh)
  vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && client) {
           // We might want to request the complexity for this file
           // But since the server analyzes on open, we should wait for the notification.
           // Alternatively, we can assume the server has it cached.
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
