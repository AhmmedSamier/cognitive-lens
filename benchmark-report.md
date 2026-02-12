# Cognitive Complexity Extensions Benchmark Report

Date: 2026-02-05T12:46:01.139Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 728.72 ms | 14.57 s | 20 |
| Core: Complexity Calculation | 544.54 ms | 10.89 s | 20 |
| Core: Incremental Parsing | 13.38 ms | 669.04 ms | 50 |
| LSP: Handle Open | 68.75 ms | 1.37 s | 20 |
| LSP: Complexity Calc | 64.16 ms | 1.28 s | 20 |
| LSP: CodeLens | 702.95 �s | 14.06 ms | 20 |
| LSP: InlayHints | 14.05 ms | 280.96 ms | 20 |
| LSP: Handle Change | 1.97 ms | 39.36 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 732.77 MB | 1666.76 MB |
| LSP: Memory Usage | 840.59 MB | 1251.59 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 178.32 �s | 17.83 ms | 100 |
| Webview Update | 4.47 �s | 447.03 �s | 100 |
