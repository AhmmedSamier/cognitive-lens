#!/bin/bash
set -e

echo "Installing dependencies..."
bun install

echo "Building CLI..."
cd packages/cli
bun run build
cd ../..

echo "Building VS Code Extension..."
cd packages/vscode-extension
bun run package
cd ../..

echo "Build complete!"
