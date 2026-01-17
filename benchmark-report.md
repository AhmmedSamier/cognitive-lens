# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-17T23:14:25.957Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 496.41 ms | 9.93 s | 20 |
| Core: Complexity Calculation | 1.01 s | 20.17 s | 20 |
| Core: Incremental Parsing | 3.53 ms | 176.60 ms | 50 |
| LSP: Handle Open | 59.19 ms | 1.18 s | 20 |
| LSP: Complexity Calc | 110.81 ms | 2.22 s | 20 |
| LSP: CodeLens | 702.88 �s | 14.06 ms | 20 |
| LSP: InlayHints | 4.98 ms | 99.70 ms | 20 |
| LSP: Handle Change | 1.02 ms | 20.40 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 1239.75 MB | 1666.72 MB |
| LSP: Memory Usage | 1068.29 MB | 1252.21 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 156.99 �s | 15.70 ms | 100 |
| Webview Update | 4.71 �s | 470.52 �s | 100 |
