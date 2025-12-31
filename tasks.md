# Tasks

## 1. Complexity Delta (Editor Feedback)
- [ ] Implement `DeltaDecorator` class in `packages/vscode-extension`.
    - [ ] Logic to calculate diff between `current` and `base` complexity.
    - [ ] Create decorations with `after` content simulating Inlay Hints.
    - [ ] Use `createTextEditorDecorationType` with color (Red for >0, Green for <0).
- [ ] Integrate `DeltaDecorator` into `extension.ts`.
    - [ ] Update `updateEditorDecorations` (or create a new function) to apply these delta decorations.
    - [ ] Ensure it respects `showInlayHints` or a new setting `showComplexityDelta`.

## 2. Refactoring Tips (Hover)
- [ ] Add `HoverProvider` capability to `LanguageServer`.
    - [ ] In `packages/language-server/src/logic.ts`, implement `getHover` function.
    - [ ] Register `onHover` in `packages/language-server/src/server.ts`.
- [ ] Format `MethodComplexity.details` into Markdown hover content.
    - [ ] Group by type (Nesting, If, Switch, etc.).
    - [ ] Add generic tips for each high-impact contributor.

## 3. Diff Integration
- [ ] Verify Diff Editor behavior.
    - [ ] Ensure `documentSelector` covers `file` scheme (it does).
    - [ ] Check if `git` scheme is needed (for read-only side).
    - [ ] If `git` scheme is used, ensure the LS can handle it (might need `textDocument/content` request or just rely on open doc).
- [ ] (Optional) Add specific "Diff View" logic if standard behavior is insufficient.

## 4. Documentation
- [ ] Update `README.md` with new features.
- [ ] Update `AGENTS.md` if architectural patterns change.
