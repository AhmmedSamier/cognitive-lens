# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-28T13:03:32.720Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 482.61 ms | 9.65 s | 20 |
| Core: Complexity Calculation | 723.32 ms | 14.47 s | 20 |
| Core: Incremental Parsing | 12.91 ms | 645.75 ms | 50 |
| LSP: Handle Open | 49.14 ms | 982.70 ms | 20 |
| LSP: Complexity Calc | 84.39 ms | 1.69 s | 20 |
| LSP: CodeLens | 869.05 �s | 17.38 ms | 20 |
| LSP: InlayHints | 10.74 ms | 214.83 ms | 20 |
| LSP: Handle Change | 1.87 ms | 37.41 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 749.20 MB | 692.40 MB |
| LSP: Memory Usage | 788.50 MB | 1250.12 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 187.11 �s | 18.71 ms | 100 |
| Webview Update | 4.77 �s | 476.51 �s | 100 |
