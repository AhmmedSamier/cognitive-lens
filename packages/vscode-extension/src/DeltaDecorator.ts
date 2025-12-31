import { TextEditor, TextEditorDecorationType, window, DecorationRangeBehavior, Range, ThemeColor, workspace, Uri } from 'vscode';
import { MethodComplexity } from './types';

let improvedDecorationType: TextEditorDecorationType | undefined;
let regressedDecorationType: TextEditorDecorationType | undefined;

export function updateDeltaDecorations(editor: TextEditor, currentComplexities: MethodComplexity[], baseComplexities: MethodComplexity[] | undefined) {
    // Check configuration
    const config = workspace.getConfiguration('cognitiveComplexity', editor.document.uri);
    if (!config.get<boolean>('showInlayHints.complexityDelta', true)) {
        clearDecorations(editor);
        return;
    }

    if (!improvedDecorationType || !regressedDecorationType) {
        createDecorationTypes();
    }

    if (!baseComplexities) {
        clearDecorations(editor);
        return;
    }

    const improvedRanges: { range: Range, renderOptions: any }[] = [];
    const regressedRanges: { range: Range, renderOptions: any }[] = [];

    for (const current of currentComplexities) {
        // Find corresponding base method
        // Using name for now. Ideally we'd use signature or location heuristic, but name is a good start.
        const base = baseComplexities.find(b => b.name === current.name);

        if (base) {
            const delta = current.score - base.score;
            if (delta !== 0) {
                const startPos = editor.document.positionAt(current.startIndex);
                const endPos = editor.document.positionAt(current.startIndex + current.name.length); // Approximate end of name?
                // Actually, we want to place it *after* the method declaration line, or at the end of the line.
                // Let's place it at the end of the first line of the method.

                const line = editor.document.lineAt(startPos.line);
                const range = new Range(line.range.end, line.range.end);

                const sign = delta > 0 ? '+' : '';
                const text = ` ${sign}${delta} Complexity`;

                const renderOptions = {
                    after: {
                        contentText: text,
                        margin: '0 0 0 10px',
                        fontWeight: 'bold'
                    }
                };

                if (delta > 0) {
                    // Regression (Red)
                    regressedRanges.push({ range, renderOptions });
                } else {
                    // Improvement (Green)
                    improvedRanges.push({ range, renderOptions });
                }
            }
        }
    }

    if (improvedDecorationType) editor.setDecorations(improvedDecorationType, improvedRanges);
    if (regressedDecorationType) editor.setDecorations(regressedDecorationType, regressedRanges);
}

function createDecorationTypes() {
    improvedDecorationType = window.createTextEditorDecorationType({
        after: {
            color: 'lightgreen', // Fallback
            // ThemeColor is better but "green" isn't a standard ThemeColor.
            // We can use 'testing.iconPassed' or similar.
             color: new ThemeColor('testing.iconPassed')
        },
        rangeBehavior: DecorationRangeBehavior.ClosedOpen
    });

    regressedDecorationType = window.createTextEditorDecorationType({
        after: {
             color: new ThemeColor('errorForeground')
        },
        rangeBehavior: DecorationRangeBehavior.ClosedOpen
    });
}

function clearDecorations(editor: TextEditor) {
    if (improvedDecorationType) editor.setDecorations(improvedDecorationType, []);
    if (regressedDecorationType) editor.setDecorations(regressedDecorationType, []);
}

export function disposeDeltaDecorations() {
    if (improvedDecorationType) improvedDecorationType.dispose();
    if (regressedDecorationType) regressedDecorationType.dispose();
    improvedDecorationType = undefined;
    regressedDecorationType = undefined;
}
