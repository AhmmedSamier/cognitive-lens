# 🧠 Cognitive Lens for VS Code

**Transform your coding experience with intuitive complexity visualization.**

[Marketplace](https://marketplace.visualstudio.com/items?itemName=AhmedSamir.cognitive-lens) | [GitHub](https://github.com/AhmmedSamier/cognitive-lens) | [Changelog](https://github.com/AhmmedSamier/cognitive-lens/blob/main/CHANGELOG.md)

---

## 🔥 Features at a Glance

### 1. The HUD for your Code

- **Live Score (CodeLens)**: A floating score above every method tells you exactly how "braindead" easy or "nightmare" hard your code is to read.
  ![CodeLens](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/images/code-lens.png)
- **Deep Dive (Inlay Hints)**: Toggleable, line-specific annotations show the _exact_ cost of every branching statement.
  ![Inlay Hints](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/images/score-details-per-line.png)
  - _Green (0-14)_: Accessible logic.
  - _Yellow (15-24)_: Consider refactoring.
  - _Red (25+)_: High cognitive load.

### 2. Git-Integrated Complexity

Stop regressions before they are committed. Cognitive Lens monitors your changes and displays a **Delta** decoration:
![Complexity Deltas](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/images/git-delta.png)

- `🟢 -5`: Cleaned up a mess.
- `🔴 +2`: Complexity is creeping in.

### 3. Smart Advice

Hover over a complex method to see the **Refactoring Advisory**. It breaks down the biggest complexity contributors (Nesting, Logic, Control Flow) and suggests actionable refactorings.

### 4. Interactive Reports

Generate a full-screen workspace dashboard with `Cognitive Lens: Generate Project Report`.
![Project Report](https://raw.githubusercontent.com/AhmmedSamier/cognitive-lens/main/images/html-report.png)

- **Top 10 Most Complex Methods**: Find your biggest technical debt instantly.
- **Fuzzy Search**: Quickly jump to any method.
- **Visual Trends**: See the health of your codebase.

---

## ⚙️ Configuration

Tailor the lens to your team's standards:

| Setting                                             | Default                | Description                                      |
| :-------------------------------------------------- | :--------------------- | :----------------------------------------------- |
| `cognitiveComplexity.threshold.warning`             | `15`                   | The score where logic becomes "Yellow".          |
| `cognitiveComplexity.threshold.error`               | `25`                   | The score where logic becomes "Red".             |
| `cognitiveComplexity.showCodeLens`                  | `true`                 | Show scores above methods.                       |
| `cognitiveComplexity.showInlayHints.details`        | `true`                 | Show `+1 (if)` style details.                    |
| `cognitiveComplexity.showInlayHints.methodScore`    | `false`                | Show the total score as an inlay hint.           |
| `cognitiveComplexity.showInlayHints.complexityDelta`| `false`                | Show the score delta as an inlay hint.           |
| `cognitiveComplexity.showGutterIcon`                | `false`                | Traffic lights in the gutter.                    |
| `cognitiveComplexity.showDiagnostics`               | `true`                 | Show warnings/errors for high complexity.        |
| `cognitiveComplexity.showComplexityDeltaDecoration` | `true`                 | Show colored delta decoration (VS Code).         |
| `cognitiveComplexity.totalScorePrefix`              | `"Cognitive Complexity"` | Prefix text for the total score.                 |

---

## 📦 Supported Languages

| Language             | Support Level | Alignment                     |
| :------------------- | :------------ | :---------------------------- |
| **TypeScript / TSX** | Full          | **SonarJS** Compatible        |
| **JavaScript / JSX** | Full          | **SonarJS** Compatible        |
| **C# (.cs)**         | Full          | **SonarSource C#** Compatible |
| **Dart**             | Full          | **Community Standard**        |

---

## 🚀 Installation

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`).
2. Search for `Cognitive Lens`.
3. Click **Install**.

---

## 🤝 Contributing & Support

- **Found a bug?** Open an [Issue](https://github.com/AhmmedSamier/cognitive-lens/issues).
- **Want to help?** PRs are welcome! Check the root [README](https://github.com/AhmmedSamier/cognitive-lens/blob/main/README.md) for build instructions.

---

<p align="center">Writing clean code is hard. Reading it shouldn't be.</p>
