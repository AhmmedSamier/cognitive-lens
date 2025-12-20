import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    clean: true,
    onSuccess: async () => {
        // Copy WASM files to dist
        const wasmSource = path.resolve(__dirname, '../../packages/vscode-extension/public');
        const distDir = path.resolve(__dirname, 'dist');

        const files = [
            'tree-sitter.wasm',
            'tree-sitter-c_sharp.wasm',
            'tree-sitter-typescript.wasm',
            'tree-sitter-tsx.wasm'
        ];

        for (const file of files) {
            fs.copyFileSync(path.join(wasmSource, file), path.join(distDir, file));
        }
    }
});
