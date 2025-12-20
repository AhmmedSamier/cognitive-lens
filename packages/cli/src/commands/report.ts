import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { calculateComplexity, initParsers, generateHtmlReport } from '@cognitive-complexity/core';
import { FileReport } from '@cognitive-complexity/core';

export async function report(pattern: string, options: { output: string, format: string }) {
    const files = await glob(pattern, { ignore: 'node_modules/**' });
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    let wasmPath = __dirname;
    if (!fs.existsSync(path.join(wasmPath, 'tree-sitter.wasm'))) {
         // Fallback for dev environment
         const devPath = path.resolve(__dirname, '../../../../packages/vscode-extension/public');
         if (fs.existsSync(path.join(devPath, 'tree-sitter.wasm'))) {
             wasmPath = devPath;
         } else {
             wasmPath = path.resolve(__dirname, '../../packages/vscode-extension/public');
         }
    }

    try {
        await initParsers({ wasmDirectory: wasmPath });
    } catch (e) {
        console.error('Failed to load parsers.');
        process.exit(1);
    }

    const reports: FileReport[] = [];
    const parsers = await initParsers({ wasmDirectory: wasmPath });

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const ext = path.extname(file).toLowerCase();
            let language = '';

            if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                language = 'typescript';
            } else if (ext === '.cs') {
                language = 'csharp';
            } else {
                continue;
            }

            let tree;
            if (language === 'csharp') {
                tree = parsers.csharp.parse(content);
            } else if (language === 'typescript') {
                if ((ext === '.tsx' || ext === '.jsx')) {
                    tree = parsers.tsx.parse(content);
                } else {
                    tree = parsers.typescript.parse(content);
                }
            }

            if (tree) {
                const complexities = await calculateComplexity(tree, language);
                if (complexities.length > 0) {
                    reports.push({
                        file,
                        methods: complexities
                    });
                }
                tree.delete();
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }

    if (options.format === 'json') {
        fs.writeFileSync(options.output, JSON.stringify(reports, null, 2));
        console.log(`Report written to ${options.output}`);
    } else {
        const html = generateHtmlReport(reports);
        fs.writeFileSync(options.output, html);
        console.log(`Report written to ${options.output}`);
    }
}
