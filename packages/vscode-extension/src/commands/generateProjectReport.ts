import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LanguageClient } from 'vscode-languageclient/node';
import { ProjectAnalysisResult, generateHtmlReport } from '@cognitive-complexity/core';
import { MethodComplexity } from '../types';
import { GitService } from '../gitService';

export async function generateProjectReport(client: LanguageClient) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating Cognitive Complexity Report",
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: "Finding files..." });

            // CRITICAL OPTIMIZATION: Use a restricted search with common excludes
            // This prevents VS Code from scanning massive node_modules or build folders 
            // even if they aren't in the user's settings.
            const excludePattern = '{**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/.*/**}';
            let files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,cs}', excludePattern, undefined, token);

            if (files.length === 0) {
                // Try again without restricted excludes if nothing found? 
                // No, better to trust the sensible defaults for performance.
                vscode.window.showInformationMessage('No supported files found in workspace (checked ts, tsx, js, jsx, cs).');
                return;
            }

            if (token.isCancellationRequested) return;

            progress.report({ message: `Filtering ${files.length} files...` });

            const gitService = new GitService();
            const filePaths = files.map(f => f.fsPath);
            const filteredPaths = await gitService.filterIgnored(filePaths);

            const validPaths = new Set(filteredPaths.map(p => p.toLowerCase()));
            files = files.filter(f => validPaths.has(f.fsPath.toLowerCase()));

            if (files.length === 0) {
                vscode.window.showInformationMessage('No source files found (all were ignored by git).');
                return;
            }

            const reportData: ProjectAnalysisResult = {
                files: [],
                totalScore: 0
            };

            const total = files.length;
            let analyzedCount = 0;

            // OPTIMIZATION: Parallel Analysis
            // Process files in chunks to avoid overwhelming the server but still gain speed.
            const concurrency = 10;
            const chunks: vscode.Uri[][] = [];
            for (let i = 0; i < files.length; i += concurrency) {
                chunks.push(files.slice(i, i + concurrency));
            }

            for (const chunk of chunks) {
                if (token.isCancellationRequested) break;

                const results = await Promise.all(chunk.map(async (file) => {
                    try {
                        const relativePath = vscode.workspace.asRelativePath(file).split(/[\/\\]/).join('/');

                        // Determine language ID
                        let languageId = 'typescript';
                        const ext = path.extname(file.fsPath).toLowerCase();
                        if (ext === '.cs') languageId = 'csharp';
                        else if (ext === '.js') languageId = 'javascript';
                        else if (ext === '.jsx') languageId = 'javascriptreact';
                        else if (ext === '.tsx') languageId = 'typescriptreact';

                        const complexities = await client.sendRequest<MethodComplexity[]>('cognitive-complexity/analyzeFile', {
                            uri: file.toString(),
                            languageId: languageId
                        });

                        return { file, relativePath, complexities };
                    } catch (e) {
                        console.error(`Failed to analyze ${file.fsPath}:`, e);
                        return null;
                    }
                }));

                for (const res of results) {
                    if (res && res.complexities && res.complexities.length > 0) {
                        const fileScore = res.complexities
                            .filter(c => c.isRoot)
                            .reduce((acc, curr) => acc + curr.score, 0);
                        reportData.files.push({
                            path: res.relativePath,
                            methods: res.complexities.map(c => ({
                                ...c,
                                details: (c as any).details || []
                            })),
                            totalScore: fileScore
                        });
                        reportData.totalScore += fileScore;
                    }
                }

                analyzedCount += chunk.length;
                progress.report({
                    message: `Analyzed ${Math.min(analyzedCount, total)}/${total} files...`,
                    increment: (chunk.length / total) * 100
                });
            }

            if (token.isCancellationRequested) return;

            if (reportData.files.length === 0) {
                vscode.window.showInformationMessage('No complexity found in any of the analyzed files.');
                return;
            }

            progress.report({ message: "Generating HTML report..." });
            const html = generateHtmlReport(reportData);
            const reportPath = path.join(folder.uri.fsPath, 'cognitive-complexity-report.html');

            await fs.promises.writeFile(reportPath, html, 'utf8');
            const selection = await vscode.window.showInformationMessage(
                `Report saved to ${path.basename(reportPath)}`,
                'Open in Browser'
            );

            if (selection === 'Open in Browser') {
                await vscode.env.openExternal(vscode.Uri.file(reportPath));
            }
        });
    } catch (e) {
        vscode.window.showErrorMessage(`An error occurred: ${e}`);
    }
}
