import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient } from 'vscode-languageclient/node';
import { ProjectAnalysisResult, generateHtmlReport } from '@cognitive-complexity/core';
import { MethodComplexity } from '../types';

export async function generateProjectReport(client: LanguageClient) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    // Limit to likely source files to avoid huge scans
    const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,cs}', '**/node_modules/**');
    if (files.length === 0) {
        vscode.window.showInformationMessage('No supported files found in workspace');
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

            progress.report({ message: `Analyzing ${path.basename(file.fsPath)}...`, increment: (1 / total) * 100 });

            try {
                // Read file content
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const languageId = document.languageId;

                // Use the Language Server to analyze the text
                const complexities = await client.sendRequest<MethodComplexity[]>('cognitive-complexity/analyzeText', {
                    text: text,
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

    // Show in Webview
    const panel = vscode.window.createWebviewPanel(
        'cognitiveComplexityReport',
        'Cognitive Complexity Report',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: []
        }
    );

    panel.webview.html = html;
}
