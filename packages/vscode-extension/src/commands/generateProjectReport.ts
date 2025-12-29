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

    // Limit to likely source files to avoid huge scans
    // Passing undefined for exclude allows VS Code to respect .gitignore and files.exclude settings
    let files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,cs}', undefined);
    if (files.length === 0) {
        vscode.window.showInformationMessage('No supported files found in workspace');
        return;
    }

    // Filter out files ignored by .gitignore using GitService
    // This is necessary because findFiles sometimes includes ignored files depending on user settings
    const gitService = new GitService();
    const filePaths = files.map(f => f.fsPath);
    const validPaths = new Set(await gitService.filterIgnored(filePaths));
    files = files.filter(f => validPaths.has(f.fsPath));

    if (files.length === 0) {
        vscode.window.showInformationMessage('No source files found (all were ignored).');
        return;
    }

    const reportData: ProjectAnalysisResult = {
        files: [],
        totalScore: 0
    };

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating Cognitive Complexity Report",
        cancellable: true
    }, async (progress, token) => {
        let processed = 0;
        const total = files.length;

        for (const file of files) {
            if (token.isCancellationRequested) break;

            // Explicitly skip node_modules just in case it's not in .gitignore
            if (file.fsPath.includes('node_modules')) continue;

            progress.report({ message: `Analyzing ${path.basename(file.fsPath)}...`, increment: (1 / total) * 100 });

            try {
                // Determine language ID based on extension
                let languageId = 'typescript'; // Default fallback
                const ext = path.extname(file.fsPath).toLowerCase();
                if (ext === '.cs') languageId = 'csharp';
                else if (ext === '.js') languageId = 'javascript';
                else if (ext === '.jsx') languageId = 'javascriptreact';
                else if (ext === '.tsx') languageId = 'typescriptreact';

                // Send URI to language server to handle file reading and analysis
                const complexities = await client.sendRequest<MethodComplexity[]>('cognitive-complexity/analyzeFile', {
                    uri: file.toString(),
                    languageId: languageId
                });

                if (complexities && complexities.length > 0) {
                    const fileScore = complexities.reduce((acc, curr) => acc + curr.score, 0);
                    reportData.files.push({
                        path: vscode.workspace.asRelativePath(file),
                        methods: complexities,
                        totalScore: fileScore
                    });
                    reportData.totalScore += fileScore;
                }
            } catch (e) {
                console.error(`Failed to analyze ${file.fsPath}:`, e);
            }
            processed++;
        }
    });

    if (reportData.files.length === 0) {
        vscode.window.showInformationMessage('No complexity found in any files.');
        return;
    }

    // Generate HTML
    const html = generateHtmlReport(reportData);

    // Save to file
    const reportPath = path.join(folder.uri.fsPath, 'cognitive-complexity-report.html');
    try {
        await fs.promises.writeFile(reportPath, html, 'utf8');
        const selection = await vscode.window.showInformationMessage(
            `Report saved to ${path.basename(reportPath)}`,
            'Open in Browser'
        );

        if (selection === 'Open in Browser') {
            await vscode.env.openExternal(vscode.Uri.file(reportPath));
        }
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to save report: ${e}`);
    }
}
