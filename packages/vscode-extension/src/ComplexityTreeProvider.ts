import * as vscode from 'vscode';
import { MethodComplexity } from '@cognitive-complexity/core';

export class ComplexityTreeProvider implements vscode.TreeDataProvider<ComplexityItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ComplexityItem | undefined | null | void> = new vscode.EventEmitter<ComplexityItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ComplexityItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private complexities: MethodComplexity[] = [];

    constructor() {}

    refresh(complexities: MethodComplexity[]): void {
        this.complexities = complexities.sort((a, b) => b.score - a.score);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ComplexityItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ComplexityItem): Thenable<ComplexityItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        return Promise.resolve(
            this.complexities.map(
                c =>
                    new ComplexityItem(
                        c.name,
                        c.score,
                        c.startLine,
                        vscode.TreeItemCollapsibleState.None
                    )
            )
        );
    }
}

export class ComplexityItem extends vscode.TreeItem {
    constructor(
        public readonly methodName: string,
        public readonly score: number,
        public readonly line: number,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(methodName, collapsibleState);
        this.tooltip = `${this.methodName}: ${this.score}`;
        this.description = `Score: ${this.score}`;

        if (this.score > 25) {
            this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        } else if (this.score > 15) {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        } else {
            this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }

        this.command = {
            command: 'editor.action.goToLocations',
            title: 'Go to method',
            arguments: [
                vscode.window.activeTextEditor?.document.uri,
                new vscode.Position(this.line, 0),
                [],
                'goto',
                ''
            ]
        };
    }
}
