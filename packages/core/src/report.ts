import { MethodComplexity } from './types';

export interface FileAnalysisResult {
    path: string;
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
    type: 'file' | 'folder';
    score: number;
    children: Map<string, TreeNode>;
    methods?: MethodComplexity[];
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
            methods: file.methods.filter(m => !m.isCallback)
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

function renderTreeRows(node: TreeNode, level: number): string {
    // Sort children: folders first, then files. Within those, sort by score desc.
    const children = Array.from(node.children.values()).sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return b.score - a.score;
    });

    let html = '';

    for (const child of children) {
        const padding = level * 20;
        const isFolder = child.type === 'folder';
        const icon = isFolder ? '📁' : '📄';
        const toggleIcon = isFolder || (child.methods && child.methods.length > 0) ? `<span class="toggle-icon" id="icon-${child.id}">▶</span>` : '<span style="display:inline-block;width:20px"></span>';
        const rowClass = isFolder ? 'folder-row' : 'file-row';
        const methodCount = child.type === 'file' ? `${child.methods?.length} methods` : `${child.children.size} items`;

        // Escape HTML in name
        const safeName = child.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        html += `
            <tr class="${rowClass}" data-id="${child.id}" data-parent="${node.id}" style="${node.id !== 'root' ? 'display:none' : ''}" onclick="toggleRow('${child.id}')">
                <td style="padding-left: ${padding}px">
                    ${toggleIcon} ${icon} ${safeName}
                </td>
                <td>${child.score}</td>
                <td>${methodCount}</td>
            </tr>
        `;

        if (child.type === 'file' && child.methods) {
            const sortedMethods = [...child.methods].sort((a, b) => b.score - a.score);
            for (const method of sortedMethods) {
                const safeMethodName = method.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `
                    <tr class="method-row" data-parent="${child.id}" style="display:none">
                        <td style="padding-left: ${padding + 30}px">ƒ ${safeMethodName}</td>
                        <td>${method.score}</td>
                        <td>${method.endLine - method.startLine + 1}</td>
                    </tr>
                `;
            }
        }

        if (isFolder) {
            html += renderTreeRows(child, level + 1);
        }
    }

    return html;
}

export function generateHtmlReport(result: ProjectAnalysisResult): string {
    const root = buildFileTree(result.files);
    const rows = renderTreeRows(root, 0);
    const date = new Date().toLocaleString();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cognitive Complexity Report</title>
    <style>
        body { font-family: sans-serif; padding: 20px; color: #333; }
        h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        th { background-color: #f5f5f5; }
        th:first-child { width: 60%; }
        th:nth-child(2) { width: 15%; }
        th:nth-child(3) { width: 25%; }

        .folder-row { cursor: pointer; background-color: #eef; font-weight: bold; }
        .folder-row:hover { background-color: #dde; }
        .file-row { cursor: pointer; background-color: #fafafa; }
        .file-row:hover { background-color: #f0f0f0; }
        .method-row td { color: #666; font-size: 0.9em; }

        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .card { background: #f5f5f5; padding: 15px; border-radius: 8px; }
        .score { font-size: 24px; font-weight: bold; color: #007acc; }

        .toggle-icon { display: inline-block; width: 20px; transition: transform 0.2s; cursor: pointer; }
        .expanded .toggle-icon { transform: rotate(90deg); }
    </style>
    <script>
        function toggleRow(id) {
            const row = document.querySelector(\`tr[data-id="\${id}"]\`);
            const icon = document.getElementById(\`icon-\${id}\`);

            if (!row || !icon) return; // Leaf nodes might not have children/icons

            const isExpanded = row.classList.contains('expanded');

            if (isExpanded) {
                row.classList.remove('expanded');
                // Collapse all children recursively
                hideChildren(id);
            } else {
                row.classList.add('expanded');
                // Show immediate children
                showChildren(id);
            }
        }

        function showChildren(parentId) {
            const children = document.querySelectorAll(\`tr[data-parent="\${parentId}"]\`);
            children.forEach(child => {
                child.style.display = 'table-row';
                // Note: We do NOT recursively expand folders. User has to click them.
            });
        }

        function hideChildren(parentId) {
            const children = document.querySelectorAll(\`tr[data-parent="\${parentId}"]\`);
            children.forEach(child => {
                child.style.display = 'none';
                // If this child is a folder that is expanded, collapse it too
                if (child.classList.contains('expanded')) {
                    child.classList.remove('expanded');
                    const childId = child.getAttribute('data-id');
                    if (childId) hideChildren(childId);
                }
            });
        }
    </script>
</head>
<body>
    <h1>Cognitive Complexity Report</h1>
    <div class="summary">
        <div class="card">
            <div>Total Complexity</div>
            <div class="score">${result.totalScore}</div>
        </div>
        <div class="card">
            <div>Files Analyzed</div>
            <div class="score">${result.files.length}</div>
        </div>
        <div class="card">
            <div>Generated At</div>
            <div>${date}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Hierarchy</th>
                <th>Complexity</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>
    `;
}
