
import { expect, test, describe, beforeAll } from "bun:test";
import { calculateComplexity } from "../src/complexity";
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';

let parser: Parser;

beforeAll(async () => {
    await Parser.init();
    parser = new Parser();
    const langPath = path.resolve(__dirname, '../../vscode-extension/public/tree-sitter-typescript.wasm');
    const lang = await Language.load(langPath);
    parser.setLanguage(lang);
});

function createTree(code: string) {
    return parser.parse(code);
}

describe("Cognitive Complexity Reproduction", () => {
    test("Nested Callbacks Score (show method)", async () => {
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

        // Find the 'show' method
        const showMethod = results.find(m => m.name === 'show');
        expect(showMethod).toBeDefined();

        // Assert expected score based on fix
        expect(showMethod!.score).toBe(25);
    });
});
