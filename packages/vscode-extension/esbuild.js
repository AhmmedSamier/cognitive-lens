const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts', 'src/server.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outdir: 'dist',
        external: ['vscode', 'module', 'url'],
        logLevel: 'info',
        alias: {
            'web-tree-sitter': path.resolve(__dirname, '../../node_modules/web-tree-sitter/web-tree-sitter.cjs'),
        },
        loader: {
            '.wasm': 'file',
        },
        plugins: [
            {
                name: 'copy-wasm',
                setup(build) {
                    build.onEnd(() => {
                        console.log('Copying WASM files...');
                        try {
                            execSync('bun run copy:wasm', { stdio: 'inherit' });
                        } catch (error) {
                            console.error('Failed to copy WASM files:', error);
                        }
                    });
                },
            },
        ],
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
