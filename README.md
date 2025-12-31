# Cognitive Complexity Extension

This monorepo contains extensions for VS Code and Zed to calculate and display Cognitive Complexity for TypeScript and C# methods.

## Structure

*   `packages/core`: Core logic for calculating complexity.
*   `packages/language-server`: LSP server wrapping the core logic.
*   `packages/vscode-extension`: VS Code extension client.
*   `packages/zed-extension`: Zed extension source.

## Features

### 1. Real-time Complexity Analysis
*   **CodeLens**: Displays the total Cognitive Complexity score above each method.
*   **Inlay Hints**: Displays the complexity contribution of each line (e.g., `(+1 if)`).
*   **Gutter Icons**: Traffic light indicators (Green, Yellow, Red) for quick visual feedback.
*   **Diagnostics**: Warnings and Errors for methods exceeding configured thresholds.

### 2. Code Review Helpers
*   **Complexity Delta**: Shows the change in complexity relative to Git HEAD directly in the editor (e.g., `(+2 Complexity)` in Red or `(-1 Complexity)` in Green).
*   **Methods View**: A side panel listing all methods sorted by complexity, with search and delta tracking.

### 3. Refactoring Assistance
*   **Smart Hover**: Hover over a high-complexity method signature to see a breakdown of contributors and actionable refactoring tips (e.g., "Deep nesting increases mental load...").

### 4. Reporting
*   **Project Report**: Generate a standalone HTML report for the entire codebase via the `Cognitive Lens: Generate Project Report` command.

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

## Running

### VS Code

1.  Open `packages/vscode-extension` in VS Code.
2.  Press `F5` to launch a new Extension Development Host window.
3.  Open a TypeScript or C# file to see complexity scores.

### Zed

1.  Open Zed.
2.  Go to Extensions -> Install Dev Extension.
3.  Select the `packages/zed-extension` directory.
    *   Note: Ensure `server.js` is present in that directory.
4.  Open a TypeScript or JavaScript file.
