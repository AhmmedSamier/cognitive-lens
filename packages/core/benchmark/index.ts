import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

export interface BenchmarkResult {
  name: string;
  metrics: { [key: string]: number | string };
}

export async function runCoreBenchmark(): Promise<BenchmarkResult[]> {
  await Parser.init();
  const parser = new Parser();
  const langPath = path.resolve(
    import.meta.dir,
    '../../vscode-extension/public/tree-sitter-typescript.wasm',
  );
  const lang = await Language.load(langPath);
  parser.setLanguage(lang);

  const baseFunction = `
    function complexFunction(a, b, x, y) {
        if (a) {
            if (b) {
                console.log('nested');
            } else {
                console.log('else');
            }
        }
        for (let i = 0; i < 10; i++) {
            if (i % 2 == 0) {
                console.log('even');
            }
        }
        switch (x) {
            case 1:
                if (y) break;
                break;
            default:
                break;
        }
    }
    `;

  const iterations = 2000;
  const code = baseFunction.repeat(iterations);

  console.log(`[Core] Running benchmark with ${iterations} function definitions...`);
  const codeSizeMB = (code.length / 1024 / 1024).toFixed(2);
  console.log(`[Core] Code size: ${codeSizeMB} MB`);

  // Warmup
  parser.parse(baseFunction);

  // Measure Parsing (Full)
  const startParse = performance.now();
  const tree = parser.parse(code);
  const endParse = performance.now();
  const parseTime = endParse - startParse;
  console.log(`[Core] Full Parsing time: ${parseTime.toFixed(2)} ms`);

  // Measure Complexity Calculation
  const startCalc = performance.now();
  const results = await calculateComplexity(tree, 'typescript');
  const endCalc = performance.now();
  const calcTime = endCalc - startCalc;
  console.log(`[Core] Complexity calculation time: ${calcTime.toFixed(2)} ms`);

  console.log(`[Core] Total methods processed: ${results.length}`);

  // Measure Incremental Parsing
  const editStartIndex = 10;
  const oldEndIndex = 10;
  const newEndIndex = 11;
  const startPosition = { row: 0, column: 10 };
  const oldEndPosition = { row: 0, column: 10 };
  const newEndPosition = { row: 0, column: 11 };

  const newCode = code.slice(0, 10) + ' ' + code.slice(10);

  tree.edit({
    startIndex: editStartIndex,
    oldEndIndex: oldEndIndex,
    newEndIndex: newEndIndex,
    startPosition: startPosition,
    oldEndPosition: oldEndPosition,
    newEndPosition: newEndPosition,
  });

  const startIncParse = performance.now();
  parser.parse(newCode, tree);
  const endIncParse = performance.now();
  const incParseTime = endIncParse - startIncParse;
  console.log(`[Core] Incremental Parsing time: ${incParseTime.toFixed(2)} ms`);

  // Memory Usage
  const memoryUsage = process.memoryUsage();

  return [
    {
      name: 'Core: Full Parsing',
      metrics: {
        timeMs: parseTime,
        codeSizeMB: codeSizeMB,
      },
    },
    {
      name: 'Core: Complexity Calculation',
      metrics: {
        timeMs: calcTime,
        methodsProcessed: results.length,
      },
    },
    {
      name: 'Core: Incremental Parsing',
      metrics: {
        timeMs: incParseTime,
      },
    },
    {
      name: 'Core: Memory Usage',
      metrics: {
        rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      },
    },
  ];
}

// Check if running directly
if (import.meta.main) {
  runCoreBenchmark().catch(console.error);
}
