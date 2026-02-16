import * as fs from 'fs';
import * as path from 'path';
import { runCoreBenchmark } from '../packages/core/benchmark/index.ts';
import { runLSPBenchmark } from '../packages/language-server/benchmark/index.ts';

function setupMocks() {
  const mockSource = path.resolve(__dirname, '../packages/vscode-extension/benchmark/mocks/vscode');
  const nodeModules = path.resolve(__dirname, '../node_modules');
  const mockDest = path.join(nodeModules, 'vscode');

  if (!fs.existsSync(nodeModules)) {
    fs.mkdirSync(nodeModules, { recursive: true });
  }

  // If mock doesn't exist in node_modules, copy it
  if (!fs.existsSync(mockDest)) {
    console.log('Setting up VS Code mock in node_modules...');
    fs.mkdirSync(mockDest, { recursive: true });
    fs.copyFileSync(path.join(mockSource, 'package.json'), path.join(mockDest, 'package.json'));
    fs.copyFileSync(path.join(mockSource, 'index.js'), path.join(mockDest, 'index.js'));
  }
}

function formatTime(ms: number): string {
  if (typeof ms !== 'number') return '-';
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + ' s';
  } else if (ms < 1) {
    return (ms * 1000).toFixed(2) + ' �s';
  } else {
    return ms.toFixed(2) + ' ms';
  }
}

async function main() {
  setupMocks();
  console.log('Starting benchmarks...');

  const coreResults = await runWithHandling('Core', 'Core Benchmarks', runCoreBenchmark);
  const lspResults = await runWithHandling('LSP', 'LSP Benchmarks', runLSPBenchmark);
  const vscodeResults = await runVSCodeWithHandling();

  const report = buildReport(coreResults, lspResults, vscodeResults);

  console.log('\nReport Preview:');
  console.log(report);
  fs.writeFileSync('benchmark-report.md', report);
  console.log('Report saved to benchmark-report.md');
}

async function runWithHandling(
  label: string,
  logLabel: string,
  runner: () => Promise<any[]>,
): Promise<any[]> {
  let results: any[] = [];
  try {
    console.log(`Running ${logLabel}...`);
    results = await runner();
  } catch (e) {
    console.error(`${label} benchmark failed:`, e);
    results.push({ name: `${label}: Failed`, metrics: { error: String(e) } });
  }
  return results;
}

async function runVSCodeWithHandling(): Promise<any[]> {
  return runWithHandling('VS Code', 'VS Code Benchmarks', async () => {
    const { runVSCodeBenchmark } = await import(
      '../packages/vscode-extension/benchmark/index.ts'
    );
    return runVSCodeBenchmark();
  });
}

function buildReport(coreResults: any[], lspResults: any[], vscodeResults: any[]): string {
  let report = '# Cognitive Complexity Extensions Benchmark Report\n\n';
  report += `Date: ${new Date().toISOString()}\n\n`;

  const lsResults = [...coreResults, ...lspResults];
  report += buildLanguageServerSection(lsResults);
  report += buildVSCodeSection(vscodeResults);

  return report;
}

function buildLanguageServerSection(lsResults: any[]): string {
  let section = '## Language Server\n\n';
  section += '| Benchmark | Average Time | Total Time | Iterations |\n';
  section += '|---|---|---|---|\n';

  const memoryResults: any[] = [];

  for (const res of lsResults) {
    if (res.name.includes('Memory Usage')) {
      memoryResults.push(res);
      continue;
    }
    if (res.metrics.error) {
      section += `| ${res.name} | Error: ${res.metrics.error} | - | - |\n`;
      continue;
    }

    const avg = formatTime(res.metrics.averageTimeMs as number);
    const total = formatTime(res.metrics.totalTimeMs as number);
    const iter = res.metrics.iterations || 1;
    section += `| ${res.name} | ${avg} | ${total} | ${iter} |\n`;
  }

  if (memoryResults.length > 0) {
    section += '\n### Memory Usage\n\n';
    section += '| Component | RSS | Heap Used |\n';
    section += '|---|---|---|\n';
    for (const res of memoryResults) {
      const rss = res.metrics.rssMB ? `${res.metrics.rssMB} MB` : '-';
      const heap = res.metrics.heapUsedMB ? `${res.metrics.heapUsedMB} MB` : '-';
      section += `| ${res.name} | ${rss} | ${heap} |\n`;
    }
  }

  return section;
}

function buildVSCodeSection(vscodeResults: any[]): string {
  let section = '\n## VS Code Extension\n\n';
  section += '| Benchmark | Average Time | Total Time | Iterations |\n';
  section += '|---|---|---|---|\n';

  for (const res of vscodeResults) {
    if (res.metrics.error) {
      section += `| ${res.name} | Error: ${res.metrics.error} | - | - |\n`;
      continue;
    }
    const avg = formatTime(res.metrics.averageTimeMs as number);
    const total = formatTime(res.metrics.totalTimeMs as number);
    const iter = res.metrics.iterations || 1;
    section += `| ${res.name} | ${avg} | ${total} | ${iter} |\n`;
  }

  return section;
}

main().catch(console.error);
