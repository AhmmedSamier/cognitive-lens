import { MethodComplexity } from './types';

export interface FileAnalysisResult {
    path: string;
    content: string;
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
    </style>
</head>
<body>
    <header>
        <h1>Cognitive Complexity Report</h1>
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
                <input type="text" class="search-box" placeholder="Filter methods or files..." oninput="filterTree(this.value)">
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

    <script>
        const treeData = ${treeJson};
        const projectData = ${filesJson};
        
        const treeContainerEl = document.getElementById('treeContainer');
        const codeContainerEl = document.getElementById('codeContainer');
        const currentFilePathEl = document.getElementById('currentFilePath');
        const methodInfoEl = document.getElementById('methodInfo');

        let activeMethodId = null;

        function getScoreClass(score) {
            if (score >= 25) return 'score-badge-high';
            if (score >= 15) return 'score-badge-med';
            return 'score-badge-low';
        }

        function createTreeItem(node, level = 0) {
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
                
                if (node.children) {
                    node.children
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                            return b.score - a.score;
                        })
                        .forEach(child => {
                            childrenContainer.appendChild(createTreeItem(child, level + 1));
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
                            childrenContainer.appendChild(createTreeItem(methodNode, level + 1));
                        });
                }

                wrapper.appendChild(childrenContainer);

                item.onclick = (e) => {
                    e.stopPropagation();
                    const isExpanded = childrenContainer.classList.toggle('expanded');
                    expander.classList.toggle('expanded', isExpanded);
                };
            }
            
            if (node.type === 'method') {
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectMethodInternal(node.methodData, node.filePath, item);
                };
            } else if (node.type === 'file' || node.type === 'folder') {
                item.onclick = (e) => {
                    e.stopPropagation();
                    if (hasChildren) {
                        const childrenContainer = wrapper.querySelector('.tree-children');
                        const isExpanded = childrenContainer.classList.toggle('expanded');
                        expander.classList.toggle('expanded', isExpanded);
                    }
                };
            }

            return wrapper;
        }

        function selectMethodInternal(method, filePath, element) {
            document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
            element.classList.add('active');

            currentFilePathEl.textContent = filePath;
            methodInfoEl.innerHTML = '<span class="tree-score ' + getScoreClass(method.score) + '">' + method.score + ' Complexity</span>';

            // Find file content
            const file = projectData.find(f => f.path === filePath);
            if (file) {
                renderCode(method, file.content);
                
                const targetLine = document.getElementById('line-' + (method.startLine + 1));
                if (targetLine) {
                    targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    highlightRange(method.startLine + 1, method.endLine + 1);
                }
            }
        }

        function renderTree(filter = '') {
            treeContainerEl.innerHTML = '';
            const filteredTree = filterNode(treeData, filter.toLowerCase());
            if (filteredTree) {
                // If it's the root node, just show its children to avoid a redundant "root" folder
                if (filteredTree.id === 'root') {
                    filteredTree.children.forEach(child => {
                        treeContainerEl.appendChild(createTreeItem(child, 0));
                    });
                } else {
                    treeContainerEl.appendChild(createTreeItem(filteredTree, 0));
                }
                
                if (filter) expandAll(treeContainerEl);
            }
        }

        function filterNode(node, query) {
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

        // Initialize
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

