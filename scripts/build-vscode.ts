import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const VSCODE_EXT_DIR = path.resolve(__dirname, '../packages/vscode-extension');

console.log('Building VS Code Extension...');

try {
    console.log('Installing dependencies...');
    // We assume root install has happened, but ensuring package deps are linked is good.
    // However, in a workspace, running install in root is usually enough.
    // If we want to be safe we can run install in the package.
    child_process.execSync('bun install', { cwd: VSCODE_EXT_DIR, stdio: 'inherit' });

    console.log('Packaging code...');
    child_process.execSync('bun run package', { cwd: VSCODE_EXT_DIR, stdio: 'inherit' });

    console.log('Creating VSIX...');
    child_process.execSync('bun run package:vsix', { cwd: VSCODE_EXT_DIR, stdio: 'inherit' });

    console.log('VS Code Extension built successfully.');
} catch (error) {
    console.error('Failed to build VS Code Extension:', error);
    process.exit(1);
}
