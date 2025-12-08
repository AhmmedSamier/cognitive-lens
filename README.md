# Cognitive Complexity Extension

This monorepo contains extensions for VS Code and Zed to calculate and display Cognitive Complexity for TypeScript methods.

## Structure

*   `packages/core`: Core logic for calculating complexity.
*   `packages/language-server`: LSP server wrapping the core logic.
*   `packages/vscode-extension`: VS Code extension client.
*   `packages/zed-extension`: Zed extension source.

## Prerequisites

*   [Bun](https://bun.sh/)
*   Node.js
*   VS Code
*   Zed

## Build Instructions

### 1. Install Dependencies

```bash
bun install
```

### 2. Build VS Code Extension

```bash
cd packages/vscode-extension
bun run package
```

This will generate `dist/extension.js` and `dist/server.js`.

### 3. Package VS Code Extension (VSIX)

```bash
cd packages/vscode-extension
bun run package:vsix
```

This will create a `.vsix` file.

### 4. Build Zed Extension

For Zed, you need to compile the Rust code to WASM.

```bash
cd packages/zed-extension
cargo build --target wasm32-wasi --release
```

## Running

### VS Code

1.  Open `packages/vscode-extension` in VS Code.
2.  Press `F5` to launch a new Extension Development Host window.
3.  Open a TypeScript file to see complexity scores.

### Zed

1.  Ensure you have the language server binary available in your PATH.
    *   Since this project builds `dist/server.js`, you can create a wrapper script named `cognitive-complexity-ls` that runs `node /path/to/packages/vscode-extension/dist/server.js`.
    *   Make sure `cognitive-complexity-ls` is executable and in your PATH.
2.  Install the Zed extension from the local folder `packages/zed-extension`.
    *   Open Zed -> Extensions -> Install Dev Extension -> Select `packages/zed-extension`.

## Features

*   **CodeLens**: Displays the total Cognitive Complexity score above each method.
*   **Inlay Hints**: Displays the complexity contribution of each line (e.g., `(+1 if)`).
