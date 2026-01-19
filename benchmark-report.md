# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-19T12:42:39.813Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 530.70 ms | 10.61 s | 20 |
| Core: Complexity Calculation | 1.24 s | 24.72 s | 20 |
| Core: Incremental Parsing | 12.22 ms | 610.96 ms | 50 |
| LSP: Handle Open | 58.95 ms | 1.18 s | 20 |
| LSP: Complexity Calc | 107.45 ms | 2.15 s | 20 |
| LSP: CodeLens | 680.25 �s | 13.60 ms | 20 |
| LSP: InlayHints | 5.08 ms | 101.66 ms | 20 |
| LSP: Handle Change | 1.01 ms | 20.16 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 1219.14 MB | 1666.70 MB |
| LSP: Memory Usage | 1051.81 MB | 1252.13 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Delta Decorations | 153.13 �s | 15.31 ms | 100 |
| Webview Update | 4.32 �s | 431.64 �s | 100 |
