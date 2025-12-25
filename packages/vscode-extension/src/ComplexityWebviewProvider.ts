import * as vscode from 'vscode';
import { MethodComplexity } from './types';

interface WebviewConfig {
    threshold: {
        warning: number;
        error: number;
    };
}

export class ComplexityWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _currentComplexities: MethodComplexity[] = [];
    private _currentConfig: WebviewConfig = { threshold: { warning: 15, error: 25 } };

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public get isVisible(): boolean {
        return this._view ? this._view.visible : false;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'jump':
                    {
                        const method = data.value as MethodComplexity;
                        this._jumpToMethod(method);
                        break;
                    }
                case 'ready':
                    {
                        // Webview is ready, send initial data
                        if (this._currentComplexities.length > 0) {
                            this.update(this._currentComplexities, this._currentConfig);
                        }
                        break;
                    }
            }
        });
    }

    public update(complexities: MethodComplexity[], config?: WebviewConfig) {
        this._currentComplexities = complexities;
        if (config) {
            this._currentConfig = config;
        }
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                body: complexities,
                config: this._currentConfig
            });
        }
    }

    public reveal(method: MethodComplexity) {
         if (this._view && this._view.visible) {
             this._view.webview.postMessage({ type: 'reveal', body: method });
         }
    }

    private _jumpToMethod(method: MethodComplexity) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const start = editor.document.positionAt(method.startIndex);
            const end = editor.document.positionAt(method.endIndex);
            const range = new vscode.Range(start, end);

            editor.selection = new vscode.Selection(start, start);
            editor.revealRange(range, 1); // TextEditorRevealType.InCenter = 1

            // Focus the editor
            vscode.window.showTextDocument(editor.document);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cognitive Complexity</title>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-sideBar-background);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }

                    .header-container {
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        background-color: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        display: flex;
                        flex-direction: column;
                        flex-shrink: 0;
                    }

                    .search-container {
                        padding: 8px 10px 4px 10px;
                        display: flex;
                        align-items: center;
                    }

                    .controls-container {
                        display: flex;
                        gap: 6px;
                        padding: 0 10px 8px 10px;
                        align-items: center;
                    }

                    .search-wrapper {
                        position: relative;
                        width: 100%;
                        display: flex;
                        align-items: center;
                    }

                    .search-icon {
                        position: absolute;
                        left: 8px;
                        color: var(--vscode-input-placeholderForeground);
                        pointer-events: none;
                        display: flex;
                        align-items: center;
                    }

                    .search-icon svg {
                        width: 14px;
                        height: 14px;
                        fill: currentColor;
                    }

                    input[type="text"] {
                        width: 100%;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 4px 8px 4px 28px;
                        outline: none;
                        font-family: inherit;
                        font-size: inherit;
                        box-sizing: border-box;
                        border-radius: 2px;
                    }

                    input[type="text"]:focus {
                        border-color: var(--vscode-focusBorder);
                    }

                    input[type="text"]::placeholder {
                        color: var(--vscode-input-placeholderForeground);
                    }

                    select {
                        background-color: var(--vscode-dropdown-background);
                        color: var(--vscode-dropdown-foreground);
                        border: 1px solid var(--vscode-dropdown-border);
                        padding: 2px 4px;
                        border-radius: 2px;
                        flex: 1;
                        outline: none;
                        font-family: inherit;
                        font-size: 0.9em;
                        height: 24px;
                    }

                    select:focus {
                        border-color: var(--vscode-focusBorder);
                    }

                    .sort-btn {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: none;
                        cursor: pointer;
                        padding: 0;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 2px;
                    }

                    .sort-btn:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }

                    .sort-btn svg {
                        width: 16px;
                        height: 16px;
                        fill: currentColor;
                    }

                    .method-list {
                        flex: 1;
                        overflow-y: auto;
                        padding: 0;
                        margin: 0;
                    }

                    .method-item {
                        display: flex;
                        align-items: center;
                        padding: 4px 10px;
                        cursor: pointer;
                        user-select: none;
                        border-left: 3px solid transparent;
                    }

                    .method-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .method-item.selected {
                        background-color: var(--vscode-list-activeSelectionBackground);
                        color: var(--vscode-list-activeSelectionForeground);
                        border-left-color: var(--vscode-list-activeSelectionForeground);
                    }

                    .method-icon {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        margin-right: 8px;
                        flex-shrink: 0;
                    }

                    .method-info {
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }

                    .method-name {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-weight: 500;
                    }

                    .method-details {
                        font-size: 0.85em;
                        opacity: 0.8;
                        margin-top: 1px;
                        display: flex;
                        gap: 8px;
                    }

                    .complexity-high { background-color: var(--vscode-errorForeground); }
                    .complexity-medium { background-color: var(--vscode-editorWarning-foreground); }
                    .complexity-low { background-color: var(--vscode-testing-iconPassed); }

                    ::-webkit-scrollbar {
                        width: 10px;
                        height: 10px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background-color: var(--vscode-scrollbarSlider-background);
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background-color: var(--vscode-scrollbarSlider-hoverBackground);
                    }
                    ::-webkit-scrollbar-thumb:active {
                        background-color: var(--vscode-scrollbarSlider-activeBackground);
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="search-container">
                        <div class="search-wrapper">
                            <div class="search-icon">
                               <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M15.7 14.3l-4.2-4.2c-.2-.2-.5-.3-.8-.3.8-1 1.3-2.4 1.3-3.8 0-3.3-2.7-6-6-6S0 2.7 0 6s2.7 6 6 6c1.4 0 2.8-.5 3.8-1.3 0 .3.1.6.3.8l4.2 4.2c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4zM6 10.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/></svg>
                            </div>
                            <input type="text" id="search-input" placeholder="Search methods..." spellcheck="false">
                        </div>
                    </div>
                    <div class="controls-container">
                        <select id="sort-select" title="Sort by">
                            <option value="line" selected>Line Number</option>
                            <option value="name">Name</option>
                            <option value="complexity">Complexity</option>
                        </select>
                        <button id="sort-direction-btn" class="sort-btn" title="Toggle Sort Direction">
                            <svg id="sort-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3.5 10.5L8 6l4.5 4.5H3.5z"/></svg>
                        </button>
                    </div>
                </div>
                <div id="method-list" class="method-list"></div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const listContainer = document.getElementById('method-list');
                    const searchInput = document.getElementById('search-input');
                    const sortSelect = document.getElementById('sort-select');
                    const sortDirectionBtn = document.getElementById('sort-direction-btn');
                    const sortIcon = document.getElementById('sort-icon');

                    let allMethods = [];
                    let config = { threshold: { warning: 15, error: 25 } };
                    let currentSort = 'line';
                    let isAscending = true;
                    let selectedMethodStartIndex = null;

                    function updateSortIcon() {
                        if (isAscending) {
                             // Up arrow
                             sortIcon.innerHTML = '<path d="M3.5 10.5L8 6l4.5 4.5H3.5z"/>';
                        } else {
                             // Down arrow
                             sortIcon.innerHTML = '<path d="M3.5 5.5L8 10l4.5-4.5H3.5z"/>';
                        }
                    }

                    function sortData() {
                         allMethods.sort((a, b) => {
                            let valA, valB;
                            switch (currentSort) {
                                case 'name':
                                    valA = a.name.toLowerCase();
                                    valB = b.name.toLowerCase();
                                    break;
                                case 'complexity':
                                    valA = a.score;
                                    valB = b.score;
                                    break;
                                case 'line':
                                default:
                                    valA = a.startLine;
                                    valB = b.startLine;
                                    break;
                            }

                            if (valA < valB) return isAscending ? -1 : 1;
                            if (valA > valB) return isAscending ? 1 : -1;
                            return 0;
                        });
                    }

                    function render(filter = '') {
                        listContainer.innerHTML = '';
                        const lowerFilter = filter.toLowerCase();

                        // Sort before rendering
                        sortData();

                        allMethods.forEach(method => {
                            if (method.isCallback) return;
                            if (filter && !method.name.toLowerCase().includes(lowerFilter)) {
                                return;
                            }

                            const el = document.createElement('div');
                            el.className = 'method-item';
                            if (method.startIndex === selectedMethodStartIndex) {
                                el.classList.add('selected');
                            }
                            el.id = 'method-' + method.startIndex;

                            el.onclick = () => {
                                selectedMethodStartIndex = method.startIndex;
                                render(searchInput.value); // Re-render to update selection visual
                                vscode.postMessage({ type: 'jump', value: method });
                            };

                            let colorClass = 'complexity-low';
                            if (method.score >= config.threshold.error) colorClass = 'complexity-high';
                            else if (method.score >= config.threshold.warning) colorClass = 'complexity-medium';

                            const icon = document.createElement('div');
                            icon.className = 'method-icon ' + colorClass;

                            const info = document.createElement('div');
                            info.className = 'method-info';

                            const name = document.createElement('div');
                            name.className = 'method-name';
                            name.textContent = method.name;

                            const details = document.createElement('div');
                            details.className = 'method-details';
                            details.textContent = \`Score: \${method.score} (Line: \${method.startLine + 1}) (\${method.endLine - method.startLine + 1} lines)\`;

                            info.appendChild(name);
                            info.appendChild(details);

                            el.appendChild(icon);
                            el.appendChild(info);

                            listContainer.appendChild(el);
                        });
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                allMethods = message.body;
                                if (message.config) {
                                    config = message.config;
                                }
                                render(searchInput.value);
                                break;
                            case 'reveal':
                                const methodToReveal = message.body;
                                selectedMethodStartIndex = methodToReveal.startIndex;
                                render(searchInput.value);
                                const el = document.getElementById('method-' + methodToReveal.startIndex);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                break;
                        }
                    });

                    searchInput.addEventListener('input', (e) => {
                        render(e.target.value);
                    });

                    sortSelect.addEventListener('change', (e) => {
                        currentSort = e.target.value;
                        render(searchInput.value);
                    });

                    sortDirectionBtn.addEventListener('click', () => {
                        isAscending = !isAscending;
                        updateSortIcon();
                        render(searchInput.value);
                    });

                    vscode.postMessage({ type: 'ready' });
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
