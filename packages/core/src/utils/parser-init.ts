import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';

export interface ParserInitOptions {
    wasmDirectory: string;
}

let csharpParser: Parser | undefined;
let typescriptParser: Parser | undefined;
let tsxParser: Parser | undefined;
let parserInitialized = false;
let initPromise: Promise<void> | undefined;

export interface Parsers {
    csharp: Parser;
    typescript: Parser;
    tsx: Parser;
}

export async function initParsers(options: ParserInitOptions): Promise<Parsers> {
    if (initPromise) {
        await initPromise;
        return {
            csharp: csharpParser!,
            typescript: typescriptParser!,
            tsx: tsxParser!
        };
    }

    initPromise = (async () => {
        try {
            const treeSitterWasmPath = path.resolve(options.wasmDirectory, 'tree-sitter.wasm');

            if (!fs.existsSync(treeSitterWasmPath)) {
                throw new Error(`tree-sitter.wasm not found at ${treeSitterWasmPath}`);
            }
            const wasmBuffer = fs.readFileSync(treeSitterWasmPath);

            await Parser.init({
                wasmBinary: wasmBuffer
            });

            // Load C#
            csharpParser = new Parser();
            const csharpWasmPath = path.resolve(options.wasmDirectory, 'tree-sitter-c_sharp.wasm');
            const csharpLang = await Language.load(csharpWasmPath);
            csharpParser.setLanguage(csharpLang);

            // Load TypeScript
            typescriptParser = new Parser();
            const typescriptWasmPath = path.resolve(options.wasmDirectory, 'tree-sitter-typescript.wasm');
            const typescriptLang = await Language.load(typescriptWasmPath);
            typescriptParser.setLanguage(typescriptLang);

            // Load TSX
            tsxParser = new Parser();
            const tsxWasmPath = path.resolve(options.wasmDirectory, 'tree-sitter-tsx.wasm');
            const tsxLang = await Language.load(tsxWasmPath);
            tsxParser.setLanguage(tsxLang);

            parserInitialized = true;
        } catch (e) {
            console.error(`Failed to initialize parser: ${e}`);
            throw e;
        }
    })();

    await initPromise;
    return {
        csharp: csharpParser!,
        typescript: typescriptParser!,
        tsx: tsxParser!
    };
}
