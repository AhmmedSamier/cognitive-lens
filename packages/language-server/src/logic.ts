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
    showDiagnostics: boolean;
    showInlayHints: {
        methodScore: boolean;
        details: boolean;
    };
    totalScorePrefix: string;
}

export const defaultSettings: CognitiveComplexitySettings = {
    threshold: {
        warning: 15,
        error: 25
    },
    showCodeLens: true,
    showDiagnostics: true,
    showInlayHints: {
        methodScore: true,
        details: true
    },
    totalScorePrefix: 'Cognitive Complexity'
};

export function computeDiagnostics(
    document: TextDocument,
    complexities: MethodComplexity[],
    settings: CognitiveComplexitySettings
): Diagnostic[] {
    if (!settings.showDiagnostics) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    for (const complexity of complexities) {
        if (complexity.score >= settings.threshold.warning) {
            const start = document.positionAt(complexity.startIndex);
            const end = document.positionAt(complexity.endIndex);

            let range = { start, end };

            // Try to approximate the method signature line
            if (end.line > start.line) {
                 const lineText = getLineText(document, start.line);
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

// --- Helper Functions for Inlay Hints ---

function getLineText(document: TextDocument, line: number): string {
    const text = document.getText({
        start: { line, character: 0 },
        end: { line: line + 1, character: 0 }
    });
    return text.replace(/(\r\n|\n|\r)/gm, "");
}

function getIndentation(lineText: string): string {
    const indentEnd = lineText.search(/\S|$/);
    return lineText.substring(0, indentEnd);
}

interface MethodHintPosition {
    position: Position;
    paddingLeft: boolean;
    paddingRight: boolean;
    labelPrefix: string;
}

function calculateMethodHintPosition(
    document: TextDocument,
    line: number,
    startLine: number,
    endLine: number
): MethodHintPosition | null {
    if (line > 0) {
        // Prefer placing on previous line
        const prevLineIndex = line - 1;
        const prevLineText = getLineText(document, prevLineIndex);
        const currentLineText = getLineText(document, line);
        const currentIndentStr = getIndentation(currentLineText);

        if (prevLineText.trim().length === 0) {
            // Previous line is empty/whitespace: align with current indentation
            let labelPrefix = "";
            if (currentIndentStr.startsWith(prevLineText)) {
                 labelPrefix = currentIndentStr.substring(prevLineText.length);
            } else if (prevLineText.length < currentIndentStr.length) {
                 labelPrefix = " ".repeat(currentIndentStr.length - prevLineText.length);
            }

            return {
                position: { line: prevLineIndex, character: prevLineText.length },
                paddingLeft: false,
                paddingRight: false,
                labelPrefix
            };
        } else {
            // Previous line has content: place at end
            return {
                position: { line: prevLineIndex, character: prevLineText.length },
                paddingLeft: true,
                paddingRight: false,
                labelPrefix: ""
            };
        }
    } else {
        // Fallback to start of current line
        if (line < startLine || line > endLine) return null;

        const lineText = getLineText(document, line);
        const firstNonWhitespace = lineText.search(/\S|$/);
        return {
            position: { line, character: firstNonWhitespace },
            paddingLeft: false,
            paddingRight: true,
            labelPrefix: ""
        };
    }
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
    if (settings.showInlayHints.methodScore) {
        for (const method of complexities) {
            if (method.isCallback) continue;
            if (method.score === 0) continue;

            const startPos = document.positionAt(method.startIndex);
            const methodEndPos = document.positionAt(method.endIndex);
            const lines = methodEndPos.line - startPos.line + 1;
            const line = startPos.line;

            const posInfo = calculateMethodHintPosition(document, line, startLine, endLine);

            if (!posInfo) continue;

            // Check visibility bounds for previous line placement
            if (posInfo.position.line < startLine - 1 || posInfo.position.line > endLine) continue;

            let icon = '🟢';
            if (method.score >= settings.threshold.error) {
                icon = '🔴';
            } else if (method.score >= settings.threshold.warning) {
                icon = '🟡';
            }

            result.push({
                position: posInfo.position,
                label: `${posInfo.labelPrefix}${icon} ${settings.totalScorePrefix}: ${method.score} (${lines} lines)`,
                kind: InlayHintKind.Type,
                paddingLeft: posInfo.paddingLeft,
                paddingRight: posInfo.paddingRight
            });
        }
    }

    if (settings.showInlayHints.details) {
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
            const lineText = getLineText(document, line);

            result.push({
                position: { line, character: lineText.length },
                label: ` ${label}`,
                kind: InlayHintKind.Parameter,
                paddingLeft: true
            });
        }
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
        const lines = end.line - start.line + 1;

        let icon = '🟢';
        if (c.score >= settings.threshold.error) {
            icon = '🔴';
        } else if (c.score >= settings.threshold.warning) {
            icon = '🟡';
        }

        return {
            range: { start, end },
            command: {
                title: `${icon} ${settings.totalScorePrefix}: ${c.score} (${lines} lines)`,
                command: '',
                arguments: []
            },
            data: c.name
        };
    });
}
