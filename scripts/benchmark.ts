import { runCoreBenchmark } from '../packages/core/benchmark/index.ts';
import { runLSPBenchmark } from '../packages/language-server/benchmark/index.ts';
import * as fs from 'fs';

function formatTime(ms: number): string {
  if (typeof ms !== 'number') return '-';
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + ' s';
  } else if (ms < 1) {
    return (ms * 1000).toFixed(2) + ' µs';
  } else {
    return ms.toFixed(2) + ' ms';
  }
}

async function main() {
  console.log('Starting benchmarks...');

  let coreResults: any[] = [];
  try {
    console.log('Running Core Benchmarks...');
    coreResults = await runCoreBenchmark();
  } catch (e) {
    console.error('Core benchmark failed:', e);
    coreResults.push({ name: 'Core: Failed', metrics: { error: String(e) } });
  }

  let lspResults: any[] = [];
  try {
    console.log('Running LSP Benchmarks...');
    lspResults = await runLSPBenchmark();
  } catch (e) {
    console.error('LSP benchmark failed:', e);
    lspResults.push({ name: 'LSP: Failed', metrics: { error: String(e) } });
  }

  // Generate Report
  let report = '# Cognitive Complexity Extensions Benchmark Report\n\n';
  report += `Date: ${new Date().toISOString()}\n\n`;

  // Language Server Section
  report += '## Language Server\n\n';
  report += '| Benchmark | Average Time | Total Time | Iterations |\n';
  report += '|---|---|---|---|\n';

  const lsResults = [...coreResults, ...lspResults];
  const memoryResults: any[] = [];

  for (const res of lsResults) {
    if (res.name.includes('Memory Usage')) {
        memoryResults.push(res);
        continue;
    }
    // If error, print it in Average Time column
    if (res.metrics.error) {
        report += `| ${res.name} | Error: ${res.metrics.error} | - | - |\n`;
        continue;
    }

    const avg = formatTime(res.metrics.averageTimeMs as number);
    const total = formatTime(res.metrics.totalTimeMs as number);
    const iter = res.metrics.iterations || 1;
    report += `| ${res.name} | ${avg} | ${total} | ${iter} |\n`;
  }

  if (memoryResults.length > 0) {
      report += '\n### Memory Usage\n\n';
      report += '| Component | RSS | Heap Used |\n';
      report += '|---|---|---|\n';
      for (const res of memoryResults) {
          const rss = res.metrics.rssMB ? `${res.metrics.rssMB} MB` : '-';
          const heap = res.metrics.heapUsedMB ? `${res.metrics.heapUsedMB} MB` : '-';
          report += `| ${res.name} | ${rss} | ${heap} |\n`;
      }
  }

  // VS Code Extension Section
  report += '\n## VS Code Extension\n\n';
  report += '| Benchmark | Average Time | Total Time |\n';
  report += '|---|---|---|\n';
  report += '| Activation | - | Skipped |\n';
  report += '| Complexity Calculation | - | Skipped |\n';

  console.log('\nReport Preview:');
  console.log(report);
  fs.writeFileSync('benchmark-report.md', report);
  console.log('Report saved to benchmark-report.md');
}

main().catch(console.error);
