import * as fs from 'fs';
import { runCoreBenchmark } from '../packages/core/benchmark/index.ts';
import { runLSPBenchmark } from '../packages/language-server/benchmark/index.ts';

async function main() {
  console.log('Starting benchmarks...');

  const results: any[] = [];
  let hasError = false;

  // Core
  try {
    console.log('Running Core Benchmarks...');
    const coreResults = await runCoreBenchmark();
    results.push(...coreResults);
  } catch (e) {
    console.error('Core benchmark failed:', e);
    hasError = true;
  }

  // LSP
  try {
    console.log('Running LSP Benchmarks...');
    const lspResults = await runLSPBenchmark();
    results.push(...lspResults);
  } catch (e) {
    console.error('LSP benchmark failed:', e);
    hasError = true;
  }

  // VS Code (Skipped)
  results.push({
    name: 'VS Code Extension',
    metrics: {
      note: 'Skipped - Requires VS Code Environment',
    },
  });

  // Generate Report
  let report = '# Cognitive Complexity Extensions Benchmark Report\n\n';
  report += `Date: ${new Date().toISOString()}\n\n`;
  report += '| Name | Metrics |\n';
  report += '|---|---|\n';

  for (const res of results) {
    const metricsStr = Object.entries(res.metrics)
      .map(([k, v]) => `**${k}**: ${v}`)
      .join('<br>');
    report += `| ${res.name} | ${metricsStr} |\n`;
  }

  console.log('\n' + report);
  fs.writeFileSync('benchmark-report.md', report);
  console.log('Report saved to benchmark-report.md');

  if (hasError) {
    process.exitCode = 1;
  }
}

main().catch(console.error);
