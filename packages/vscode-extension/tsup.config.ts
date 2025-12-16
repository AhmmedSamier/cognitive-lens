import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts', 'src/server.ts'],
  format: ['cjs'],
  external: ['vscode'],
  noExternal: ['typescript', 'vscode-languageclient', 'vscode-languageserver', 'vscode-languageserver-textdocument', 'vscode-languageserver-protocol', 'vscode-jsonrpc', 'web-tree-sitter', '@cognitive-complexity/core'],
  splitting: false,
  sourcemap: false,
  minify: true,
  clean: true,
  outDir: 'dist',
  publicDir: 'public',
  shims: true,
  loader: {
      '.wasm': 'file'
  },
  onSuccess: 'bun run copy:wasm'
});
