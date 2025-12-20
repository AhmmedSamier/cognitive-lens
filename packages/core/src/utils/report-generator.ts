import { MethodComplexity } from './types';

export interface FileReport {
    file: string;
    methods: MethodComplexity[];
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function generateHtmlReport(reports: FileReport[]): string {
    const totalMethods = reports.reduce((acc, r) => acc + r.methods.length, 0);
    const totalComplexity = reports.reduce((acc, r) => acc + r.methods.reduce((sum, m) => sum + m.score, 0), 0);
    const topMethods = reports
        .flatMap(r => r.methods.map(m => ({ ...m, file: r.file })))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Cognitive Complexity Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
        .card { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-box { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-value { font-size: 32px; font-weight: bold; color: #007acc; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .score { font-weight: bold; }
        .high { color: #d32f2f; }
        .medium { color: #f57c00; }
        .low { color: #388e3c; }

        /* Treemap simulation */
        .treemap { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 20px; }
        .node { height: 60px; flex-grow: 1; min-width: 60px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; position: relative; overflow: hidden; }
        .node span { z-index: 2; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
    </style>
</head>
<body>
    <h1>Cognitive Complexity Report</h1>

    <div class="stats">
        <div class="stat-box">
            <div class="stat-value">${totalMethods}</div>
            <div>Total Methods</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${totalComplexity}</div>
            <div>Total Complexity Score</div>
        </div>
    </div>

    <div class="card">
        <h2>Top 10 Most Complex Methods</h2>
        <table>
            <thead>
                <tr>
                    <th>Score</th>
                    <th>Method</th>
                    <th>File</th>
                    <th>Line</th>
                </tr>
            </thead>
            <tbody>
                ${topMethods.map(m => `
                <tr>
                    <td class="score ${getScoreClass(m.score)}">${m.score}</td>
                    <td>${escapeHtml(m.name)}</td>
                    <td>${escapeHtml(m.file)}</td>
                    <td>${m.startLine}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="card">
        <h2>Complexity Heatmap (Top 50)</h2>
        <div class="treemap">
            ${reports.flatMap(r => r.methods.map(m => ({...m, file: r.file})))
                .sort((a, b) => b.score - a.score)
                .slice(0, 50)
                .map(m => `
                <div class="node" style="background-color: ${getColor(m.score)}; flex-basis: ${Math.max(50, m.score * 5)}px" title="${escapeHtml(m.name)} (${m.score}) - ${escapeHtml(m.file)}">
                    <span>${m.score}</span>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
}

function getScoreClass(score: number): string {
    if (score > 25) return 'high';
    if (score > 15) return 'medium';
    return 'low';
}

function getColor(score: number): string {
    // Green (0) to Red (25+)
    if (score >= 25) return '#d32f2f';
    if (score >= 15) return '#f57c00';
    if (score >= 10) return '#fbc02d';
    return '#388e3c';
}
