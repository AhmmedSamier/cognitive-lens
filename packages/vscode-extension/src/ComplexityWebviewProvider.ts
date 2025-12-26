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
                        overflow: hidden; /* Prevent body scroll, handle in list */
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }

                    .search-container {
                        padding: 8px 10px;
                        background-color: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        flex-shrink: 0;
                        display: flex;
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

                    /* SVG Icon styling */
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
                        padding: 4px 8px 4px 28px; /* Left padding for icon */
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
                    }

                    /* Flash effect for reveal */
                    @keyframes flash {
                        0% { background-color: var(--vscode-list-activeSelectionBackground); }
                        100% { background-color: transparent; }
                    }

                    .method-item.flash {
                        animation: flash 1s ease-out;
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

                    /* Scrollbar styling to match VSCode */
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
                <div class="search-container">
                    <div class="search-wrapper">
                        <div class="search-icon">
                           <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M15.7 14.3l-4.2-4.2c-.2-.2-.5-.3-.8-.3.8-1 1.3-2.4 1.3-3.8 0-3.3-2.7-6-6-6S0 2.7 0 6s2.7 6 6 6c1.4 0 2.8-.5 3.8-1.3 0 .3.1.6.3.8l4.2 4.2c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4zM6 10.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/></svg>
                        </div>
                        <input type="text" id="search-input" placeholder="Search methods..." spellcheck="false">
                    </div>
                </div>
                <div id="method-list" class="method-list">
                    <!-- Items will be injected here -->
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const listContainer = document.getElementById('method-list');
                    const searchInput = document.getElementById('search-input');

                    let allMethods = [];
                    let config = { threshold: { warning: 15, error: 25 } };

                    // Render the list based on current methods and filter
                    function render(filter = '') {
                        listContainer.innerHTML = '';
                        const lowerFilter = filter.toLowerCase();

                        allMethods.forEach(method => {
                            if (method.isCallback) return; // Skip callbacks as per requirement
                            if (filter && !method.name.toLowerCase().includes(lowerFilter)) {
                                return;
                            }

                            const el = document.createElement('div');
                            el.className = 'method-item';
                            el.id = 'method-' + method.startIndex; // ID for scrolling
                            el.onclick = () => {
                                vscode.postMessage({ type: 'jump', value: method });
                            };

                            // Determine color class based on config
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

                            let deltaHtml = '';
                            if (method.complexityDelta !== undefined && method.complexityDelta !== 0) {
                                const sign = method.complexityDelta > 0 ? '+' : '';
                                const deltaColor = method.complexityDelta > 0 ? 'var(--vscode-errorForeground)' : 'var(--vscode-testing-iconPassed)';
                                deltaHtml = \` <span style="color: \${deltaColor}; font-weight: bold;">(\${sign}\${method.complexityDelta})</span>\`;
                            }

                            details.innerHTML = \`Score: \${method.score} \${deltaHtml} (Line: \${method.startLine + 1}) (\${method.endLine - method.startLine + 1} lines)\`;

                            info.appendChild(name);
                            info.appendChild(details);

                            el.appendChild(icon);
                            el.appendChild(info);

                            listContainer.appendChild(el);
                        });
                    }

                    // Handle incoming messages
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
                                const el = document.getElementById('method-' + methodToReveal.startIndex);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('flash');
                                    setTimeout(() => el.classList.remove('flash'), 1000);
                                }
                                break;
                        }
                    });

                    // Search filtering
                    searchInput.addEventListener('input', (e) => {
                        render(e.target.value);
                    });

                    // Signal readiness
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
