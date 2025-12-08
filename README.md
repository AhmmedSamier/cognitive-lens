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
*   Rust (for building Zed extension)

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

### 4. Build Zed Extension

For Zed, you need to compile the Rust code to WASM and bundle the server script.

1.  Build the server script (if not already done):
    ```bash
    cd packages/vscode-extension
    bun run package:server
    ```

2.  Copy the server script to the Zed extension directory:
    ```bash
    cp packages/vscode-extension/dist/server.js packages/zed-extension/server.js
    ```

3.  Build the WASM:
    ```bash
    cd packages/zed-extension
    cargo build --target wasm32-wasip1 --release
    ```

## Running

### VS Code

1.  Open `packages/vscode-extension` in VS Code.
2.  Press `F5` to launch a new Extension Development Host window.
3.  Open a TypeScript file to see complexity scores.

### Zed

1.  Open Zed.
2.  Go to Extensions -> Install Dev Extension.
3.  Select the `packages/zed-extension` directory.
    *   Note: Ensure `server.js` is present in that directory.
4.  Open a TypeScript or JavaScript file.

## Features

*   **CodeLens**: Displays the total Cognitive Complexity score above each method.
*   **Inlay Hints**: Displays the complexity contribution of each line (e.g., `(+1 if)`).
