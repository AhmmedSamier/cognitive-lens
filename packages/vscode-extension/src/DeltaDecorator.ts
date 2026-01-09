import {
  DecorationRangeBehavior,
  Range,
  TextEditor,
  TextEditorDecorationType,
  ThemeColor,
  window,
  workspace,
} from 'vscode';
import { MethodComplexity } from './types';

let improvedDecorationType: TextEditorDecorationType | undefined;
let regressedDecorationType: TextEditorDecorationType | undefined;

export function updateDeltaDecorations(
  editor: TextEditor,
  currentComplexities: MethodComplexity[],
) {
  const config = workspace.getConfiguration('cognitiveComplexity', editor.document.uri);
  if (!config.get<boolean>('showComplexityDeltaDecoration', true)) {
    clearDecorations(editor);
    return;
  }

  ensureDecorationTypes();

  const improvedRanges: { range: Range; renderOptions: any }[] = [];
  const regressedRanges: { range: Range; renderOptions: any }[] = [];

  for (const current of currentComplexities) {
    processDelta(editor, current, improvedRanges, regressedRanges);
  }

  if (improvedDecorationType) editor.setDecorations(improvedDecorationType, improvedRanges);
  if (regressedDecorationType) editor.setDecorations(regressedDecorationType, regressedRanges);
}

function ensureDecorationTypes() {
  if (!improvedDecorationType || !regressedDecorationType) {
    createDecorationTypes();
  }
}

function processDelta(
  editor: TextEditor,
  method: MethodComplexity,
  improvedRanges: { range: Range; renderOptions: any }[],
  regressedRanges: { range: Range; renderOptions: any }[],
) {
  if (method.isCallback) return;
  const delta = method.complexityDelta;

  if (delta !== undefined && delta !== 0) {
    const startPos = editor.document.positionAt(method.startIndex);
    const line = editor.document.lineAt(startPos.line);
    const range = new Range(line.range.end, line.range.end);
    const decoration = createDecorationOption(delta);

    if (delta > 0) {
      regressedRanges.push({ range, renderOptions: decoration });
    } else {
      improvedRanges.push({ range, renderOptions: decoration });
    }
  }
}

function createDecorationOption(delta: number) {
  const sign = delta > 0 ? '+' : '';
  const text = ` ${sign}${delta} Complexity`;
  return {
    after: {
      contentText: text,
      margin: '0 0 0 10px',
      fontWeight: 'bold',
      color: delta > 0 ? new ThemeColor('charts.red') : new ThemeColor('charts.green'),
    },
  };
}

function createDecorationTypes() {
  improvedDecorationType = window.createTextEditorDecorationType({
    after: {
      color: new ThemeColor('charts.green'),
    },
    rangeBehavior: DecorationRangeBehavior.ClosedOpen,
  });

  regressedDecorationType = window.createTextEditorDecorationType({
    after: {
      color: new ThemeColor('charts.red'),
    },
    rangeBehavior: DecorationRangeBehavior.ClosedOpen,
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
