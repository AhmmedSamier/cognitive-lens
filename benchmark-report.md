# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-31T12:43:30.640Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 369.30 ms | 7.39 s | 20 |
| Core: Complexity Calculation | 591.29 ms | 11.83 s | 20 |
| Core: Incremental Parsing | 3.35 ms | 167.74 ms | 50 |
| LSP: Handle Open | 42.58 ms | 851.53 ms | 20 |
| LSP: Complexity Calc | 70.76 ms | 1.42 s | 20 |
| LSP: CodeLens | 747.49 �s | 14.95 ms | 20 |
| LSP: InlayHints | 16.03 ms | 320.55 ms | 20 |
| LSP: Handle Change | 1.69 ms | 33.86 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 734.33 MB | 1668.15 MB |
| LSP: Memory Usage | 841.07 MB | 1251.47 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 186.42 �s | 18.64 ms | 100 |
| Webview Update | 4.20 �s | 420.23 �s | 100 |
