# Cognitive Complexity for Zed

This extension provides Cognitive Complexity metrics for TypeScript and C# in Zed, similar to the VS Code extension.

## Configuration

The extension uses the same default configuration as the VS Code extension. You can customize the behavior by adding the following settings to your Zed `settings.json` file.

Open settings with `cmd-,` (or `ctrl-,` on Linux/Windows) or via the command palette (`zed: open settings`).

### Example Configuration

```json
{
  "lsp": {
    "cognitive-complexity-ls": {
      "settings": {
        "cognitiveComplexity": {
          "threshold": {
            "warning": 15,
            "error": 25
          },
          "showCodeLens": true,
          "showDiagnostics": true,
          "showInlayHints": {
            "methodScore": true,
            "details": true
          },
          "totalScorePrefix": "Cognitive Complexity"
        }
      }
    }
  }
}
```

### Options

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `cognitiveComplexity.threshold.warning` | `number` | `15` | Complexity score threshold for showing a warning. |
| `cognitiveComplexity.threshold.error` | `number` | `25` | Complexity score threshold for showing an error. |
| `cognitiveComplexity.showCodeLens` | `boolean` | `true` | Enable or disable CodeLens for cognitive complexity. |
| `cognitiveComplexity.showDiagnostics` | `boolean` | `true` | Enable or disable diagnostics (warnings/errors). |
| `cognitiveComplexity.showInlayHints.methodScore` | `boolean` | `true` | Enable or disable the total score inlay hint. |
| `cognitiveComplexity.showInlayHints.details` | `boolean` | `true` | Enable or disable detailed contribution inlay hints. |
| `cognitiveComplexity.totalScorePrefix` | `string` | `"Cognitive Complexity"` | The prefix text to display before the total complexity score. |

## Features

-   **CodeLens / Inlay Hint**: Shows the cognitive complexity score above or at the start of methods.
    -   *Note:* Zed does not strictly support CodeLens yet, so the "method score" is shown as an Inlay Hint positioned at the start of the method definition (or previous line) to mimic CodeLens behavior.
-   **Diagnostics**: Shows warnings (yellow) and errors (red) when complexity exceeds configured thresholds.
-   **Details**: Shows inline hints for complexity increments (e.g., `+1 if`, `+2 nesting`).

## Troubleshooting

If you do not see complexity metrics:
1.  Ensure you are in a supported file (`.ts`, `.tsx`, `.js`, `.jsx`, `.cs`).
2.  Check the Zed logs (`zed: open log`) for any errors related to `cognitive-complexity-ls`.
