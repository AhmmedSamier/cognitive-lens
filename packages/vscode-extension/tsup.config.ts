import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts', 'src/server.ts'],
  format: ['cjs'],
  external: ['vscode'],
  noExternal: ['vscode-languageclient', 'vscode-languageserver', 'vscode-languageserver-textdocument', 'vscode-languageserver-protocol', 'vscode-jsonrpc', 'web-tree-sitter', '@cognitive-complexity/core'],
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  publicDir: 'public',
  loader: {
      '.wasm': 'file'
  }
});
