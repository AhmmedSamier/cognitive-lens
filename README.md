# Cognitive Lens

**Cognitive Lens** is a powerful developer tool designed to help you visualize, track, and reduce **Cognitive Complexity** in your codebase. It provides real-time feedback directly in your editor, helping you write maintainable, clean code.

This monorepo contains the implementation for the **Language Server**, **VS Code Extension**, and **Zed Extension**.

## 🚀 Features

### 1. Real-time Analysis
*   **CodeLens**: See the complexity score directly above every method.

    ![CodeLens](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/code-lens.png)

*   **Inlay Hints**: Understand exactly *why* a method is complex with line-by-line attribution (e.g., `+1 (if)`, `+1 (nesting)`).

    ![Inlay Hints](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/score-details-per-line.png)

*   **Gutter Indicators**: Traffic light icons (🟢 🟡 🔴) provide immediate visual feedback on method health.

    ![Gutter Icons](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/gutters.png)

### 2. Historical Context (New)
*   **Complexity Deltas**: Instantly see how your current edits affect complexity relative to the Git HEAD.
    *   **Improvements** are highlighted in **Green** (e.g., `🟢 (-2)`).
    *   **Regressions** are highlighted in **Red** (e.g., `🔴 (+3)`).

    ![Complexity Deltas](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/git-delta.png)

### 3. Project Insights (New)
*   **HTML Project Report**: Generate a comprehensive, standalone HTML report for your entire workspace.
    *   **Dashboard**: Visualize complexity distribution.
    *   **Explore**: Search and filter methods by complexity score.
    *   **Theme Aware**: Fully supports Dark and Light modes.

    ![Project Report](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/html-report.png)

### 4. Smart Refactoring
*   **Refactoring Tips**: Hover over high-complexity methods to receive tailored advice on how to simplify them (e.g., "Extract Method," "Use Guard Clauses").

### 5. Methods Explorer
*   **Side Panel**: Lists all methods in your workspace, sorted by complexity score, making it easy to hunt down technical debt.

    ![Methods Explorer](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/side-menu.png)

## 📂 Repository Structure

*   `packages/core`: The pure Logic/Algorithm for calculating Cognitive Complexity.
*   `packages/language-server`: LSP implementation that serves complexity data to editors.
*   `packages/vscode-extension`: The VS Code client extension.
*   `packages/zed-extension`: The Zed editor extension.

## 🛠️ Prerequisites

*   **Runtime**: [Bun](https://bun.sh/) (Required for build scripts)
*   **Node.js**: LTS version
*   **Editors**: VS Code or Zed
*   **Rust**: Required only if building the Zed extension from source.

## 📦 Build Instructions

### 1. Install Dependencies

```bash
bun install
```

### 2. Build VS Code Extension

```bash
cd packages/vscode-extension
bun run package
```
This generates `dist/extension.js` and `dist/server.js`.

To create a `.vsix` installer:
```bash
bun run package:vsix
```

## 🐞 Running in Development

### VS Code
1.  Open the repository in VS Code.
2.  Press `F5` to launch a new **Extension Development Host** window.
3.  Open any TypeScript or C# file to see the extension in action.

### Zed
1.  Open Zed.
2.  Navigate to **Extensions** -> **Install Dev Extension**.
3.  Select the `packages/zed-extension` directory.
    *   *Note: Ensure you have built the language server first.*
