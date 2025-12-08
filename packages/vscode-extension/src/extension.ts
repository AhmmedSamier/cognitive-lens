import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  // We need to point to the built server file.
  // Since we are in a monorepo, and we want to bundle everything for the extension,
  // we might want to bundle the server as well, or point to it.

  // Strategy: Bundle the server into `dist/server.js` in the vscode-extension package,
  // OR point to `packages/language-server/dist/server.js`.

  // For simplicity and portability of the VSIX, we should bundle the server.
  // But for now, let's assume we run in dev mode or we have a build step that copies it.
  // Actually, let's configure `tsup` to bundle the server too.

  // But wait, `extension.ts` runs in VS Code Extension Host.
  // `server.ts` runs in a separate Node process.

  // Let's assume we produce `dist/extension.js` and `dist/server.js`.

  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // If the file doesn't exist, we might be in dev mode pointing to source?
  // No, `bun run package` should build both.

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
    documentSelector: [{ scheme: 'file', language: 'typescript' }, { scheme: 'file', language: 'typescriptreact' }],
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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
