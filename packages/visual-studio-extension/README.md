# Cognitive Lens for Visual Studio

This extension calculates and displays Cognitive Complexity for C# methods in Visual Studio.

## Features

-   **CodeLens**: Displays the total Cognitive Complexity score above each method.
-   **Inlay Hints**: Displays the complexity contribution of each line (e.g., `(+1 if)`).
-   **Diagnostics**: Shows warnings (yellow) and errors (red) when complexity exceeds configured thresholds.

## Prerequisites

*   Visual Studio 2022 (v17.9 or later recommended)

## Building

1.  **Build the Language Server Artifacts**:
    Run the build script from the repository root:
    ```bash
    bun run build:vs
    ```
    This command will build the language server and copy the necessary files (`server.js`, `tree-sitter.wasm`, etc.) into `packages/visual-studio-extension/Resources`.

2.  **Open in Visual Studio**:
    Open `packages/visual-studio-extension/CognitiveComplexity.sln` in Visual Studio.

3.  **Build the Solution**:
    Build the solution in Visual Studio to generate the VSIX file.

4.  **Install**:
    Double-click the generated VSIX file in the `bin/Debug` or `bin/Release` folder to install it.

## Debugging

1.  Open the solution in Visual Studio.
2.  Set the project as the startup project.
3.  Press F5 to launch the experimental instance of Visual Studio.
4.  Open a C# file to see the extension in action.
