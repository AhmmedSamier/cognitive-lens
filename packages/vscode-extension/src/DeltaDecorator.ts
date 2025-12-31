import { TextEditor, TextEditorDecorationType, window, DecorationRangeBehavior, Range, ThemeColor, workspace, Uri } from 'vscode';
import { MethodComplexity } from './types';

let improvedDecorationType: TextEditorDecorationType | undefined;
let regressedDecorationType: TextEditorDecorationType | undefined;

export function updateDeltaDecorations(editor: TextEditor, currentComplexities: MethodComplexity[]) {
    // Check configuration
    const config = workspace.getConfiguration('cognitiveComplexity', editor.document.uri);
    if (!config.get<boolean>('showComplexityDeltaDecoration', true)) {
        clearDecorations(editor);
        return;
    }

    if (!improvedDecorationType || !regressedDecorationType) {
        createDecorationTypes();
    }

    const improvedRanges: { range: Range, renderOptions: any }[] = [];
    const regressedRanges: { range: Range, renderOptions: any }[] = [];

    let deltaCount = 0;
    for (const current of currentComplexities) {
        const delta = current.complexityDelta;

        if (delta !== undefined && delta !== 0) {
            deltaCount++;
            const startPos = editor.document.positionAt(current.startIndex);
            // Place it at the end of the first line of the method.
            const line = editor.document.lineAt(startPos.line);
            const range = new Range(line.range.end, line.range.end);

            const sign = delta > 0 ? '+' : '';
            const text = ` ${sign}${delta} Complexity`;

            if (delta > 0) {
                // Regression (Red)
                const renderOptions = {
                    after: {
                        contentText: text,
                        margin: '0 0 0 10px',
                        fontWeight: 'bold',
                        color: new ThemeColor('charts.red')
                    }
                };
                regressedRanges.push({ range, renderOptions });
            } else {
                // Improvement (Green)
                const renderOptions = {
                    after: {
                        contentText: text,
                        margin: '0 0 0 10px',
                        fontWeight: 'bold',
                        color: new ThemeColor('charts.green')
                    }
                };
                improvedRanges.push({ range, renderOptions });
            }
        }
    }

    // console.log(`[Cognitive Lens] Applied ${deltaCount} delta decorations to ${editor.document.fileName}`);

    if (improvedDecorationType) editor.setDecorations(improvedDecorationType, improvedRanges);
    if (regressedDecorationType) editor.setDecorations(regressedDecorationType, regressedRanges);
}

function createDecorationTypes() {
    improvedDecorationType = window.createTextEditorDecorationType({
        after: {
            color: new ThemeColor('charts.green')
        },
        rangeBehavior: DecorationRangeBehavior.ClosedOpen
    });

    regressedDecorationType = window.createTextEditorDecorationType({
        after: {
            color: new ThemeColor('charts.red')
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
