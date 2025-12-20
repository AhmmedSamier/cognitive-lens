import * as vscode from 'vscode';
import { MethodComplexity } from './types';

export class ComplexityTreeDataProvider implements vscode.TreeDataProvider<MethodComplexity> {
    private _onDidChangeTreeData: vscode.EventEmitter<MethodComplexity | undefined | null | void> = new vscode.EventEmitter<MethodComplexity | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MethodComplexity | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private complexityCache: Map<string, MethodComplexity[]>) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MethodComplexity): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.name);

        const config = vscode.workspace.getConfiguration('cognitiveComplexity');
        const warningThreshold = config.get<number>('threshold.warning', 15);
        const errorThreshold = config.get<number>('threshold.error', 25);

        treeItem.description = `${element.score}`;

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

        // Return all methods including 0 score ones? Usually yes for navigation.
        // But maybe filter out callbacks if they are clutter?
        // The user said "list of methods".
        // extension.ts filters callbacks for decorations.
        // Let's include everything but maybe filter callbacks if they are nameless or small?
        // The interface has `isCallback`.
        // extension.ts: `if (method.isCallback) continue;` for gutter icons.
        // For the list, it might be useful to see them, but if they are anonymous, the name might be empty or "<anonymous>".
        // Let's filter out isCallback for now to match the "Method" semantic.

        return complexities
            .filter(c => !c.isCallback)
            .sort((a, b) => a.startIndex - b.startIndex);
    }
}
