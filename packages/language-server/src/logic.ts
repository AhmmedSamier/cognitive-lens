import {
    Diagnostic,
    DiagnosticSeverity,
    InlayHint,
    InlayHintKind,
    CodeLens,
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MethodComplexity } from '@cognitive-complexity/core';

export interface CognitiveComplexitySettings {
    threshold: {
        warning: number;
        error: number;
    };
    showCodeLens: boolean;
}

export const defaultSettings: CognitiveComplexitySettings = {
    threshold: {
        warning: 15,
        error: 30
    },
    showCodeLens: true
};

export function computeDiagnostics(
    document: TextDocument,
    complexities: MethodComplexity[],
    settings: CognitiveComplexitySettings
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const complexity of complexities) {
        if (complexity.score >= settings.threshold.warning) {
            const start = document.positionAt(complexity.startIndex);
            const end = document.positionAt(complexity.endIndex);

            let range = { start, end };

            // Try to approximate the method signature line
            if (end.line > start.line) {
                 const lineText = document.getText({
                     start: { line: start.line, character: 0 },
                     end: { line: start.line + 1, character: 0 }
                 });
                 // Use line length to stay within LSP bounds
                 range.end = { line: start.line, character: lineText.length };
            }

            const severity = complexity.score >= settings.threshold.error
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning;

            const diagnostic: Diagnostic = {
                severity,
                range,
                message: `Cognitive Complexity is ${complexity.score} (threshold: ${
                    severity === DiagnosticSeverity.Error
                        ? settings.threshold.error
                        : settings.threshold.warning
                })`,
                source: 'Cognitive Complexity'
            };
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

export function computeInlayHints(
    document: TextDocument,
    complexities: MethodComplexity[],
    settings: CognitiveComplexitySettings,
    range: { start: Position, end: Position }
): InlayHint[] {
    const result: InlayHint[] = [];
    const startLine = range.start.line;
    const endLine = range.end.line;

    // Group by line
    const hintsByLine = new Map<number, { score: number, message: string }[]>();
    for (const method of complexities) {
        for (const detail of method.details) {
            if (!hintsByLine.has(detail.line)) {
                hintsByLine.set(detail.line, []);
            }
            hintsByLine.get(detail.line)!.push(detail);
        }
    }

    // Add method total score as inlay hint
    for (const method of complexities) {
        if (method.isCallback) continue;

        const startPos = document.positionAt(method.startIndex);
        const line = startPos.line;

        if (line < startLine || line > endLine) continue;

        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        let icon = '🟢';
        if (method.score >= settings.threshold.error) {
            icon = '🔴';
        } else if (method.score >= settings.threshold.warning) {
            icon = '🟡';
        }

        result.push({
            position: { line, character: len },
            label: ` ${icon} Cognitive Complexity: ${method.score}`,
            kind: InlayHintKind.Type,
            paddingLeft: true
        });
    }

    for (const [line, details] of hintsByLine) {
        if (line < startLine || line > endLine) continue;

        const totalScore = details.reduce((sum, d) => sum + d.score, 0);

        const messages = details
            .map(d => d.message)
            .filter(m => m !== 'nesting');

        let uniqueMessages = Array.from(new Set(messages));
        if (uniqueMessages.length === 0 && totalScore > 0) {
             uniqueMessages = ['nesting'];
        }

        const label = `(+${totalScore} ${uniqueMessages.join(', ')})`;

        const lineText = document.getText({
             start: { line, character: 0 },
             end: { line: line + 1, character: 0 }
        });
        const len = lineText.replace(/(\r\n|\n|\r)/gm, "").length;

        result.push({
            position: { line, character: len },
            label: ` ${label}`,
            kind: InlayHintKind.Parameter,
            paddingLeft: true
        });
    }

    return result;
}

export function computeCodeLenses(
    document: TextDocument,
    complexities: MethodComplexity[],
    settings: CognitiveComplexitySettings
): CodeLens[] {
    if (!settings.showCodeLens) {
        return [];
    }

    return complexities
        .filter(c => !c.isCallback)
        .map(c => {
        const start = document.positionAt(c.startIndex);
        const end = document.positionAt(c.endIndex);

        let icon = '🟢';
        if (c.score >= settings.threshold.error) {
            icon = '🔴';
        } else if (c.score >= settings.threshold.warning) {
            icon = '🟡';
        }

        return {
            range: { start, end },
            command: {
                title: `${icon} Cognitive Complexity: ${c.score}`,
                command: '',
                arguments: []
            },
            data: c.name
        };
    });
}
