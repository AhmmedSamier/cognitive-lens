# Tasks

## 1. Complexity Delta (Editor Feedback)
- [x] Implement `DeltaDecorator` class in `packages/vscode-extension`.
    - [x] Logic to calculate diff between `current` and `base` complexity.
    - [x] Create decorations with `after` content simulating Inlay Hints.
    - [x] Use `createTextEditorDecorationType` with color (Red for >0, Green for <0).
- [x] Integrate `DeltaDecorator` into `extension.ts`.
    - [x] Update `updateEditorDecorations` (or create a new function) to apply these delta decorations.
    - [x] Ensure it respects `showInlayHints` or a new setting `showComplexityDelta`.

## 2. Refactoring Tips (Hover)
- [x] Add `HoverProvider` capability to `LanguageServer`.
    - [x] In `packages/language-server/src/logic.ts`, implement `getHover` function.
    - [x] Register `onHover` in `packages/language-server/src/server.ts`.
- [x] Format `MethodComplexity.details` into Markdown hover content.
    - [x] Group by type (Nesting, If, Switch, etc.).
    - [x] Add generic tips for each high-impact contributor.

## 3. Diff Integration
- [x] Verify Diff Editor behavior.
    - [x] Ensure `documentSelector` covers `file` scheme (it does).
    - [x] Check if `git` scheme is needed (for read-only side).
    - [x] If `git` scheme is used, ensure the LS can handle it (might need `textDocument/content` request or just rely on open doc).
- [ ] (Optional) Add specific "Diff View" logic if standard behavior is insufficient.

## 4. Documentation
- [x] Update `README.md` with new features.
- [ ] Update `AGENTS.md` if architectural patterns change.
