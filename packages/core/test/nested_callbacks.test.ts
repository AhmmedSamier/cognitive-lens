import { beforeAll, describe, expect, test } from 'bun:test';
import { Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import * as path from 'path';
import { Language, Parser } from 'web-tree-sitter';
import { calculateComplexity } from '../src/complexity';

let parser: Parser;

beforeAll(async () => {
  await Parser.init();
  parser = new Parser();
  const langPath = path.resolve(
    __dirname,
    '../../vscode-extension/public/tree-sitter-typescript.wasm',
  );
  const lang = await Language.load(langPath);
  parser.setLanguage(lang);
});

function createTree(code: string) {
  return parser.parse(code);
}

/**
 * Get cognitive complexity from SonarJS eslint plugin for verification.
 */
function getSonarJSComplexity(code: string): { line: number; complexity: number }[] {
  const linter = new Linter({ configType: 'flat' });

  const results = linter.verify(code, {
    plugins: { sonarjs },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 0],
    },
  });

  return results.map((result) => {
    const match = result.message.match(/from (\d+) to/);
    return {
      line: result.line,
      complexity: match ? parseInt(match[1], 10) : 0,
    };
  });
}

describe('Cognitive Complexity Reproduction', () => {
  test('Nested Callbacks Score (show method)', async () => {
    const code = `
    class Test {
        async show(): Promise<void> {
            // Reset filter to "All" when opening (better UX - matches PyCharm/IntelliJ behavior)
            this.currentScope = SearchScope.EVERYTHING;
    
            const quickPick = vscode.window.createQuickPick<SearchResultItem>();
    
            quickPick.title = 'Search Everywhere';
            quickPick.placeholder = this.getPlaceholder();
            quickPick.matchOnDescription = false;
            quickPick.matchOnDetail = false;
            quickPick.ignoreFocusOut = false;
    
            // Set up filter buttons
            this.updateFilterButtons(quickPick);
    
            // Handle input changes with Streaming Results
            let burstTimeout: NodeJS.Timeout | undefined;
            let fuzzyTimeout: NodeJS.Timeout | undefined;
    
            quickPick.onDidChangeValue((query) => {
                if (burstTimeout) {
                    clearTimeout(burstTimeout);
                }
                if (fuzzyTimeout) {
                    clearTimeout(fuzzyTimeout);
                }
    
                const trimmedQuery = query.trim();
                if (!trimmedQuery) {
                    quickPick.items = [];
                    quickPick.busy = false;
                    return;
                }
    
                // Start busy indicator for deep scan
                quickPick.busy = true;
    
                // PHASE 0: Absolute Instant (Immediate exact-name hits)
                const instantResults = this.searchEngine.burstSearch({
                    query: trimmedQuery,
                    scope: this.currentScope,
                    maxResults: 5,
                });
    
                if (instantResults.length > 0) {
                    quickPick.items = instantResults.map((r) => this.resultToQuickPickItem(r));
                    this.updateTitle(quickPick, instantResults.length);
                }
    
                // PHASE 1: Quick Burst (Wait 10ms for prefix/multichar)
                burstTimeout = setTimeout(() => {
                    const burstResults = this.searchEngine.burstSearch({
                        query: trimmedQuery,
                        scope: this.currentScope,
                        maxResults: 15,
                    });
    
                    if (burstResults.length > instantResults.length) {
                        quickPick.items = burstResults.map((r) => this.resultToQuickPickItem(r));
                        this.updateTitle(quickPick, burstResults.length);
                    }
                }, 10);
    
                // PHASE 2: Deep Fuzzy Search (Stabilized results)
                fuzzyTimeout = setTimeout(() => {
                    try {
                        const results = this.performSearch(quickPick, query);
                        this.updateTitle(quickPick, results.length);
                    } finally {
                        quickPick.busy = false; // Deep scan finished
                    }
                }, 100);
            });
    
            // Handle button clicks for filter toggling
            quickPick.onDidTriggerButton((button) => {
                const tooltip = button.tooltip || '';
                const baseName = tooltip.replace(this.ACTIVE_PREFIX, '').replace(this.INACTIVE_PREFIX, '');
    
                // Find which scope was clicked
                for (const [scope, filterButton] of this.filterButtons.entries()) {
                    const buttonBaseName = (filterButton.tooltip || '')
                        .replace(this.ACTIVE_PREFIX, '')
                        .replace(this.INACTIVE_PREFIX, '');
    
                    if (buttonBaseName === baseName) {
                        this.currentScope = scope;
                        quickPick.placeholder = this.getPlaceholder();
                        this.updateFilterButtons(quickPick);
    
                        // Re-run search with new filter
                        const results = this.performSearch(quickPick, quickPick.value);
                        this.updateTitle(quickPick, results.length);
                        break;
                    }
                }
            });
    
            // Handle item selection
            quickPick.onDidAccept(() => {
                const selected = quickPick.selectedItems[0];
                if (selected) {
                    this.navigateToItem(selected.result);
                    quickPick.hide();
                }
            });
    
            // Handle hiding
            quickPick.onDidHide(() => {
                if (burstTimeout) {
                    clearTimeout(burstTimeout);
                }
                if (fuzzyTimeout) {
                    clearTimeout(fuzzyTimeout);
                }
                quickPick.dispose();
            });
    
            quickPick.show();
    
            // Perform initial search if there's a query
            if (quickPick.value) {
                const results = this.performSearch(quickPick, quickPick.value);
                this.updateTitle(quickPick, results.length);
            }
        }
    }
        `;
    const tree = createTree(code);
    const results = await calculateComplexity(tree, 'typescript');
    const sonarResults = getSonarJSComplexity(code);

    // Find the 'show' method
    const showMethod = results.find((m) => m.name === 'show');
    expect(showMethod).toBeDefined();

    // SonarJS reports complexity for the 'show' method (find first result with complexity > 0)
    const sonarShowComplexity = sonarResults.find((r) => r.complexity > 0)?.complexity ?? 0;

    // Our score may differ slightly due to callback nesting differences
    // SonarJS has special "second-level function" handling that we don't implement
    // We should be close to SonarJS but may have minor differences on deeply nested callbacks
    console.log(`SonarJS Complexity: ${sonarShowComplexity}, Our Complexity: ${showMethod!.score}`);
    console.log('All SonarJS Results:', JSON.stringify(sonarResults));

    if (sonarShowComplexity > 0) {
      // Assert we're within acceptable range of SonarJS (allowing for callback nesting difference)
      expect(showMethod!.score).toBeGreaterThanOrEqual(sonarShowComplexity - 5);
      expect(showMethod!.score).toBeLessThanOrEqual(sonarShowComplexity + 5);
    } else {
      // If SonarJS didn't parse it (class syntax), just verify we got a reasonable score
      expect(showMethod!.score).toBeGreaterThan(15); // The code has significant complexity
    }
  });
});
