import * as ts from 'typescript';
import { Parser, Tree } from 'web-tree-sitter';
import { MethodComplexity } from './types';
import { calculateTypeScriptComplexity } from './calculators/typescript';
import { calculateCSharpComplexity } from './calculators/csharp';

export * from './types';

export async function calculateComplexity(
    source: ts.SourceFile | Tree,
    language: 'typescript' | 'csharp'
): Promise<MethodComplexity[]> {
    if (language === 'typescript') {
        return calculateTypeScriptComplexity(source as ts.SourceFile);
    } else if (language === 'csharp') {
        return calculateCSharpComplexity(source as Tree);
    }
    return [];
}
