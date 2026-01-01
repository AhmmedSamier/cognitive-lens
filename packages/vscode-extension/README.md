# Cognitive Lens for VS Code

**Cognitive Lens** helps you write cleaner, more maintainable code by visualizing **Cognitive Complexity** directly in Visual Studio Code.

It goes beyond simple cyclomatic complexity by assessing how difficult a unit of code is to understand intuitively.

## ✨ Key Features

### 1. Real-time Visualization
*   **CodeLens**: Display the cumulative complexity score above methods.
    
    ![CodeLens](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/code-lens.png)

*   **Inlay Hints**: Detailed per-line breakdown of what contributes to complexity.
    *   Example: `if (condition)` -> `+1 (if)`
    *   Example: Nested logic -> `+2 (nesting)`
    
    ![Inlay Hints](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/score-details-per-line.png)

*   **Gutter Icons**: Traffic light icons in the gutter.
    
    ![Gutter Icons](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/gutters.png)

### 2. Complexity Deltas (New) 📉
Track changes in real-time as you edit. Cognitive Lens compares your current code against the Git HEAD:
*   **🟢 Improvement**: You reduced complexity (e.g., `🟢 -3`).
*   **🔴 Regression**: You increased complexity (e.g., `🔴 +2`).

![Complexity Deltas](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/git-delta.png)

### 3. Project Report (New) 📊
Generate a full-screen, interactive HTML dashboard to analyze your entire project.
*   **Command**: Run `Cognitive Lens: Generate Project Report`.
*   **Features**:
    *   Sort and filter methods by complexity.
    *   Fuzzy search for specific files or functions.
    *   Dark/Light mode support.

![Project Report](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/html-report.png)

### 4. Refactoring Assistance 💡
Hover over any method with high complexity to see a **Refactoring Advisory**:
*   Breakdown of primary contributors (Loops, If/Else, Nesting).
*   Actionable tips (e.g., "Consider extracting this loop into a separate function").

### 5. Methods Explorer
A dedicated **Side Panel** view lists all methods in your workspace, sorted by complexity score, making it easy to hunt down technical debt.

![Methods Explorer](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/packages/vscode-extension/resources/walkthrough/images/side-menu.png)

## ⚙️ Configuration

Customize the extension in your `settings.json`:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `cognitiveComplexity.threshold.warning` | `15` | Score causing a Warning diagnostic (Yellow). |
| `cognitiveComplexity.threshold.error` | `25` | Score causing an Error diagnostic (Red). |
| `cognitiveComplexity.showCodeLens` | `true` | Show score above methods. |
| `cognitiveComplexity.showInlayHints.details` | `true` | Show line-by-line attribution. |
| `cognitiveComplexity.showInlayHints.complexityDelta` | `true` | Show complexity changes (Deltas) in inlay hints. |
| `cognitiveComplexity.showComplexityDeltaDecoration` | `true` | Show colored decorations for deltas. |
| `cognitiveComplexity.showGutterIcon` | `false` | Show traffic light icons in the gutter. |

## 📦 Supported Languages

*   **TypeScript** (`.ts`, `.tsx`)
*   **JavaScript** (`.js`, `.jsx`)
*   **C#** (`.cs`)

## 🚀 Installation

Install via the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AhmedSamir.cognitive-lens).

## 🤝 Contributing

Issues and Pull Requests are welcome on [GitHub](https://github.com/AhmmedSamier/cognitive-lens).
