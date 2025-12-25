import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class GitService {
    private repoRoots = new Map<string, string>();

    /**
     * Retrieves the content of the file at HEAD for the given file path.
     * Returns null if the file is not tracked or git fails.
     */
    public async getGitHeadContent(filePath: string): Promise<string | null> {
        if (!fs.existsSync(filePath)) return null;

        const fileDir = path.dirname(filePath);
        const repoRoot = await this.getRepoRoot(fileDir);

        if (!repoRoot) return null;

        try {
            // Get path relative to the REPO ROOT, not the workspace
            const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

            // Check if file is tracked
            const isTracked = await this.execGit(['ls-files', '--error-unmatch', relativePath], repoRoot);
            if (!isTracked) return null;

            // Fetch content from HEAD
            // Note: 'git show HEAD:path/to/file' works from the repo root
            const content = await this.execGit(['show', `HEAD:${relativePath}`], repoRoot);
            return content;
        } catch (error) {
            return null;
        }
    }

    private async getRepoRoot(dir: string): Promise<string | null> {
        // Cache repo roots to avoid repeated calls
        if (this.repoRoots.has(dir)) return this.repoRoots.get(dir)!;

        try {
            const root = (await this.execGit(['rev-parse', '--show-toplevel'], dir))?.trim();
            if (root) {
                this.repoRoots.set(dir, root);
                return root;
            }
        } catch (e) {
            // Not a git repo
        }
        return null;
    }

    private execGit(args: string[], cwd: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            // Use spawn for safety against shell injection
            const child = cp.spawn('git', args, { cwd });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    // git ls-files returns 1 if not found, which is expected
                    // reject(new Error(stderr));
                    resolve(null);
                }
            });

            child.on('error', (err) => {
                resolve(null);
            });
        });
    }
}
