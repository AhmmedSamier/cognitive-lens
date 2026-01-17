import { calculateComplexity } from '@cognitive-complexity/core';
import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Language, Parser } from 'web-tree-sitter';
import { IncrementalParser } from '../src/IncrementalParser';
import { computeCodeLenses, computeInlayHints, defaultSettings } from '../src/logic';

export interface BenchmarkResult {
  name: string;
  metrics: { [key: string]: number | string };
}

async function measure(name: string, fn: () => Promise<void> | void, iterations: number = 50): Promise<BenchmarkResult> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  const totalTime = end - start;
  const averageTime = totalTime / iterations;

  console.log(`[${name}] Average: ${averageTime.toFixed(2)}ms | Total: ${totalTime.toFixed(2)}ms (${iterations} runs)`);

  return {
    name,
    metrics: {
      averageTimeMs: averageTime,
      totalTimeMs: totalTime,
      iterations: iterations
    }
  };
}

export async function runLSPBenchmark(): Promise<BenchmarkResult[]> {
  // 1. Initialize Parsers
  await Parser.init();
  const parsers: any = {};

  // Helper to load language
  async function loadLang(name: string, relPath: string) {
    const wasmPath = path.resolve(import.meta.dir, relPath);
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM not found: ${wasmPath}`);
    }
    const lang = await Language.load(wasmPath);
    const p = new Parser();
    p.setLanguage(lang);
    return p;
  }

  // Paths relative to packages/language-server/benchmark/index.ts
  parsers.typescript = await loadLang('typescript', '../../vscode-extension/public/tree-sitter-typescript.wasm');

  const incrementalParser = new IncrementalParser(parsers);

  const baseFunction = `
    function complexFunction(a, b, x, y) {
        if (a) {
            if (b) {
                console.log('nested');
            } else {
                console.log('else');
            }
        }
    }
  `;
  const iterations = 500;
  const code = baseFunction.repeat(iterations);

  const uri = 'file:///benchmark.ts';
  const textDocument = TextDocument.create(uri, 'typescript', 1, code);

  // Measure IncrementalParser.handleOpen
  const openResult = await measure('LSP: Handle Open', async () => {
    // We reuse version 1 to simulate re-opening or just initial open cost
    await incrementalParser.handleOpen({ textDocument: { uri, languageId: 'typescript', version: 1, text: code } });
  }, 20);

  // Measure Complexity Calculation (Logic integration)
  const tree = incrementalParser.getTree(uri);
  // We need to ensure tree exists. handleOpen should have created it.

  let complexities: any[] = [];
  const calcResult = await measure('LSP: Complexity Calc', async () => {
    complexities = await calculateComplexity(tree, 'typescript');
  }, 20);

  // Measure Compute CodeLens
  let lenses: any[] = [];
  const lensResult = await measure('LSP: CodeLens', () => {
    lenses = computeCodeLenses(textDocument, complexities, defaultSettings);
  }, 20);

  // Measure Compute InlayHints
  let hints: any[] = [];
  const hintsResult = await measure('LSP: InlayHints', () => {
    hints = computeInlayHints(textDocument, complexities, defaultSettings, { start: { line: 0, character: 0 }, end: { line: textDocument.lineCount, character: 0 } });
  }, 20);

  // Measure Incremental Update
  let currentText = code;
  let currentVersion = 2;
  const updateResult = await measure('LSP: Handle Change', async () => {
      // Prepend space
      await incrementalParser.handleChange({
          textDocument: { uri, version: ++currentVersion },
          contentChanges: [{
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              text: ' '
          }]
      });
      currentText = ' ' + currentText;
  }, 20);

  const memoryUsage = process.memoryUsage();

  return [
    {
        name: 'LSP: Handle Open',
        metrics: { ...openResult.metrics }
    },
    {
        name: 'LSP: Complexity Calc',
        metrics: { ...calcResult.metrics, methods: complexities.length }
    },
    {
        name: 'LSP: CodeLens',
        metrics: { ...lensResult.metrics, count: lenses.length }
    },
    {
        name: 'LSP: InlayHints',
        metrics: { ...hintsResult.metrics, count: hints.length }
    },
    {
        name: 'LSP: Handle Change',
        metrics: { ...updateResult.metrics }
    },
    {
      name: 'LSP: Memory Usage',
      metrics: {
        rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      },
    },
  ];
}

if (import.meta.main) {
  runLSPBenchmark().catch(console.error);
}
