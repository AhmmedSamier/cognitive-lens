import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

const VS_EXT_DIR = path.resolve(__dirname, '../packages/visual-studio-extension');
const VSCODE_EXT_DIR = path.resolve(__dirname, '../packages/vscode-extension');
const VSCODE_DIST_DIR = path.join(VSCODE_EXT_DIR, 'dist');
const VS_RESOURCES_DIR = path.join(VS_EXT_DIR, 'Resources');

const filesToCopy = [
    'server.js',
    'tree-sitter.wasm',
    'tree-sitter-c_sharp.wasm'
];

console.log('Building Visual Studio extension artifacts...');

// Ensure Resources directory exists
if (!fs.existsSync(VS_RESOURCES_DIR)) {
    fs.mkdirSync(VS_RESOURCES_DIR, { recursive: true });
}

try {
    console.log('Building language server (using vscode-extension build)...');
    // We reuse the vscode extension build process to generate the bundled server.js
    child_process.execSync('bun run package', { cwd: VSCODE_EXT_DIR, stdio: 'inherit' });
} catch (e) {
    console.error('Failed to build vscode-extension (language server)');
    process.exit(1);
}

filesToCopy.forEach(file => {
    const src = path.join(VSCODE_DIST_DIR, file);
    const dest = path.join(VS_RESOURCES_DIR, file);

    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file} to ${dest}`);
    } else {
        console.error(`Source file not found: ${src}`);
        process.exit(1);
    }
});

console.log('Visual Studio extension artifacts prepared in packages/visual-studio-extension/Resources');
console.log('You can now open packages/visual-studio-extension/CognitiveComplexity.sln in Visual Studio to build the VSIX.');
