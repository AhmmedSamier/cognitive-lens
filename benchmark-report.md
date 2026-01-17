# Cognitive Complexity Extensions Benchmark Report

Date: 2026-01-17T20:41:51.091Z

## Language Server

| Benchmark | Average Time | Total Time | Iterations |
|---|---|---|---|
| Core: Full Parsing | 540.70 ms | 10.81 s | 20 |
| Core: Complexity Calculation | 1.85 s | 37.08 s | 20 |
| Core: Incremental Parsing | 19.78 ms | 988.95 ms | 50 |
| LSP: Handle Open | 65.52 ms | 1.31 s | 20 |
| LSP: Complexity Calc | 129.96 ms | 2.60 s | 20 |
| LSP: CodeLens | 724.30 µs | 14.49 ms | 20 |
| LSP: InlayHints | 6.74 ms | 134.79 ms | 20 |
| LSP: Handle Change | 40.26 ms | 805.25 ms | 20 |

### Memory Usage

| Component | RSS | Heap Used |
|---|---|---|
| Core: Memory Usage | 1905.13 MB | 1666.70 MB |
| LSP: Memory Usage | 1825.29 MB | 1254.07 MB |

## VS Code Extension

| Benchmark | Average Time | Total Time |
|---|---|---|
| Activation | - | Skipped |
| Complexity Calculation | - | Skipped |
