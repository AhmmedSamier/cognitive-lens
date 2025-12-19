import { Parser, Tree } from 'web-tree-sitter';
import { MethodComplexity } from './types';
import { calculateTypeScriptComplexity } from './calculators/typescript';
import { calculateCSharpComplexity } from './calculators/csharp';

export * from './types';

type ComplexityCalculator = (tree: Tree) => MethodComplexity[];

const calculators: Record<string, ComplexityCalculator> = {
    'typescript': calculateTypeScriptComplexity,
    'csharp': calculateCSharpComplexity
};

export async function calculateComplexity(
    source: Tree,
    language: string
): Promise<MethodComplexity[]> {
    const calculator = calculators[language];
    if (calculator) {
        return calculator(source);
    }
    return [];
}

export function registerCalculator(language: string, calculator: ComplexityCalculator) {
    calculators[language] = calculator;
}
