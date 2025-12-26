export interface MethodComplexity {
  name: string;
  score: number;
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
  isCallback?: boolean;
  complexityDelta?: number;
}
