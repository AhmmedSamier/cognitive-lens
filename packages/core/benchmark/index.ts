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

    // Measure Parsing (Full)
    const startParse = performance.now();
    let tree = parser.parse(code);
    const endParse = performance.now();
    console.log(`Full Parsing time: ${(endParse - startParse).toFixed(2)} ms`);

    // Measure Complexity Calculation
    const startCalc = performance.now();
    const results = await calculateComplexity(tree, 'typescript');
    const endCalc = performance.now();
    console.log(`Complexity calculation time: ${(endCalc - startCalc).toFixed(2)} ms`);

    console.log(`Total methods processed: ${results.length}`);

    // Measure Incremental Parsing
    // Simulate adding a character at the beginning
    const editStartIndex = 10; // arbitrary
    const oldEndIndex = 10;
    const newEndIndex = 11;
    const startPosition = { row: 0, column: 10 };
    const oldEndPosition = { row: 0, column: 10 };
    const newEndPosition = { row: 0, column: 11 };

    const newCode = code.slice(0, 10) + " " + code.slice(10);

    tree.edit({
        startIndex: editStartIndex,
        oldEndIndex: oldEndIndex,
        newEndIndex: newEndIndex,
        startPosition: startPosition,
        oldEndPosition: oldEndPosition,
        newEndPosition: newEndPosition
    });

    const startIncParse = performance.now();
    const newTree = parser.parse(newCode, tree);
    const endIncParse = performance.now();
    console.log(`Incremental Parsing time: ${(endIncParse - startIncParse).toFixed(2)} ms`);

    // Verify tree is valid
    const newResults = await calculateComplexity(newTree, 'typescript');
    console.log(`Methods processed after edit: ${newResults.length}`);
}

runBenchmark();
