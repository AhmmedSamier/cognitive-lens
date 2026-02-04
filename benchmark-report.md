# Cognitive Complexity Extensions Benchmark Report

Date: 2026-02-04T12:48:43.266Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 412.48 ms | 8.25 s | 20 |
| Core: Complexity Calculation | 512.70 ms | 10.25 s | 20 |
| Core: Incremental Parsing | 3.48 ms | 173.98 ms | 50 |
| LSP: Handle Open | 43.22 ms | 864.38 ms | 20 |
| LSP: Complexity Calc | 60.20 ms | 1.20 s | 20 |
| LSP: CodeLens | 616.14 �s | 12.32 ms | 20 |
| LSP: InlayHints | 4.71 ms | 94.20 ms | 20 |
| LSP: Handle Change | 1.05 ms | 21.10 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 734.43 MB | 1666.70 MB |
| LSP: Memory Usage | 844.29 MB | 1251.87 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 162.25 �s | 16.22 ms | 100 |
| Webview Update | 4.96 �s | 495.50 �s | 100 |
