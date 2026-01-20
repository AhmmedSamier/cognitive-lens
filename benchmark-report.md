# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-20T12:40:08.426Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 353.52 ms | 7.07 s | 20 |
| Core: Complexity Calculation | 955.52 ms | 19.11 s | 20 |
| Core: Incremental Parsing | 3.56 ms | 178.05 ms | 50 |
| LSP: Handle Open | 56.75 ms | 1.13 s | 20 |
| LSP: Complexity Calc | 107.01 ms | 2.14 s | 20 |
| LSP: CodeLens | 686.74 �s | 13.73 ms | 20 |
| LSP: InlayHints | 4.94 ms | 98.77 ms | 20 |
| LSP: Handle Change | 1.08 ms | 21.57 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 1209.72 MB | 1668.15 MB |
| LSP: Memory Usage | 954.13 MB | 1252.14 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 183.67 �s | 18.37 ms | 100 |
| Webview Update | 4.71 �s | 471.28 �s | 100 |
