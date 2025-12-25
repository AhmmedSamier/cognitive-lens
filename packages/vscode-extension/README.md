# Cognitive Lens for VS Code

This extension calculates and displays Cognitive Complexity for TypeScript, JavaScript, and C# methods directly in your editor.

## Features

### CodeLens
Displays the total Cognitive Complexity score above each method.

![CodeLens](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/code-lens.png)

### Inlay Hints
Displays the complexity contribution of each line (e.g., `(+1 if)`).

![Inlay Hints](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/score-details-per-line.png)

### Gutter Icons
Optional traffic light icons in the gutter to indicate complexity status.

![Gutter Icons](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/gutters.png)

### Diagnostics
Shows warnings (yellow) and errors (red) when complexity exceeds configured thresholds.

### Side Panel
A "Methods" view in the Activity Bar to list all methods and their complexity scores, with search functionality.

## Configuration

You can customize the extension behavior in your `settings.json`:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `cognitiveComplexity.threshold.warning` | `15` | Complexity score threshold for showing a warning. |
| `cognitiveComplexity.threshold.error` | `25` | Complexity score threshold for showing an error. |
| `cognitiveComplexity.showCodeLens` | `true` | Enable or disable CodeLens for cognitive complexity. |
| `cognitiveComplexity.showGutterIcon` | `false` | Enable or disable the gutter icon. |
| `cognitiveComplexity.showDiagnostics` | `true` | Enable or disable diagnostics (warnings/errors). |
| `cognitiveComplexity.showInlayHints.methodScore` | `false` | Enable or disable the method score inlay hint (useful if CodeLens is disabled). |
| `cognitiveComplexity.showInlayHints.details` | `true` | Enable or disable detailed contribution inlay hints. |
| `cognitiveComplexity.totalScorePrefix` | `"Cognitive Complexity"` | The prefix text to display before the total complexity score. |

## Supported Languages

-   TypeScript (`.ts`, `.tsx`)
-   JavaScript (`.js`, `.jsx`)
-   C# (`.cs`)

## Installation

Install via the Visual Studio Code Marketplace: [Cognitive Lens](https://marketplace.visualstudio.com/items?itemName=AhmedSamir.cognitive-lens)

## Issues

Please report issues on [GitHub](https://github.com/AhmmedSamier/cognitive-lens/issues).
