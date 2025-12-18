import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import { calculateComplexity } from '../src/complexity';

async function runBenchmark() {
    await Parser.init();
    const parser = new Parser();
    const langPath = path.resolve(__dirname, '../../vscode-extension/public/tree-sitter-typescript.wasm');
    const lang = await Language.load(langPath);
    parser.setLanguage(lang);

    const baseFunction = `
    function complexFunction(a, b, x, y) {
        if (a) {
            if (b) {
                console.log('nested');
            } else {
                console.log('else');
            }
        }
        for (let i = 0; i < 10; i++) {
            if (i % 2 == 0) {
                console.log('even');
            }
        }
        switch (x) {
            case 1:
                if (y) break;
                break;
            default:
                break;
        }
    }
    `;

    const iterations = 2000;
    const code = baseFunction.repeat(iterations);

    console.log(`Running benchmark with ${iterations} function definitions...`);
    console.log(`Code size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

    // Warmup
    parser.parse(baseFunction);

    // Measure Parsing
    const startParse = performance.now();
    const tree = parser.parse(code);
    const endParse = performance.now();
    console.log(`Parsing time: ${(endParse - startParse).toFixed(2)} ms`);

    // Measure Complexity Calculation
    const startCalc = performance.now();
    const results = await calculateComplexity(tree, 'typescript');
    const endCalc = performance.now();
    console.log(`Complexity calculation time: ${(endCalc - startCalc).toFixed(2)} ms`);

    console.log(`Total methods processed: ${results.length}`);
}

runBenchmark();
