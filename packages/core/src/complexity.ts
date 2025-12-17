import { Parser, Tree } from 'web-tree-sitter';
import { MethodComplexity } from './types';
import { calculateTypeScriptComplexity } from './calculators/typescript';
import { calculateCSharpComplexity } from './calculators/csharp';

export * from './types';

export async function calculateComplexity(
    source: Tree,
    language: 'typescript' | 'csharp'
): Promise<MethodComplexity[]> {
    if (language === 'typescript') {
        return calculateTypeScriptComplexity(source);
    } else if (language === 'csharp') {
        return calculateCSharpComplexity(source);
    }
    return [];
}
