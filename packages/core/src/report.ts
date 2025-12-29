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

export function generateHtmlReport(result: ProjectAnalysisResult): string {
    const sortedFiles = [...result.files].sort((a, b) => b.totalScore - a.totalScore);
    const date = new Date().toLocaleString();

    const fileRows = sortedFiles.map((file, index) => {
        const fileId = `file-${index}`;
        const safePath = file.path.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const methodRows = file.methods
            .sort((a, b) => b.score - a.score)
            .map(m => `
                <tr class="method-row method-${fileId}" style="display:none">
                    <td class="indent">${m.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${m.score}</td>
                    <td>${m.endLine - m.startLine + 1}</td>
                </tr>
            `).join('');

        return `
            <tr class="file-row" onclick="toggleMethods('${fileId}')">
                <td><span class="toggle-icon" id="icon-${fileId}">▶</span> ${safePath}</td>
                <td>${file.totalScore}</td>
                <td>${file.methods.length} methods</td>
            </tr>
            ${methodRows}
        `;
    }).join('');

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
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #eee; }
        th { background-color: #f5f5f5; }
        .file-row { cursor: pointer; background-color: #fafafa; font-weight: bold; }
        .file-row:hover { background-color: #f0f0f0; }
        .method-row td { color: #666; }
        .indent { padding-left: 40px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .card { background: #f5f5f5; padding: 15px; border-radius: 8px; }
        .score { font-size: 24px; font-weight: bold; color: #007acc; }
        .toggle-icon { display: inline-block; width: 20px; transition: transform 0.2s; }
        .expanded .toggle-icon { transform: rotate(90deg); }
    </style>
    <script>
        function toggleMethods(fileId) {
            const rows = document.querySelectorAll(\`.method-\${fileId}\`);
            const icon = document.getElementById(\`icon-\${fileId}\`);
            const fileRow = icon.closest('tr');

            fileRow.classList.toggle('expanded');

            rows.forEach(row => {
                if (row.style.display === 'none') {
                    row.style.display = 'table-row';
                } else {
                    row.style.display = 'none';
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
                <th>File / Method</th>
                <th>Complexity</th>
                <th>Lines</th>
            </tr>
        </thead>
        <tbody>
            ${fileRows}
        </tbody>
    </table>
</body>
</html>
    `;
}
