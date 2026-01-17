import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

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
  const fullParsingResult = await measure('Core: Full Parsing', () => {
    parser.parse(code);
  }, 20);

  // Measure Complexity Calculation
  const tree = parser.parse(code);
  let methodsProcessed = 0;
  const complexityResult = await measure('Core: Complexity Calculation', async () => {
    const results = await calculateComplexity(tree, 'typescript');
    methodsProcessed = results.length;
  }, 20);

  // Measure Incremental Parsing
  // We will simulate typing ' ' at index 10 repeatedly
  let currentTree = tree;
  let currentCode = code;

  const incrementalResult = await measure('Core: Incremental Parsing', () => {
    const insertIndex = 10;
    const newCode = currentCode.slice(0, insertIndex) + ' ' + currentCode.slice(insertIndex);

    currentTree.edit({
      startIndex: insertIndex,
      oldEndIndex: insertIndex,
      newEndIndex: insertIndex + 1,
      startPosition: { row: 0, column: insertIndex },
      oldEndPosition: { row: 0, column: insertIndex },
      newEndPosition: { row: 0, column: insertIndex + 1 },
    });

    currentTree = parser.parse(newCode, currentTree);
    currentCode = newCode;
  }, 50);

  // Memory Usage
  const memoryUsage = process.memoryUsage();

  return [
    {
        name: 'Core: Full Parsing',
        metrics: {
            ...fullParsingResult.metrics,
            codeSizeMB: codeSizeMB,
        }
    },
    {
        name: 'Core: Complexity Calculation',
        metrics: {
            ...complexityResult.metrics,
            methodsProcessed: methodsProcessed,
        }
    },
    {
        name: 'Core: Incremental Parsing',
        metrics: {
            ...incrementalResult.metrics
        }
    },
    {
        name: 'Core: Memory Usage',
        metrics: {
            rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
            heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        }
    }
  ];
}

// Check if running directly
if (import.meta.main) {
  runCoreBenchmark().catch(console.error);
}
