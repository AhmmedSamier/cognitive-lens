# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-29T12:47:13.691Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 411.29 ms | 8.23 s | 20 |
| Core: Complexity Calculation | 688.46 ms | 13.77 s | 20 |
| Core: Incremental Parsing | 3.42 ms | 170.97 ms | 50 |
| LSP: Handle Open | 43.86 ms | 877.27 ms | 20 |
| LSP: Complexity Calc | 80.57 ms | 1.61 s | 20 |
| LSP: CodeLens | 625.46 �s | 12.51 ms | 20 |
| LSP: InlayHints | 4.51 ms | 90.20 ms | 20 |
| LSP: Handle Change | 947.40 �s | 18.95 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 734.61 MB | 1668.15 MB |
| LSP: Memory Usage | 843.47 MB | 1251.88 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 160.30 �s | 16.03 ms | 100 |
| Webview Update | 4.88 �s | 488.20 �s | 100 |
