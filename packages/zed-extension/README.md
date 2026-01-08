# 🧠 Cognitive Lens for Zed

Bring the power of **Cognitive Complexity** analysis to the high-performance [Zed](https://zed.dev/) editor.

---

## ⚡ Features

-   **Start-of-Method Scores**: Total complexity metrics displayed as inlay hints at the function signature.
-   **Inline Breakdown**: Line-by-line attribution (e.g., `+1 if`, `+2 nesting`) integrated into the editor's inlay hint system.
-   **Real-time Diagnostics**: Automatic generation of Warnings and Errors in the project panel and gutter when thresholds are exceeded.

---

## ⚙️ Configuration

Customize the analysis in your Zed `settings.json` (`cmd-,`):

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
          "showDiagnostics": true,
          "showInlayHints": {
            "methodScore": true,
            "details": true
          }
        }
      }
    }
  }
}
```

### Options Overview

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `threshold.warning` | `number` | `15` | Metric for yellow warning diagnostics. |
| `threshold.error` | `number` | `25` | Metric for red error diagnostics. |
| `showInlayHints.details` | `boolean` | `true` | Show attribution like `+1 if`. |

---

## 🧮 Methodology & Alignment

The analysis engine runs a unified adapter system:
- **TypeScript/JS**: Direct parity with **SonarJS (S3776)**.
- **C#**: Aligned with **SonarSource C#** rules.
*Note: This analyzer aggregates nested logic into the parent method for a complete overview of the logical unit.*

---

## 🚀 Troubleshooting

1.  **Missing Hints**: Ensure the file language is correctly set to `TypeScript`, `TSX`, `JavaScript`, or `C#`.
2.  **LSP Logs**: Search the Command Palette for `zed: open log` and filter for `cognitive-complexity-ls` to debug server-side issues.

---
<p align="center">Speed of Zed, Insight of Cognitive Complexity.</p>
