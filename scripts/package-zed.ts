import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

const ZED_EXT_DIR = path.resolve(__dirname, '../packages/zed-extension');
const ZIP_FILE_NAME = 'cognitive-lens-ls.zip';
const ZIP_OUTPUT_PATH = path.join(ZED_EXT_DIR, ZIP_FILE_NAME);

// These are the files we expect to be present in ZED_EXT_DIR after 'build:zed' is run.
// Note: build:zed currently copies them from vscode-extension/dist.
const filesToZip = [
    'server.js',
    'tree-sitter.wasm',
    'tree-sitter-c_sharp.wasm',
    'tree-sitter-typescript.wasm',
    'tree-sitter-tsx.wasm'
];

console.log('Packaging Zed extension...');

// 1. Run the build script to ensure files are up to date
console.log('Running build:zed...');
try {
    execSync('bun run build:zed', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
} catch (e) {
    console.error('Failed to run build:zed');
    process.exit(1);
}

// 2. Ensure extra files (typescript/tsx) are present in ZED_EXT_DIR
// The original build-zed.ts might not copy them. Let's verify and copy if needed.
const VSCODE_DIST_DIR = path.resolve(__dirname, '../packages/vscode-extension/dist');

['tree-sitter-typescript.wasm', 'tree-sitter-tsx.wasm'].forEach(file => {
    const src = path.join(VSCODE_DIST_DIR, file);
    const dest = path.join(ZED_EXT_DIR, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file} to ${dest} (supplemental)`);
    }
});

// Verify files exist
for (const file of filesToZip) {
    if (!fs.existsSync(path.join(ZED_EXT_DIR, file))) {
        console.error(`File missing: ${file}`);
        process.exit(1);
    }
}

try {
    console.log(`Creating zip archive at ${ZIP_OUTPUT_PATH}...`);
    const zip = new AdmZip();

    for (const file of filesToZip) {
        const filePath = path.join(ZED_EXT_DIR, file);
        zip.addLocalFile(filePath);
        console.log(`Added: ${file}`);
    }

    zip.writeZip(ZIP_OUTPUT_PATH);
    console.log(`Successfully created ${ZIP_OUTPUT_PATH}`);
} catch (e) {
    console.error('Failed to zip files:', e);
    process.exit(1);
}
