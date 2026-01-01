# Configuration

Customize **Cognitive Lens** to fit your workflow.

### Thresholds
Adjust the complexity limits for warnings and errors:
* **Warning**: Score threshold for a warning status (Default: 15).
* **Error**: Score threshold for an error status (Default: 25).

### Visual Feedback
Control how complexity information is displayed in your editor:
* **CodeLens**: Show the total complexity score above method definitions.
* **Gutter Icon**: Show an icon in the margin next to complex methods.
* **Diagnostics**: Enable or disable inline warnings and errors.
* **Inlay Hints (Method Score)**: Show the total score as an inlay hint.
* **Inlay Hints (Details)**: Show detailed breakdown of contributions next to specific lines.
* **Inlay Hints (Complexity Delta)**: Show change in complexity since the last git commit (mainly for non-VS Code editors).
* **Complexity Delta Decoration**: Show color-coded delta changes (green for improvements, red for regressions) directly in the editor.

### Customization
* **Total Score Prefix**: Change the text displayed before the complexity score (e.g., "Complexity: 10").

### Advanced
* **Server Trace**: Trace communication between VS Code and the language server for debugging.

[Configure Settings](command:workbench.action.openSettings?%22cognitiveComplexity%22)

