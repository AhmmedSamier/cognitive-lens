import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { calculateComplexity, initParsers, MethodComplexity } from '@cognitive-complexity/core';
import chalk from 'chalk';

export async function check(pattern: string, options: { threshold: string, failOnError?: boolean }) {
    const threshold = parseInt(options.threshold, 10);
    const files = await glob(pattern, { ignore: 'node_modules/**' });

    // WASM files are copied to dist/ during build
    // When running via node, we need to derive path from import.meta.url
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    let wasmPath = __dirname;
    if (!fs.existsSync(path.join(wasmPath, 'tree-sitter.wasm'))) {
         // Fallback for dev environment
         // Try resolving from project root if running from source (packages/cli/src/commands)
         // Path: ../../../../packages/vscode-extension/public
         const devPath = path.resolve(__dirname, '../../../../packages/vscode-extension/public');
         if (fs.existsSync(path.join(devPath, 'tree-sitter.wasm'))) {
             wasmPath = devPath;
         } else {
             // Fallback for previous structure assumption
             wasmPath = path.resolve(__dirname, '../../packages/vscode-extension/public');
         }
    }

    try {
        await initParsers({ wasmDirectory: wasmPath });
    } catch (e) {
        console.error('Failed to load parsers. Make sure you are running from the repo root or have built the extensions.');
        console.error(e);
        process.exit(1);
    }

    let hasErrors = false;

    console.log(chalk.blue(`Checking complexity for ${files.length} files...`));

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

            // We need to get the tree from the parser manually since core.calculateComplexity takes a Tree
            // This suggests we might want to expose a higher level 'calculateForFile' in core later
            // For now we access the parsers from initParsers result (which we didn't capture above, let's fix that)
            const parsers = await initParsers({ wasmDirectory: wasmPath });
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
                const complexMethods = complexities.filter(c => c.score > threshold);

                if (complexMethods.length > 0) {
                    console.log(chalk.bold(file));
                    for (const method of complexMethods) {
                        const color = method.score > 25 ? chalk.red : chalk.yellow;
                        console.log(`  ${color(method.score)} - ${method.name} (line ${method.startLine})`);
                    }
                    hasErrors = true;
                }
                tree.delete();
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }

    if (hasErrors && options.failOnError) {
        console.error(chalk.red('\nComplexity check failed.'));
        process.exit(1);
    } else if (hasErrors) {
        console.log(chalk.yellow('\nComplexity warnings found.'));
    } else {
        console.log(chalk.green('\nNo complexity issues found.'));
    }
}
