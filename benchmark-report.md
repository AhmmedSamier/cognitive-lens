# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-30T13:55:18.367Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 355.54 ms | 7.11 s | 20 |
| Core: Complexity Calculation | 631.32 ms | 12.63 s | 20 |
| Core: Incremental Parsing | 3.48 ms | 173.93 ms | 50 |
| LSP: Handle Open | 42.28 ms | 845.59 ms | 20 |
| LSP: Complexity Calc | 70.82 ms | 1.42 s | 20 |
| LSP: CodeLens | 613.26 �s | 12.27 ms | 20 |
| LSP: InlayHints | 11.13 ms | 222.65 ms | 20 |
| LSP: Handle Change | 1.81 ms | 36.14 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 734.93 MB | 1668.16 MB |
| LSP: Memory Usage | 843.64 MB | 1251.89 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 165.22 �s | 16.52 ms | 100 |
| Webview Update | 4.57 �s | 457.42 �s | 100 |
