import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class GitService {
    private repoRoots = new Map<string, string>();

    /**
     * Retrieves the content of the file at HEAD for the given file path.
     * Returns null if the file is not tracked or git fails.
     */
    public async getGitHeadContent(filePath: string): Promise<Buffer | null> {
        if (!fs.existsSync(filePath)) return null;

        const fileDir = path.dirname(filePath);
        const repoRoot = await this.getRepoRoot(fileDir);

        if (!repoRoot) return null;

        try {
            // Get path relative to the REPO ROOT, not the workspace
            const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

            // Check if file is tracked
            // ls-files output is ASCII/UTF-8 usually, so we can check it
            const isTrackedBuffer = await this.execGit(['ls-files', '--error-unmatch', relativePath], repoRoot);
            if (!isTrackedBuffer) return null;

            // Fetch content from HEAD
            // Note: 'git show HEAD:path/to/file' works from the repo root
            const content = await this.execGit(['show', `HEAD:${relativePath}`], repoRoot);
            return content;
        } catch (error) {
            return null;
        }
    }

    /**
     * Filters a list of files, returning only those that are NOT ignored by git.
     * Uses 'git check-ignore' to verify.
     */
    public async filterIgnored(filePaths: string[]): Promise<string[]> {
        if (filePaths.length === 0) return [];

        // Group files by their repo root
        const filesByRoot = new Map<string, string[]>();
        const validFiles: string[] = [];
        const filesNotInGit: string[] = [];

        // Optimization: Cache directory -> root lookups locally for this batch
        const dirRoots = new Map<string, string | null>();

        for (const filePath of filePaths) {
            const dir = path.dirname(filePath);
            let root: string | null = null;
            if (dirRoots.has(dir)) {
                root = dirRoots.get(dir)!;
            } else {
                root = await this.getRepoRoot(dir);
                dirRoots.set(dir, root);
            }

            if (root) {
                let list = filesByRoot.get(root);
                if (!list) {
                    list = [];
                    filesByRoot.set(root, list);
                }
                list.push(filePath);
            } else {
                // Not in a git repo, so not ignored by git
                filesNotInGit.push(filePath);
            }
        }

        // Add files not in git directly to result
        validFiles.push(...filesNotInGit);

        // Check ignored status for each repo
        for (const [root, files] of filesByRoot) {
            // Normalize to forward slashes for git
            const relativePaths = files.map(f => path.relative(root, f).replace(/\\/g, '/'));

            // Use -z for null-terminated input/output to handle spaces/special chars safely
            const input = relativePaths.join('\0');

            const ignoredSet = new Set<string>();
            try {
                // git check-ignore -z --stdin
                // Outputs paths that ARE ignored, null-terminated
                const outputBuffer = await this.execGit(['check-ignore', '-z', '--stdin'], root, input);

                if (outputBuffer) {
                    let start = 0;
                    for (let i = 0; i < outputBuffer.length; i++) {
                        if (outputBuffer[i] === 0) { // \0
                            const pathStr = outputBuffer.subarray(start, i).toString('utf8');
                            ignoredSet.add(pathStr);
                            start = i + 1;
                        }
                    }
                    // Handle potential last segment if no trailing \0 (though git -z usually adds it)
                    if (start < outputBuffer.length) {
                        const pathStr = outputBuffer.subarray(start).toString('utf8');
                        ignoredSet.add(pathStr);
                    }
                }
            } catch (e) {
                console.error("Git check-ignore failed", e);
                // If failed, assume not ignored? Or fail safe?
                // Usually failure here means git error, so maybe we shouldn't filter.
            }

            // If a file is NOT in the ignored set, it is valid
            for (let i = 0; i < files.length; i++) {
                const rel = relativePaths[i];
                if (!ignoredSet.has(rel)) {
                    validFiles.push(files[i]);
                }
            }
        }

        return validFiles;
    }

    private async getRepoRoot(dir: string): Promise<string | null> {
        // Cache repo roots to avoid repeated calls
        if (this.repoRoots.has(dir)) return this.repoRoots.get(dir)!;

        try {
            const rootBuffer = await this.execGit(['rev-parse', '--show-toplevel'], dir);
            if (rootBuffer) {
                const root = rootBuffer.toString().trim();
                if (root) {
                    this.repoRoots.set(dir, root);
                    return root;
                }
            }
        } catch (e) {
            // Not a git repo
        }
        return null;
    }

    private execGit(args: string[], cwd: string, input?: string): Promise<Buffer | null> {
        return new Promise((resolve, reject) => {
            // Use spawn for safety against shell injection
            const child = cp.spawn('git', args, { cwd });

            const chunks: Buffer[] = [];
            let stderr = '';

            child.stdout.on('data', (data) => {
                chunks.push(Buffer.from(data));
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Write input to stdin if provided
            if (input !== undefined) {
                child.stdin.write(input);
                child.stdin.end();
            }

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    // check-ignore returns 1 if none of the provided paths are ignored
                    // This is NOT an error for us, it just means empty output (usually)
                    // But wait, if check-ignore returns 1, stdout might be empty.
                    // If we treat it as error (resolve(null)), we assume NO files are ignored.
                    // Which is correct!
                    // But if it's a real error (code 128), stderr will have info.

                    if (args[0] === 'check-ignore' && code === 1) {
                        // Exit code 1 means "none of the provided paths are ignored"
                        resolve(Buffer.alloc(0));
                    } else {
                        // Other errors
                        resolve(null);
                    }
                }
            });

            child.on('error', (err) => {
                resolve(null);
            });
        });
    }
}
