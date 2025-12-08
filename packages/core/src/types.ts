export interface ComplexityDetail {
    line: number;
    score: number;
    message: string;
}

export interface MethodComplexity {
    name: string;
    score: number;
    details: ComplexityDetail[];
    startIndex: number;
    endIndex: number;
}
