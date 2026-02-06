# Cognitive Complexity Extensions Benchmark Report

Date: 2026-02-06T13:03:11.354Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 597.22 ms | 11.94 s | 20 |
| Core: Complexity Calculation | 545.73 ms | 10.91 s | 20 |
| Core: Incremental Parsing | 12.17 ms | 608.28 ms | 50 |
| LSP: Handle Open | 80.82 ms | 1.62 s | 20 |
| LSP: Complexity Calc | 64.17 ms | 1.28 s | 20 |
| LSP: CodeLens | 820.02 �s | 16.40 ms | 20 |
| LSP: InlayHints | 17.37 ms | 347.31 ms | 20 |
| LSP: Handle Change | 3.13 ms | 62.62 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 734.13 MB | 1666.72 MB |
| LSP: Memory Usage | 841.52 MB | 1251.48 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 204.35 �s | 20.44 ms | 100 |
| Webview Update | 5.47 �s | 546.71 �s | 100 |
