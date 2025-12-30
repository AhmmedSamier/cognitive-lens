import { MethodComplexity } from './types';

export interface FileAnalysisResult {
    path: string;
    content: string; // The full content of the file
    methods: MethodComplexity[];
    totalScore: number;
}

export interface ProjectAnalysisResult {
    files: FileAnalysisResult[];
    totalScore: number;
}

interface TreeNode {
    id: string;
    name: string;
    fullPath: string;
    type: 'file' | 'folder' | 'method';
    score: number;
    children: Map<string, TreeNode>;
    methods?: MethodComplexity[];
}

export function generateHtmlReport(result: ProjectAnalysisResult): string {
    const date = new Date().toLocaleString();
    const filesJson = JSON.stringify(result.files).replace(/</g, '\\u003c');
    const tree = buildFileTree(result.files);

    function serializeTree(node: TreeNode): any {
        if (node.type === 'method') {
            return {
                id: node.id,
                name: node.name,
                type: node.type,
                score: node.score,
                fullPath: node.fullPath,
                methodData: node.methods?.[0]
            };
        } else {
            return {
                id: node.id,
                name: node.name,
                type: node.type,
                score: node.score,
                fullPath: node.fullPath,
                children: Array.from(node.children.values()).map(child => serializeTree(child)),
                methods: node.methods
            };
        }
    }

    const treeJson = JSON.stringify(serializeTree(tree)).replace(/</g, '\\u003c');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cognitive Complexity Report</title>
    <style>
        :root {
            --bg-color: #f8fafc;
            --sidebar-bg: #ffffff;
            --border-color: #e2e8f0;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --primary: #2563eb;
            --error: #ef4444;
            --warning: #f59e0b;
            --success: #10b981;
            --code-bg: #ffffff;
            --line-num: #94a3b8;
            --highlight: #f1f5f9;
            --tree-hover: #f1f5f9;
            --tree-selected: #eff6ff;
            --modal-overlay: rgba(0, 0, 0, 0.5);
            --modal-bg: #ffffff;
        }

        * { box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
            color: var(--text-main);
            background: var(--bg-color);
        }

        header {
            height: 60px;
            background: #1e293b;
            color: white;
            display: flex;
            align-items: center;
            padding: 0 20px;
            justify-content: space-between;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            z-index: 100;
        }

        header h1 { font-size: 1.2rem; margin: 0; font-weight: 600; }
        .stats { display: flex; gap: 24px; font-size: 0.9rem; }
        .stat-item { display: flex; flex-direction: column; }
        .stat-val { font-weight: bold; color: #38bdf8; }
        .stat-label { font-size: 0.75rem; color: #94a3b8; }

        .shortcut-hint {
            font-size: 0.75rem;
            color: #94a3b8;
            background: rgba(255,255,255,0.1);
            padding: 4px 8px;
            border-radius: 4px;
            margin-left: 12px;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Sidebar Tree View */
        .sidebar {
            width: 350px;
            min-width: 300px;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .sidebar-header {
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            background: #f8fafc;
        }

        .search-box {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 0.85rem;
            outline: none;
        }
        .search-box:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1); }

        .tree-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }

        .tree-item {
            display: flex;
            align-items: center;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 0.85rem;
            white-space: nowrap;
            user-select: none;
            transition: background 0.1s;
        }

        .tree-item:hover { background: var(--tree-hover); }
        .tree-item.active { background: var(--tree-selected); color: var(--primary); font-weight: 500; }

        .tree-expander {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 4px;
            color: var(--text-muted);
            font-size: 0.7rem;
            transition: transform 0.1s;
        }
        .tree-expander.expanded { transform: rotate(90deg); }
        .tree-expander.hidden { visibility: hidden; }

        .tree-icon { margin-right: 6px; font-size: 1rem; }
        .tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .tree-score { 
            margin-left: 8px; 
            font-size: 0.75rem; 
            font-weight: 600; 
            padding: 1px 6px; 
            border-radius: 10px;
        }

        .score-badge-high { background: #fee2e2; color: #b91c1c; }
        .score-badge-med { background: #ffedd5; color: #9a3412; }
        .score-badge-low { background: #dcfce7; color: #15803d; }

        .tree-children { display: none; }
        .tree-children.expanded { display: block; }

        /* Code View */
        .content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--code-bg);
        }

        .content-header {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border-color);
            background: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .file-path { font-family: monospace; font-size: 0.85rem; color: var(--text-muted); }

        .code-container {
            flex: 1;
            overflow: auto;
            position: relative;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.875rem;
            line-height: 1.5;
        }

        .code-table { border-collapse: collapse; min-width: 100%; }
        .code-line { display: table-row; }
        .code-line:hover { background: var(--highlight); }
        .code-line.active { background: #fff7ed; }

        .line-number {
            display: table-cell;
            width: 50px;
            padding: 0 12px;
            text-align: right;
            user-select: none;
            color: var(--line-num);
            background: #f8fafc;
            border-right: 1px solid var(--border-color);
        }

        .line-content {
            display: table-cell;
            padding: 0 20px;
            white-space: pre;
        }

        /* Annotations */
        .annotation {
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 2px 8px;
            border-radius: 4px;
            margin-left: 10px;
            font-size: 0.75rem;
            font-family: sans-serif;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .annotation-nesting { color: #64748b; font-style: italic; margin-left: 4px; }

        /* Syntax Highlighting */
        .token-keyword { color: #d73a49; font-weight: bold; }
        .token-string { color: #032f62; }
        .token-comment { color: #6a737d; }
        .token-function { color: #6f42c1; }
        .token-number { color: #005cc5; }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
        }

        /* Modal / Command Palette */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--modal-overlay);
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 10vh;
            z-index: 1000;
            visibility: hidden;
            opacity: 0;
            transition: all 0.1s ease-in-out;
        }

        .modal-overlay.open {
            visibility: visible;
            opacity: 1;
        }

        .modal {
            background: var(--modal-bg);
            width: 600px;
            max-width: 90%;
            max-height: 80vh;
            border-radius: 8px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }

        .modal-input {
            width: 100%;
            padding: 16px;
            border: none;
            border-bottom: 1px solid var(--border-color);
            font-size: 1rem;
            outline: none;
            background: transparent;
        }

        .modal-results {
            flex: 1;
            overflow-y: auto;
            max-height: 500px;
        }

        .result-item {
            padding: 10px 16px;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-bottom: 1px solid #f1f5f9;
        }

        .result-item:last-child { border-bottom: none; }
        .result-item.selected { background: var(--tree-selected); }

        .result-icon { margin-right: 12px; font-size: 1.2rem; }

        .result-info { flex: 1; overflow: hidden; }
        .result-name { font-weight: 500; font-size: 0.9rem; color: var(--text-main); }
        .result-path { font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .result-score {
            font-weight: 600;
            font-size: 0.85rem;
            padding: 2px 8px;
            border-radius: 99px;
            margin-left: 12px;
        }
    </style>
</head>
<body>
    <header>
        <div style="display: flex; align-items: center;">
            <h1>Cognitive Complexity Report</h1>
            <span class="shortcut-hint">Press Ctrl+K to search</span>
        </div>
        <div class="stats">
            <div class="stat-item">
                <span class="stat-label">Total Complexity</span>
                <span class="stat-val">${result.totalScore}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Files</span>
                <span class="stat-val">${result.files.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Generated</span>
                <span class="stat-val">${date}</span>
            </div>
        </div>
    </header>

    <div class="main-container">
        <div class="sidebar">
            <div class="sidebar-header">
                <input type="text" class="search-box" placeholder="Filter tree..." oninput="filterTree(this.value)">
            </div>
            <div class="tree-container" id="treeContainer">
                <!-- Tree populated by JS -->
            </div>
        </div>

        <div class="content">
            <div class="content-header">
                <div class="file-path" id="currentFilePath">Select a method to view code</div>
                <div id="methodInfo"></div>
            </div>
            <div class="code-container" id="codeContainer">
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <p>Select a method from the sidebar to inspect the code</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="searchModal" onclick="closeSearch(event)">
        <div class="modal" onclick="event.stopPropagation()">
            <input type="text" class="modal-input" id="searchInput" placeholder="Search files and methods..." autocomplete="off">
            <div class="modal-results" id="searchResults"></div>
        </div>
    </div>

    <script>
        const treeData = ${treeJson};
        const projectData = ${filesJson};
        
        const treeContainerEl = document.getElementById('treeContainer');
        const codeContainerEl = document.getElementById('codeContainer');
        const currentFilePathEl = document.getElementById('currentFilePath');
        const methodInfoEl = document.getElementById('methodInfo');
        const searchModal = document.getElementById('searchModal');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        let searchIndex = [];
        let activeMethodId = null;
        let selectedResultIndex = -1;
        let currentResults = [];

        function getScoreClass(score) {
            if (score >= 25) return 'score-badge-high';
            if (score >= 15) return 'score-badge-med';
            return 'score-badge-low';
        }

        function createTreeItem(node, level = 0, lazy = true) {
            const wrapper = document.createElement('div');
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.style.paddingLeft = (level * 16 + 8) + 'px';
            
            const hasChildren = (node.children && node.children.length > 0) || (node.methods && node.methods.length > 0);
            
            const expander = document.createElement('span');
            expander.className = 'tree-expander' + (hasChildren ? '' : ' hidden');
            expander.innerHTML = '▶';
            item.appendChild(expander);

            const icon = document.createElement('span');
            icon.className = 'tree-icon';
            if (node.type === 'folder') icon.innerText = '📁';
            else if (node.type === 'file') icon.innerText = '📄';
            else icon.innerText = 'ƒ';
            item.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'tree-label';
            label.innerText = node.name;
            item.appendChild(label);

            if (node.score > 0) {
                const score = document.createElement('span');
                score.className = 'tree-score ' + getScoreClass(node.score);
                score.innerText = node.score;
                item.appendChild(score);
            }

            wrapper.appendChild(item);

            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                
                // Lazy loading logic
                let childrenRendered = !lazy;

                const renderChildren = () => {
                     if (childrenRendered) return;
                     childrenRendered = true;

                     if (node.children) {
                        node.children
                            .sort((a, b) => {
                                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                                return b.score - a.score;
                            })
                            .forEach(child => {
                                childrenContainer.appendChild(createTreeItem(child, level + 1, true));
                            });
                    }

                    if (node.methods) {
                        node.methods
                            .sort((a, b) => b.score - a.score)
                            .forEach(method => {
                                const methodNode = {
                                    name: method.name,
                                    type: 'method',
                                    score: method.score,
                                    methodData: method,
                                    filePath: node.fullPath
                                };
                                childrenContainer.appendChild(createTreeItem(methodNode, level + 1, true));
                            });
                    }
                }
                
                if (!lazy) {
                    renderChildren();
                }

                wrapper.appendChild(childrenContainer);

                const toggleExpand = () => {
                    renderChildren();
                    const isExpanded = childrenContainer.classList.toggle('expanded');
                    expander.classList.toggle('expanded', isExpanded);
                };

                // Allow clicking the item to expand for folders/files
                if (node.type !== 'method') {
                     item.onclick = (e) => {
                        e.stopPropagation();
                        toggleExpand();
                    };
                } else {
                     // Methods expand differently or not at all? Methods are leaves in this tree structure usually.
                     // But if a method had children (e.g. local functions - not supported yet), it would be here.
                }
            }
            
            if (node.type === 'method') {
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectMethodInternal(node.methodData, node.filePath, item);
                };
            }

            return wrapper;
        }

        function selectMethodInternal(method, filePath, element) {
            document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');

            currentFilePathEl.textContent = filePath;
            methodInfoEl.innerHTML = '<span class="tree-score ' + getScoreClass(method.score) + '">' + method.score + ' Complexity</span>';

            // Find file content
            const file = projectData.find(f => f.path === filePath);
            if (file) {
                renderCode(method, file.content);
                
                // Wait for render
                setTimeout(() => {
                    const targetLine = document.getElementById('line-' + (method.startLine + 1));
                    if (targetLine) {
                        targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        highlightRange(method.startLine + 1, method.endLine + 1);
                    }
                }, 10);
            }
        }

        function renderTree(filter = '') {
            treeContainerEl.innerHTML = '';

            if (filter) {
                // When filtering, we don't use lazy loading because we need to show matches deep in the tree
                const filteredTree = filterNode(treeData, filter.toLowerCase());
                if (filteredTree) {
                    if (filteredTree.id === 'root') {
                         filteredTree.children.forEach(child => {
                            treeContainerEl.appendChild(createTreeItem(child, 0, false));
                        });
                    } else {
                        treeContainerEl.appendChild(createTreeItem(filteredTree, 0, false));
                    }
                    expandAll(treeContainerEl);
                }
            } else {
                // Initial view - use lazy loading
                if (treeData.children) {
                    treeData.children.forEach(child => {
                        treeContainerEl.appendChild(createTreeItem(child, 0, true));
                    });
                }
            }
        }

        function filterNode(node, query) {
            // ... (same as before)
            if (!query) return node;

            const matches = node.name.toLowerCase().includes(query);
            
            let filteredChildren = [];
            if (node.children) {
                filteredChildren = node.children
                    .map(c => filterNode(c, query))
                    .filter(c => c !== null);
            }

            let filteredMethods = [];
            if (node.methods) {
                filteredMethods = node.methods.filter(m => m.name.toLowerCase().includes(query));
            }

            if (matches || filteredChildren.length > 0 || filteredMethods.length > 0) {
                return {
                    ...node,
                    children: filteredChildren,
                    methods: filteredMethods
                };
            }
            return null;
        }

        function expandAll(container) {
            container.querySelectorAll('.tree-children').forEach(el => el.classList.add('expanded'));
            container.querySelectorAll('.tree-expander').forEach(el => el.classList.add('expanded'));
        }

        function highlightRange(start, end) {
            document.querySelectorAll('.code-line').forEach(el => el.classList.remove('active'));
            for (let i = start; i <= end; i++) {
                const el = document.getElementById('line-' + i);
                if (el) el.classList.add('active');
            }
        }

        function renderCode(method, fileContent) {
            // ... (same as before)
             const lines = fileContent.split(/\\r?\\n/);
            const table = document.createElement('table');
            table.className = 'code-table';
            
            const detailsMap = new Map();
            method.details.forEach(d => {
                const lineNum = d.line + 1;
                if (!detailsMap.has(lineNum)) detailsMap.set(lineNum, []);
                detailsMap.get(lineNum).push(d);
            });

            lines.forEach((lineText, idx) => {
                const lineNum = idx + 1;
                const tr = document.createElement('tr');
                tr.className = 'code-line';
                tr.id = 'line-' + lineNum;

                const tdNum = document.createElement('td');
                tdNum.className = 'line-number';
                tdNum.textContent = lineNum;

                const tdContent = document.createElement('td');
                tdContent.className = 'line-content';
                tdContent.innerHTML = highlight(lineText);

                const details = detailsMap.get(lineNum);
                if (details) {
                    details.forEach(d => {
                        const ann = document.createElement('span');
                        ann.className = 'annotation';
                        
                        let msg = d.message;
                        let nesting = '';
                        if (msg.includes('nesting')) {
                            const match = msg.match(/\\(incl (\\d+) for nesting\\)/);
                            if (match) {
                                nesting = '<span class="annotation-nesting">(incl ' + match[1] + ' for nesting)</span>';
                                msg = msg.replace(/\\s*\\(incl \\d+ for nesting\\)/, '');
                            }
                        }
                        
                        ann.innerHTML = '<strong>+' + d.score + '</strong> ' + escapeHtml(msg) + nesting;
                        tdContent.appendChild(ann);
                    });
                }

                tr.appendChild(tdNum);
                tr.appendChild(tdContent);
                table.appendChild(tr);
            });

            codeContainerEl.innerHTML = '';
            codeContainerEl.appendChild(table);
        }

        function highlight(code) {
             // ... (same as before)
            const keywords = /\\b(abstract|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|package|private|protected|public|return|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|bool|string|int|float|double|decimal|var|namespace|using|foreach|lock|fixed|unsafe|ref|out|params|is|as|base|checked|unchecked|delegate|event|explicit|implicit|operator|readonly|sizeof|stackalloc|volatile|async|await|record|init|with|params)\\b/g;
            const strings = /("[^"]*"|'[^']*'|\\\`[^*]*\\\`)/g;
            const comments = /(\\/\\/.*|\\/\\*[^*]*\\*\\/)/g;
            const numbers = /\\b(\\d+)\\b/g;
            const functions = /\\b([a-zA-Z_]\\w*)(?=\\s*\\()/g;

            let html = escapeHtml(code);
            const combined = new RegExp(
                '(' + comments.source + ')|(' + strings.source + ')|(' + keywords.source + ')|(' + functions.source + ')|(' + numbers.source + ')',
                'g'
            );

            return html.replace(combined, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) => {
                if (p1 !== undefined) return '<span class="token-comment">' + match + '</span>';
                if (p3 !== undefined) return '<span class="token-string">' + match + '</span>';
                if (p5 !== undefined) return '<span class="token-keyword">' + match + '</span>';
                if (p7 !== undefined) return '<span class="token-function">' + match + '</span>';
                if (p9 !== undefined) return '<span class="token-number">' + match + '</span>';
                return match;
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function filterTree(val) {
            renderTree(val);
        }

        // ==========================================
        // SEARCH FUNCTIONALITY
        // ==========================================

        function buildSearchIndex() {
            const index = [];
            projectData.forEach(file => {
                // Add file to index
                index.push({
                    name: file.path.split('/').pop(),
                    path: file.path,
                    type: 'file',
                    score: file.totalScore,
                    data: null
                });

                // Add methods to index
                file.methods.forEach(method => {
                    index.push({
                        name: method.name,
                        path: file.path,
                        type: 'method',
                        score: method.score,
                        data: method
                    });
                });
            });
            return index;
        }

        function openSearch() {
            searchModal.classList.add('open');
            searchInput.value = '';
            searchInput.focus();
            renderSearchResults([]);
        }

        function closeSearch(e) {
            if (e) e.stopPropagation();
            searchModal.classList.remove('open');
        }

        function handleSearchInput(e) {
            const query = e.target.value.toLowerCase();
            if (!query) {
                renderSearchResults([]);
                return;
            }

            // Simple fuzzy-ish search: check if all characters exist in order?
            // Or just 'includes' for now. Let's do 'includes' + score sorting.
            // A better fuzzy search would be good but expensive to implement from scratch.
            // Let's stick to "smart includes": matches word boundaries or simple substring.

            const results = searchIndex.filter(item => {
                return item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query);
            });

            // Score results
            results.sort((a, b) => {
                // Exact match on name
                const aExact = a.name.toLowerCase() === query;
                const bExact = b.name.toLowerCase() === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // Starts with
                const aStart = a.name.toLowerCase().startsWith(query);
                const bStart = b.name.toLowerCase().startsWith(query);
                if (aStart && !bStart) return -1;
                if (!aStart && bStart) return 1;

                // Complexity score (descending)
                return b.score - a.score;
            });

            currentResults = results.slice(0, 50); // Limit results
            selectedResultIndex = 0;
            renderSearchResults(currentResults);
        }

        function renderSearchResults(results) {
            searchResults.innerHTML = '';
            if (results.length === 0) {
                if (searchInput.value) {
                    const empty = document.createElement('div');
                    empty.className = 'result-item';
                    empty.style.color = '#94a3b8';
                    empty.innerText = 'No results found';
                    searchResults.appendChild(empty);
                }
                return;
            }

            results.forEach((res, idx) => {
                const el = document.createElement('div');
                el.className = 'result-item' + (idx === 0 ? ' selected' : '');
                el.onclick = () => selectResult(res);
                el.onmouseenter = () => {
                    selectedResultIndex = idx;
                    updateSelection();
                };

                const icon = document.createElement('span');
                icon.className = 'result-icon';
                icon.innerText = res.type === 'file' ? '📄' : 'ƒ';

                const info = document.createElement('div');
                info.className = 'result-info';

                const name = document.createElement('div');
                name.className = 'result-name';
                name.innerText = res.name;

                const path = document.createElement('div');
                path.className = 'result-path';
                path.innerText = res.path;

                info.appendChild(name);
                info.appendChild(path);

                const score = document.createElement('span');
                score.className = 'result-score ' + getScoreClass(res.score);
                score.innerText = res.score;

                el.appendChild(icon);
                el.appendChild(info);
                el.appendChild(score);
                searchResults.appendChild(el);
            });
        }

        function updateSelection() {
            const items = searchResults.querySelectorAll('.result-item');
            items.forEach((el, idx) => {
                if (idx === selectedResultIndex) el.classList.add('selected');
                else el.classList.remove('selected');
            });

            // Scroll into view
            if (selectedResultIndex >= 0 && items[selectedResultIndex]) {
                items[selectedResultIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        function selectResult(res) {
            closeSearch();
            if (res.type === 'method') {
                selectMethodInternal(res.data, res.path, null);
            } else {
                // For files, select the first method or just show the file
                 const file = projectData.find(f => f.path === res.path);
                 if (file && file.methods.length > 0) {
                     // Select first method
                     selectMethodInternal(file.methods[0], res.path, null);
                 } else if (file) {
                     // Show file without method selection?
                     // Currently selectMethodInternal handles highlighting.
                     // We can just show the first line.
                     // But we need a dummy method object?
                     // Or just render code.
                     currentFilePathEl.textContent = res.path;
                     methodInfoEl.innerHTML = '<span class="tree-score ' + getScoreClass(res.score) + '">' + res.score + ' Complexity</span>';
                     renderCode({ details: [] }, file.content); // Empty details for file view
                 }
            }
        }

        // Event Listeners
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (searchModal.classList.contains('open')) {
                    closeSearch();
                } else {
                    openSearch();
                }
            }

            if (searchModal.classList.contains('open')) {
                if (e.key === 'Escape') {
                    closeSearch();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedResultIndex = Math.min(selectedResultIndex + 1, currentResults.length - 1);
                    updateSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
                    updateSelection();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedResultIndex >= 0 && currentResults[selectedResultIndex]) {
                        selectResult(currentResults[selectedResultIndex]);
                    }
                }
            }
        });

        searchInput.addEventListener('input', handleSearchInput);

        // Initialize
        searchIndex = buildSearchIndex();
        renderTree();
    </script>
</body>
</html>
        `;
}

function buildFileTree(files: FileAnalysisResult[]): TreeNode {
    const root: TreeNode = {
        id: 'root',
        name: 'root',
        fullPath: '',
        type: 'folder',
        score: 0,
        children: new Map()
    };

    let idCounter = 0;

    for (const file of files) {
        const parts = file.path.split('/');
        let currentNode = root;

        // Traverse/Build directories
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, {
                    id: `dir-${idCounter++}`,
                    name: part,
                    fullPath: parts.slice(0, i + 1).join('/'),
                    type: 'folder',
                    score: 0,
                    children: new Map()
                });
            }
            currentNode = currentNode.children.get(part)!;
        }

        // Add file
        const fileName = parts[parts.length - 1];
        currentNode.children.set(fileName, {
            id: `file-${idCounter++}`,
            name: fileName,
            fullPath: file.path,
            type: 'file',
            score: file.totalScore,
            children: new Map(),
            methods: file.methods.filter((m: MethodComplexity) => !m.isCallback)
        });
    }

    // Calculate scores for folders (post-order traversal)
    function calculateFolderScores(node: TreeNode): number {
        if (node.type === 'file') {
            return node.score;
        }
        let total = 0;
        for (const child of node.children.values()) {
            total += calculateFolderScores(child);
        }
        node.score = total;
        return total;
    }

    calculateFolderScores(root);
    return root;
}
