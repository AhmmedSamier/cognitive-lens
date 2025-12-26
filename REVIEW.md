# Codebase Review and Enhancement Proposals

## Overview
This document outlines the findings from a deep dive into the Cognitive Lens codebase, highlighting architectural strengths, missing features, and opportunities for enhancement, specifically focusing on "Code Review" workflows.

## 1. Architecture & Performance
### Strengths
*   **Incremental Parsing:** The use of `IncrementalParser` and `web-tree-sitter` ensures high performance even for large files.
*   **LSP-First Approach:** Decoupling logic into a Language Server allows reuse across VS Code, Visual Studio, and Zed.
*   **Single-Pass Calculation:** The complexity calculation logic in `packages/core` is efficient.

### Areas for Improvement
*   **Redundant Parsing for Diffs:** Currently, the system only parses the active document. Comparing against Git HEAD requires a secondary parse mechanism (addressed in the current plan).
*   **Memory Usage:** Caching trees for all open documents is good, but explicit disposal strategies for closed tabs are critical (currently handled, but worth monitoring).

## 2. Missing Features (General)
*   **Language Support:**
    *   Currently supports: TypeScript, JavaScript, C#.
    *   **Missing:** Python, Java, Go, Dart, Rust. These are high-value languages for complexity analysis.
*   **CI/CD Integration:** No CLI tool exists to run this analysis in a GitHub Action pipeline to block PRs with high complexity.
*   **Reporting:** The `generateHtmlReport` function exists in `core` but is not exposed in the VS Code extension (e.g., "Generate Complexity Report" command).

## 3. Enhancements for Code Reviews (Editor-Focused)
To assist users specifically during code reviews, the following features are recommended:

### A. Complexity Delta (Planned)
*   **Concept:** Show the difference in complexity between the *current* code and the *committed* code (Git HEAD).
*   **Value:** Immediate feedback on whether a change is making the code better or worse.
*   **UI:** "+2" (Red) or "-5" (Green) indicators in the Methods View.

### B. "Refactor Candidate" Highlighting
*   **Concept:** Visually distinguish methods that exceed the "Error" threshold significantly.
*   **UI:** distinct icon or background color in the side panel for methods with score > 25.

### C. Pull Request Mode
*   **Concept:** Instead of just "Active File", have a mode that lists *all* changed methods in the current PR/Branch sorted by complexity.
*   **Value:** Allows reviewers to focus immediately on the riskiest changes in a PR.

### D. Inlay Hint "Ghost Text" for Delta
*   **Concept:** Display `MethodName (+2)` directly in the editor as an Inlay Hint.
*   **Value:** No need to look at the side panel; the impact is right in the code.

## 4. Specific Codebase Notes
*   **`packages/core`**: Well structured.
*   **`packages/vscode-extension`**: The `ComplexityWebviewProvider` constructs HTML strings manually. Moving to a lightweight framework (like Vue or React via Webview UI Toolkit) or using a template engine would make complex UI (like diff views) easier to maintain.
*   **`packages/language-server`**: Error handling around `web-tree-sitter` initialization is robust, but the dependency on specific WASM versions requires careful management (as noted in `AGENTS.md`).
