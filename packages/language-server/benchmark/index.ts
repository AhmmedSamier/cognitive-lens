import * as path from 'path';
import * as fs from 'fs';
import { Language, Parser } from 'web-tree-sitter';
import { IncrementalParser } from '../src/IncrementalParser';
import { computeCodeLenses, computeInlayHints, defaultSettings } from '../src/logic';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { calculateComplexity } from '@cognitive-complexity/core';

export interface BenchmarkResult {
  name: string;
  metrics: { [key: string]: number | string };
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
  // We are in packages/language-server/benchmark/
  // VSCode ext root is ../../vscode-extension/

  parsers.typescript = await loadLang('typescript', '../../vscode-extension/public/tree-sitter-typescript.wasm');
  // Add other languages if needed, but TypeScript is enough for logic benchmark

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
  const startOpen = performance.now();
  await incrementalParser.handleOpen({ textDocument: { uri, languageId: 'typescript', version: 1, text: code } });
  const endOpen = performance.now();
  const openTime = endOpen - startOpen;
  console.log(`[LSP] Handle Open time: ${openTime.toFixed(2)} ms`);

  // Measure Complexity Calculation (Logic integration)
  const tree = incrementalParser.getTree(uri);
  const startCalc = performance.now();
  const complexities = await calculateComplexity(tree, 'typescript');
  const endCalc = performance.now();
  const calcTime = endCalc - startCalc;
  console.log(`[LSP] Complexity Calc time: ${calcTime.toFixed(2)} ms`);

  // Measure Compute CodeLens
  const startLens = performance.now();
  const lenses = computeCodeLenses(textDocument, complexities, defaultSettings);
  const endLens = performance.now();
  const lensTime = endLens - startLens;
  console.log(`[LSP] Compute CodeLens time: ${lensTime.toFixed(2)} ms`);

  // Measure Compute InlayHints
  const startHints = performance.now();
  const hints = computeInlayHints(textDocument, complexities, defaultSettings, { start: { line: 0, character: 0 }, end: { line: textDocument.lineCount, character: 0 } });
  const endHints = performance.now();
  const hintsTime = endHints - startHints;
  console.log(`[LSP] Compute InlayHints time: ${hintsTime.toFixed(2)} ms`);

  // Measure Incremental Update

  // Create a new text with the change applied
  const newText = ' ' + code;

  const startUpdate = performance.now();
  incrementalParser.handleChange({
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: newText }]
  });
  const endUpdate = performance.now();
  const updateTime = endUpdate - startUpdate;
  console.log(`[LSP] Handle Change time: ${updateTime.toFixed(2)} ms`);

  const memoryUsage = process.memoryUsage();

  return [
    {
        name: 'LSP: Handle Open',
        metrics: { timeMs: openTime }
    },
    {
        name: 'LSP: Complexity Calc',
        metrics: { timeMs: calcTime, methods: complexities.length }
    },
    {
        name: 'LSP: CodeLens',
        metrics: { timeMs: lensTime, count: lenses.length }
    },
    {
        name: 'LSP: InlayHints',
        metrics: { timeMs: hintsTime, count: hints.length }
    },
    {
        name: 'LSP: Handle Change',
        metrics: { timeMs: updateTime }
    },
    {
        name: 'LSP: Memory Usage',
        metrics: {
            rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
            heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        }
    }
  ];
}

if (import.meta.main) {
    runLSPBenchmark().catch(console.error);
}
