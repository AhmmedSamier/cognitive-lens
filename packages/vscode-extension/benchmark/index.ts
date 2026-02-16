import * as vscode from 'vscode';
import { updateDeltaDecorations } from '../src/DeltaDecorator';
import { ComplexityWebviewProvider } from '../src/ComplexityWebviewProvider';
import { MethodComplexity } from '../src/types';

export interface BenchmarkResult {
  name: string;
  metrics: { [key: string]: number | string };
}

async function measure(name: string, fn: () => void | Promise<void>, iterations: number = 100): Promise<BenchmarkResult> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  const totalTime = end - start;
  const averageTime = totalTime / iterations;

  console.log(`[VSCode] ${name}: Average ${averageTime.toFixed(3)}ms | Total ${totalTime.toFixed(2)}ms (${iterations} runs)`);

  return {
    name,
    metrics: {
      averageTimeMs: averageTime,
      totalTimeMs: totalTime,
      iterations: iterations
    }
  };
}

// Mock Helpers
function createMockEditor(lineCount: number) {
  return {
    document: {
      uri: { toString: () => 'file:///mock.ts' },
      positionAt: (offset: number) => {
        const line = Math.floor(offset / 10) % lineCount;
        return new vscode.Position(line, offset % 10);
      },
      lineAt: (line: number) => ({
        range: new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 10))
      })
    },
    setDecorations: (_type: any, _ranges: any[]) => {}
  } as unknown as vscode.TextEditor;
}

function generateComplexities(count: number): MethodComplexity[] {
  const complexities: MethodComplexity[] = [];
  for (let i = 0; i < count; i++) {
    complexities.push({
      name: `method${i}`,
      score: (i * 7) % 30,
      complexityDelta: (i % 5) - 2,
      startIndex: i * 20,
      endIndex: i * 20 + 15,
      startLine: i * 2,
      endLine: i * 2 + 1,
      isCallback: false
    });
  }
  return complexities;
}

export async function runVSCodeBenchmark(): Promise<BenchmarkResult[]> {
  console.log('[VSCode] Starting VS Code Extension Benchmarks...');

  const results: BenchmarkResult[] = [];

  // 1. Delta Decorator Benchmark
  const complexities = generateComplexities(1000);
  const largeComplexities = generateComplexities(5000);
  const editor = createMockEditor(2000);

  const decoratorResult = await measure('Delta Decorations', () => {
    updateDeltaDecorations(editor, complexities);
  }, 100);
  results.push(decoratorResult);

  const largeDecoratorResult = await measure('Delta Decorations (Large)', () => {
    updateDeltaDecorations(editor, largeComplexities);
  }, 50);
  results.push(largeDecoratorResult);

  // 2. Webview Provider Update Benchmark
  const provider = new ComplexityWebviewProvider(vscode.Uri.parse('file:///extension'));

  // Mock the webview
  const mockWebview = {
    options: {},
    html: '',
    onDidReceiveMessage: () => ({ dispose: () => {} }),
    asWebviewUri: (uri: any) => uri,
    cspSource: 'self',
    postMessage: () => Promise.resolve(true)
  } as unknown as vscode.Webview;

  const mockWebviewView = {
    webview: mockWebview,
    visible: true,
    onDidChangeVisibility: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} })
  } as unknown as vscode.WebviewView;

  provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

  const webviewResult = await measure('Webview Update', () => {
    provider.update(complexities);
  }, 100);
  results.push(webviewResult);

  const webviewLargeResult = await measure('Webview Update (Large)', () => {
    provider.update(largeComplexities);
  }, 50);
  results.push(webviewLargeResult);

  return results;
}
