import { Tree } from 'web-tree-sitter';
import { calculateCComplexity } from './calculators/c';
import { calculateCppComplexity } from './calculators/cpp';
import { calculateCSharpComplexity } from './calculators/csharp';
import { calculateDartComplexity } from './calculators/dart';
import { calculateTypeScriptComplexity } from './calculators/typescript';
import { MethodComplexity } from './types';

export * from './types';

type ComplexityCalculator = (tree: Tree) => MethodComplexity[];

const calculators: Record<string, ComplexityCalculator> = {
  typescript: calculateTypeScriptComplexity,
  csharp: calculateCSharpComplexity,
  dart: calculateDartComplexity,
  c: calculateCComplexity,
  cpp: calculateCppComplexity,
};

export async function calculateComplexity(
  source: Tree,
  language: string,
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
