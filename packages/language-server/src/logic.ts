import {
    Diagnostic,
    DiagnosticSeverity,
    InlayHint,
    InlayHintKind,
    CodeLens,
    Position,
    Hover,
    Range
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
        complexityDelta: boolean;
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
        complexityDelta: true,
        details: true
    },
    totalScorePrefix: 'Cognitive Complexity'
};

export function normalizeSettings(input: any): CognitiveComplexitySettings {
    if (!input) return defaultSettings;

    // Start with a deep copy of defaults to ensure we don't mutate them
    // and that we have all required fields.
    const settings: CognitiveComplexitySettings = JSON.parse(JSON.stringify(defaultSettings));

    // First, if input has top-level keys that match our interface, copy them.
    // This handles the VS Code case where we get a nested object.
    if (typeof input === 'object') {
        if (input.threshold) {
            if (typeof input.threshold.warning === 'number') settings.threshold.warning = input.threshold.warning;
            if (typeof input.threshold.error === 'number') settings.threshold.error = input.threshold.error;
        }
        if (typeof input.showCodeLens === 'boolean') settings.showCodeLens = input.showCodeLens;
        if (typeof input.showDiagnostics === 'boolean') settings.showDiagnostics = input.showDiagnostics;
        if (input.showInlayHints) {
            if (typeof input.showInlayHints.methodScore === 'boolean') settings.showInlayHints.methodScore = input.showInlayHints.methodScore;
            if (typeof input.showInlayHints.complexityDelta === 'boolean') settings.showInlayHints.complexityDelta = input.showInlayHints.complexityDelta;
            if (typeof input.showInlayHints.details === 'boolean') settings.showInlayHints.details = input.showInlayHints.details;
        }
        if (typeof input.totalScorePrefix === 'string') settings.totalScorePrefix = input.totalScorePrefix;

        // Second, scan for flat dot-notation keys.
        // This handles the Visual Studio case or flat JSON configs.
        // We look for keys starting with 'cognitiveComplexity.' or just matching our structure.
        // The LSP section passed might be just the object under 'cognitiveComplexity',
        // so we check for keys like 'threshold.warning'.
        Object.keys(input).forEach(key => {
            // Remove 'cognitiveComplexity.' prefix if present (though usually the section requested has stripped it)
            const cleanKey = key.replace(/^cognitiveComplexity\./, '');

            // Allow-list of known flat keys to map
            if (cleanKey === 'threshold.warning') settings.threshold.warning = Number(input[key]);
            if (cleanKey === 'threshold.error') settings.threshold.error = Number(input[key]);
            if (cleanKey === 'showCodeLens') {
                if (typeof input[key] === 'string') settings.showCodeLens = input[key] === 'true';
                else settings.showCodeLens = Boolean(input[key]);
            }
            if (cleanKey === 'showDiagnostics') {
                if (typeof input[key] === 'string') settings.showDiagnostics = input[key] === 'true';
                else settings.showDiagnostics = Boolean(input[key]);
            }
            if (cleanKey === 'showInlayHints.methodScore') {
                if (typeof input[key] === 'string') settings.showInlayHints.methodScore = input[key] === 'true';
                else settings.showInlayHints.methodScore = Boolean(input[key]);
            }
            if (cleanKey === 'showInlayHints.details') {
                if (typeof input[key] === 'string') settings.showInlayHints.details = input[key] === 'true';
                else settings.showInlayHints.details = Boolean(input[key]);
            }
            if (cleanKey === 'showInlayHints.complexityDelta') {
                if (typeof input[key] === 'string') settings.showInlayHints.complexityDelta = input[key] === 'true';
                else settings.showInlayHints.complexityDelta = Boolean(input[key]);
            }
            if (cleanKey === 'totalScorePrefix') settings.totalScorePrefix = String(input[key]);
        });
    }

    return settings;
}

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
                message: `Cognitive Complexity is ${complexity.score} (threshold: ${severity === DiagnosticSeverity.Error
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



            let deltaLabel = "";
            const hasDelta = method.complexityDelta !== undefined && method.complexityDelta !== null;
            if (hasDelta && settings.showInlayHints.complexityDelta) {
                const isImprovement = method.complexityDelta! < 0;
                const symbol = isImprovement ? "🟢" : "🔴";
                const prefix = method.complexityDelta! > 0 ? "+" : "";
                deltaLabel = ` ${symbol} (${prefix}${method.complexityDelta})`;
            }

            // If score is 0 but has delta, we might want a different icon or label
            let label = `${posInfo.labelPrefix}${settings.totalScorePrefix}: ${method.score}${deltaLabel} (${lines} lines)`;

            result.push({
                position: posInfo.position,
                label: label,
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

// --- Hover Provider for Refactoring Tips ---

export function computeHover(
    document: TextDocument,
    position: Position,
    complexities: MethodComplexity[]
): Hover | null {
    const offset = document.offsetAt(position);

    // Find the smallest method containing the cursor
    // (Sort by length ascending to get inner functions first if nested, though core logic usually flattens or specific nesting handling)
    const method = complexities
        .filter(m => offset >= m.startIndex && offset <= m.endIndex)
        .sort((a, b) => (a.endIndex - a.startIndex) - (b.endIndex - b.startIndex))[0];

    if (!method) return null;

    // Check if we are "hovering" over the method definition itself or inside the body.
    // Usually, users want tips when hovering the function name or signature.
    // Let's assume the user hovers anywhere in the function for now, OR we can restrict to the signature.
    // To limit noise, let's only show if the user hovers over the first line (signature).
    const startPos = document.positionAt(method.startIndex);
    if (position.line > startPos.line + 2) {
        // Allow a slight buffer for multi-line signatures, but don't show when hovering deep in body unless we map specific tokens.
        // Actually, let's check if the complexity is high enough to warrant a tip.
        if (method.score < 15) return null; // No tips needed for simple methods
    }

    if (method.score < 15) return null;

    const contributors = new Map<string, number>();
    method.details.forEach(d => {
        let key = d.message;
        // Normalize messages like "if" vs "nested if" if needed, but core messages are usually clean.
        if (key.includes('nesting')) key = 'Nesting';
        else if (key.includes('if')) key = 'If Statement';
        else if (key.includes('else')) key = 'Else/Else If';
        else if (key.includes('for') || key.includes('while') || key.includes('do')) key = 'Loops';
        else if (key.includes('switch')) key = 'Switch Case';
        else if (key.includes('catch')) key = 'Try/Catch';
        else if (key.includes('ternary')) key = 'Ternary Operator';
        else if (key.includes('recursi')) key = 'Recursion';

        contributors.set(key, (contributors.get(key) || 0) + d.score);
    });

    const sortedContributors = Array.from(contributors.entries())
        .sort((a, b) => b[1] - a[1]);

    const mdLines = [
        `### Refactoring Tips for **${method.name}**`,
        `**Cognitive Complexity**: ${method.score} (High)`,
        ``,
        `**Primary Contributors:**`
    ];

    sortedContributors.forEach(([type, score]) => {
        mdLines.push(`- **${type}** (+${score})`);
        // Add specific advice
        switch (type) {
            case 'Nesting':
                mdLines.push(`  > *Tip: Deep nesting increases mental load. Consider extracting nested blocks into separate methods or using [Guard Clauses](https://refactoring.guru/replace-nested-conditional-with-guard-clauses) to return early.*`);
                break;
            case 'If Statement':
            case 'Else/Else If':
                if (score > 3) mdLines.push(`  > *Tip: Complex conditional logic can often be simplified with polymorphism or strategy patterns.*`);
                break;
            case 'Loops':
                if (score > 3) mdLines.push(`  > *Tip: Consider using functional methods (map/filter/reduce) if applicable, or extract the loop body.*`);
                break;
            case 'Switch Case':
                mdLines.push(`  > *Tip: Large switch statements might indicate a missing abstraction. Consider replacing with a factory or polymorphism.*`);
                break;
        }
    });

    return {
        contents: {
            kind: 'markdown',
            value: mdLines.join('\n')
        },
        range: {
            start: document.positionAt(method.startIndex),
            end: document.positionAt(method.startIndex + method.name.length) // Highlight name
        }
    };
}
