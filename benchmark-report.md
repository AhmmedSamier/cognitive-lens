# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-27T13:14:13.466Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 335.07 ms | 6.70 s | 20 |
| Core: Complexity Calculation | 670.10 ms | 13.40 s | 20 |
| Core: Incremental Parsing | 3.66 ms | 183.23 ms | 50 |
| LSP: Handle Open | 63.45 ms | 1.27 s | 20 |
| LSP: Complexity Calc | 87.39 ms | 1.75 s | 20 |
| LSP: CodeLens | 625.79 �s | 12.52 ms | 20 |
| LSP: InlayHints | 5.07 ms | 101.31 ms | 20 |
| LSP: Handle Change | 1.74 ms | 34.85 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 749.88 MB | 1668.15 MB |
| LSP: Memory Usage | 851.79 MB | 1255.51 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 185.87 �s | 18.59 ms | 100 |
| Webview Update | 5.14 �s | 514.25 �s | 100 |
