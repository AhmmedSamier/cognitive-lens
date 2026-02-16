# Cognitive Complexity Extensions Benchmark Report

Date: 2026-02-16T07:53:33.036Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 215.74 ms | 4.31 s | 20 |
| Core: Complexity Calculation | 332.51 ms | 6.65 s | 20 |
| Core: Incremental Parsing | 2.60 ms | 129.86 ms | 50 |
| Core C#: Full Parsing | 252.08 ms | 5.04 s | 20 |
| Core C#: Complexity Calculation | 310.96 ms | 6.22 s | 20 |
| Core C#: Incremental Parsing | 1.50 ms | 74.91 ms | 50 |
| Core Dart: Full Parsing | 253.73 ms | 5.07 s | 20 |
| Core Dart: Complexity Calculation | 240.49 ms | 4.81 s | 20 |
| Core Dart: Incremental Parsing | 3.40 ms | 169.84 ms | 50 |
| LSP: Handle Open | 26.49 ms | 529.78 ms | 20 |
| LSP: Complexity Calc | 37.04 ms | 740.72 ms | 20 |
| LSP: CodeLens | 326.29 �s | 6.53 ms | 20 |
| LSP: InlayHints | 2.61 ms | 52.12 ms | 20 |
| LSP: Handle Change | 573.72 �s | 11.47 ms | 20 |
| LSP: Combined Features | 3.34 ms | 66.79 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 2393.89 MB | 7001.44 MB |
| LSP: Memory Usage | 2610.45 MB | 3948.76 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 109.57 �s | 10.96 ms | 100 |
| Delta Decorations (Large) | 379.79 �s | 18.99 ms | 50 |
| Webview Update | 2.73 �s | 273.10 �s | 100 |
| Webview Update (Large) | 2.47 �s | 123.60 �s | 50 |
