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
  const tsParser = new Parser();
  const tsLangPath = path.resolve(
    import.meta.dir,
    '../../vscode-extension/public/tree-sitter-typescript.wasm',
  );
  const tsLang = await Language.load(tsLangPath);
  tsParser.setLanguage(tsLang);

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
  tsParser.parse(baseFunction);

  // Measure Parsing (Full)
  const fullParsingResult = await measure('Core: Full Parsing', () => {
    tsParser.parse(code);
  }, 20);

  // Measure Complexity Calculation
  const tree = tsParser.parse(code);
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

    currentTree = tsParser.parse(newCode, currentTree);
    currentCode = newCode;
  }, 50);

  // C# Benchmarks
  const csharpParser = new Parser();
  const csharpLangPath = path.resolve(
    import.meta.dir,
    '../../language-server/tree-sitter-c_sharp.wasm',
  );
  const csharpLang = await Language.load(csharpLangPath);
  csharpParser.setLanguage(csharpLang);

  const csharpBase = `
    class Test {
        void Process(bool a, bool b, int x) {
            if (a) {
                if (b) {
                    Console.WriteLine("nested");
                } else {
                    Console.WriteLine("else");
                }
            }
            for (int i = 0; i < 10; i++) {
                if (i % 2 == 0) {
                    Console.WriteLine(i);
                }
            }
            switch (x) {
                case 1:
                    Console.WriteLine("one");
                    break;
                default:
                    Console.WriteLine("other");
                    break;
            }
        }
    }
  `;

  const csharpIterations = 1500;
  const csharpCode = csharpBase.repeat(csharpIterations);

  const csharpFullParsingResult = await measure('Core C#: Full Parsing', () => {
    csharpParser.parse(csharpCode);
  }, 20);

  const csharpTree = csharpParser.parse(csharpCode);
  let csharpMethodsProcessed = 0;
  const csharpComplexityResult = await measure('Core C#: Complexity Calculation', async () => {
    const results = await calculateComplexity(csharpTree, 'csharp');
    csharpMethodsProcessed = results.length;
  }, 20);

  let csharpCurrentTree = csharpTree;
  let csharpCurrentCode = csharpCode;
  const csharpIncrementalResult = await measure('Core C#: Incremental Parsing', () => {
    const insertIndex = 10;
    const newCode = csharpCurrentCode.slice(0, insertIndex) + ' ' + csharpCurrentCode.slice(insertIndex);

    csharpCurrentTree.edit({
      startIndex: insertIndex,
      oldEndIndex: insertIndex,
      newEndIndex: insertIndex + 1,
      startPosition: { row: 0, column: insertIndex },
      oldEndPosition: { row: 0, column: insertIndex },
      newEndPosition: { row: 0, column: insertIndex + 1 },
    });

    csharpCurrentTree = csharpParser.parse(newCode, csharpCurrentTree);
    csharpCurrentCode = newCode;
  }, 50);

  // Dart Benchmarks
  const dartParser = new Parser();
  const dartLangPath = path.resolve(import.meta.dir, '../../language-server/tree-sitter-dart.wasm');
  const dartLang = await Language.load(dartLangPath);
  dartParser.setLanguage(dartLang);

  const dartBase = `
    void process(bool a, bool b, int x, bool y) {
      if (a) {
        if (b) {
          print('nested');
        } else {
          print('else');
        }
      }
      for (var i = 0; i < 10; i++) {
        if (i.isEven) {
          print(i);
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

  const dartIterations = 1500;
  const dartCode = dartBase.repeat(dartIterations);

  const dartFullParsingResult = await measure('Core Dart: Full Parsing', () => {
    dartParser.parse(dartCode);
  }, 20);

  const dartTree = dartParser.parse(dartCode);
  let dartMethodsProcessed = 0;
  const dartComplexityResult = await measure('Core Dart: Complexity Calculation', async () => {
    const results = await calculateComplexity(dartTree, 'dart');
    dartMethodsProcessed = results.length;
  }, 20);

  let dartCurrentTree = dartTree;
  let dartCurrentCode = dartCode;
  const dartIncrementalResult = await measure('Core Dart: Incremental Parsing', () => {
    const insertIndex = 10;
    const newCode = dartCurrentCode.slice(0, insertIndex) + ' ' + dartCurrentCode.slice(insertIndex);

    dartCurrentTree.edit({
      startIndex: insertIndex,
      oldEndIndex: insertIndex,
      newEndIndex: insertIndex + 1,
      startPosition: { row: 0, column: insertIndex },
      oldEndPosition: { row: 0, column: insertIndex },
      newEndPosition: { row: 0, column: insertIndex + 1 },
    });

    dartCurrentTree = dartParser.parse(newCode, dartCurrentTree);
    dartCurrentCode = newCode;
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
      name: 'Core C#: Full Parsing',
      metrics: {
        ...csharpFullParsingResult.metrics,
      },
    },
    {
      name: 'Core C#: Complexity Calculation',
      metrics: {
        ...csharpComplexityResult.metrics,
        methodsProcessed: csharpMethodsProcessed,
      },
    },
    {
      name: 'Core C#: Incremental Parsing',
      metrics: {
        ...csharpIncrementalResult.metrics,
      },
    },
    {
      name: 'Core Dart: Full Parsing',
      metrics: {
        ...dartFullParsingResult.metrics,
      },
    },
    {
      name: 'Core Dart: Complexity Calculation',
      metrics: {
        ...dartComplexityResult.metrics,
        methodsProcessed: dartMethodsProcessed,
      },
    },
    {
      name: 'Core Dart: Incremental Parsing',
      metrics: {
        ...dartIncrementalResult.metrics,
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
