import * as vscode from 'vscode';
import { MethodComplexity } from './types';

export class ComplexityTreeDataProvider implements vscode.TreeDataProvider<MethodComplexity> {
    private _onDidChangeTreeData: vscode.EventEmitter<MethodComplexity | undefined | null | void> = new vscode.EventEmitter<MethodComplexity | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MethodComplexity | undefined | null | void> = this._onDidChangeTreeData.event;
    private filterQuery: string = '';

    constructor(private complexityCache: Map<string, MethodComplexity[]>) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setFilter(query: string) {
        this.filterQuery = query.toLowerCase();
        this.refresh();
    }

    getParent(element: MethodComplexity): vscode.ProviderResult<MethodComplexity> {
        // Since we have a flat list of methods, they don't have parents in the tree view context.
        // However, if we wanted to support hierarchy (e.g. classes), we would implement this.
        return null;
    }

    getTreeItem(element: MethodComplexity): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.name);

        const config = vscode.workspace.getConfiguration('cognitiveComplexity');
        const warningThreshold = config.get<number>('threshold.warning', 15);
        const errorThreshold = config.get<number>('threshold.error', 25);

        // Add 1 to make it 1-based for display
        treeItem.description = `Score: ${element.score} (Line: ${element.startLine + 1})`;

        if (element.score >= errorThreshold) {
            treeItem.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            treeItem.tooltip = `High Complexity: ${element.score}`;
        } else if (element.score >= warningThreshold) {
            treeItem.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
            treeItem.tooltip = `Moderate Complexity: ${element.score}`;
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
             treeItem.tooltip = `Low Complexity: ${element.score}`;
        }

        treeItem.command = {
            command: 'cognitive-complexity.navigateToMethod',
            title: 'Go to Method',
            arguments: [element]
        };

        return treeItem;
    }

    getChildren(element?: MethodComplexity): vscode.ProviderResult<MethodComplexity[]> {
        if (element) {
            return [];
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }

        const uri = editor.document.uri.toString();
        const complexities = this.complexityCache.get(uri);

        if (!complexities) {
            return [];
        }

        return complexities
            .filter(c => !c.isCallback)
            .filter(c => {
                if (!this.filterQuery) return true;
                return c.name.toLowerCase().includes(this.filterQuery);
            })
            .sort((a, b) => a.startIndex - b.startIndex);
    }
}
