import { Command } from 'commander';
import { check } from './commands/check';
import { report } from './commands/report';

const program = new Command();

program
  .name('cognitive-complexity')
  .description('CLI tool for calculating cognitive complexity')
  .version('0.1.0');

program
  .command('check')
  .description('Check complexity against thresholds')
  .argument('<glob>', 'File glob pattern (e.g., "src/**/*.ts")')
  .option('-t, --threshold <number>', 'Complexity threshold', '15')
  .option('-f, --fail-on-error', 'Exit with error code if threshold exceeded')
  .action(check);

program
  .command('report')
  .description('Generate complexity report')
  .argument('<glob>', 'File glob pattern')
  .option('-o, --output <path>', 'Output file path', 'complexity-report.html')
  .option('-f, --format <format>', 'Output format (html, json)', 'html')
  .action(report);

program.parse();
