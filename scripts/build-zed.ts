import * as fs from 'fs';
import * as path from 'path';

const ZED_EXT_DIR = path.resolve(__dirname, '../packages/zed-extension');
const VSCODE_EXT_DIR = path.resolve(__dirname, '../packages/vscode-extension');
const VSCODE_DIST_DIR = path.join(VSCODE_EXT_DIR, 'dist');

const filesToCopy = [
    'server.js',
    'tree-sitter.wasm',
    'tree-sitter-c_sharp.wasm',
    'tree-sitter-typescript.wasm',
    'tree-sitter-tsx.wasm'
];

console.log('Building Zed extension artifacts...');

const child_process = require('child_process');
try {
    console.log('Running build in packages/vscode-extension...');
    // Ensure dependencies are installed first if not already (skipping here as assumed)
    child_process.execSync('bun run package', { cwd: VSCODE_EXT_DIR, stdio: 'inherit' });
} catch (e) {
    console.error('Failed to build vscode-extension');
    process.exit(1);
}

filesToCopy.forEach(file => {
    const src = path.join(VSCODE_DIST_DIR, file);
    const dest = path.join(ZED_EXT_DIR, file);

    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file} to ${dest}`);
    } else {
        console.error(`Source file not found: ${src}`);
        process.exit(1);
    }
});

console.log('Zed extension artifacts prepared.');
