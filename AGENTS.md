# AGENTS.md

Welcome, Agent. This repository contains the **Cognitive Lens** project, which provides cognitive complexity analysis for multiple languages (TypeScript, C#, Dart).

## Build, Lint, and Test Commands

This project uses **Bun** as the primary runtime and package manager.

- **Install Dependencies:** `bun install`
- **Lint Codebase:** `bun run lint` (uses ESLint)
- **Format Code:** `bun run format` (uses Prettier)
- **Run All Tests:** `bun test`
- **Run a Single Test File:** `bun test <path-to-file>` (e.g., `bun test packages/core/test/complexity.test.ts`)
- **Run Specific Tests by Name:** `bun test -t "<regex-pattern>"`
- **Build VS Code Extension:** `bun run build:vs`
- **Build Zed Extension:** `bun run build:zed`
- **Benchmark:** `bun run benchmark`
- **Test Timeout:** `bun test --timeout=<ms>` (default: 5000ms)
- **Coverage:** `bun test --coverage` (generates coverage report)

## Code Style Guidelines

### General

- **Indentation:** 2 spaces.
- **Quotes:** Single quotes for strings (`'single'`), unless escaping or JSON.
- **Semicolons:** Always required.
- **Max Line Length:** 100 characters.

### Imports

- **Organization:** Use the `prettier-plugin-organize-imports` (handled automatically by `bun run format`).
- **Grouping:** Group imports by: 1) Built-in modules, 2) Third-party libraries, 3) Workspace packages (e.g., `@cognitive-complexity/*`), 4) Local relative paths.

### TypeScript & Types

- **Strictness:** Use strict typing. Avoid `any` where possible.
- **Interfaces vs Types:** Prefer `interface` for public APIs and `type` for internal unions or primitives.
- **Naming:**
  - Classes/Interfaces/Types: `PascalCase`.
  - Variables/Functions: `camelCase`.
  - Constants: `UPPER_SNAKE_CASE`.
  - Files: `camelCase.ts` or `kebab-case.ts` (follow existing patterns in the specific package).
- **Function Returns:** Explicitly define return types for exported functions.

### Error Handling

- **Async/Await:** Use `try...catch` blocks for asynchronous operations.
- **Logging:** In the Language Server, use `connection.console.log` or `connection.console.error` instead of `console.log`.
- **Validation:** Always validate configuration/settings before use, providing defaults if missing.

### ESLint & SonarJS

- The project enforces a **Cognitive Complexity limit of 15** via `eslint-plugin-sonarjs`.
- If your change exceeds this limit, refactor into smaller, focused functions.

### Code Coverage

- Tests are configured to maintain good coverage quality.
- Use `bun test --coverage` to generate detailed coverage reports.
- Aim to maintain coverage above 80% for critical modules.

## Project Structure

- `packages/core`: The shared logic for calculating complexity using `web-tree-sitter`.
- `packages/language-server`: The LSP implementation providing CodeLens, Inlay Hints, and Diagnostics.
- `packages/vscode-extension`: The VS Code-specific wrapper and UI components.
- `packages/zed-extension`: Zed editor integration.

## Extension Packaging

- VS Code: `vsce package --no-dependencies` (run from `packages/vscode-extension`).
- Zed: `bun run scripts/package-zed.ts`.

---

_Note: This file is optimized for agentic workflows. When modifying code, ensure you run `bun run lint` and `bun test` to verify your changes._
