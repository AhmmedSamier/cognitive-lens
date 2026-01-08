# 🧠 Cognitive Lens for Visual Studio

Premium **Cognitive Complexity** analysis for .NET developers.

---

## ✨ Features

- **CodeLens Integration**: View live complexity scores above your C# methods.
- **Deep Attribution**: Inlay hints (using Roslyn and LSP) pinpoint exactly which code constructs add to the cognitive load.
- **Diagnostic Integration**: Seamlessly integrates with the Visual Studio Error List, flagging complex methods during development.

---

## 🛠️ Build & Installation

### 1. Unified Engine Build

From the repository root, build the shared analysis engine:

```bash
bun run build:vs
```

_This prepares the LSP server and Tree-Sitter binaries in the local Resources directory._

### 2. Solution Compilation

- Open `packages/visual-studio-extension/CognitiveComplexity.sln` in **Visual Studio 2022**.
- Build the solution (`Ctrl+Shift+B`).
- Locate the `.vsix` in the output folder and install.

---

## 🧮 Methodology

Specifically tuned for the .NET ecosystem:

- **Rule Alignment**: Matches **SonarSource C#** (Sonar-DotNet) rules (Logical OR `||` contribution, `goto` penalties, etc.).
- **Aggregation**: Nested lambdas and anonymous types contribute to the parent method's total score.

---

## 🐛 Debugging

1. Open the solution in VS 2022.
2. Select the `CognitiveComplexity` project as the Startup Project.
3. Press **F5** to start an Experimental Instance of Visual Studio.

---

<p align="center">Empowering C# developers to build cleaner, more readable logic.</p>
