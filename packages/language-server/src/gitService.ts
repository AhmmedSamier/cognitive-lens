import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
      const isTrackedBuffer = await this.execGit(
        ['ls-files', '--error-unmatch', relativePath],
        repoRoot,
      );
      if (!isTrackedBuffer) return null;

      // Fetch content from HEAD
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

    const validFiles: string[] = [];
    const filesNotInGit: string[] = [];
    const filesByRoot = new Map<string, string[]>();

    let lastDir = '';
    let lastRoot: string | null = null;

    for (const filePath of filePaths) {
      const dir = path.dirname(filePath);
      let root: string | null = null;

      if (dir === lastDir) {
        root = lastRoot;
      } else {
        root = await this.getRepoRoot(dir);
        lastDir = dir;
        lastRoot = root;
      }

      if (root) {
        let list = filesByRoot.get(root);
        if (!list) {
          list = [];
          filesByRoot.set(root, list);
        }
        list.push(filePath);
      } else {
        filesNotInGit.push(filePath);
      }
    }

    validFiles.push(...filesNotInGit);

    for (const [root, files] of filesByRoot) {
      const relativePaths = files.map((f) => path.relative(root, f).split(path.sep).join('/'));
      const input = relativePaths.join('\0');

      const ignoredSet = new Set<string>();
      try {
        const outputBuffer = await this.execGit(['check-ignore', '-z', '--stdin'], root, input);

        if (outputBuffer) {
          let start = 0;
          for (let i = 0; i < outputBuffer.length; i++) {
            if (outputBuffer[i] === 0) {
              // \0
              const pathStr = outputBuffer.subarray(start, i).toString('utf8');
              ignoredSet.add(pathStr);
              start = i + 1;
            }
          }
          if (start < outputBuffer.length) {
            const pathStr = outputBuffer.subarray(start).toString('utf8');
            ignoredSet.add(pathStr);
          }
        }
      } catch (e) {
        console.error('Git check-ignore failed', e);
      }

      for (let i = 0; i < files.length; i++) {
        if (!ignoredSet.has(relativePaths[i])) {
          validFiles.push(files[i]);
        }
      }
    }

    return validFiles;
  }

  private async getRepoRoot(dir: string): Promise<string | null> {
    const normalizedDir = path.normalize(dir).toLowerCase();

    if (this.repoRoots.has(normalizedDir)) return this.repoRoots.get(normalizedDir)!;

    for (const [cachedDir, root] of this.repoRoots.entries()) {
      if (normalizedDir.startsWith(cachedDir + path.sep) || normalizedDir === cachedDir) {
        return root;
      }
    }

    try {
      const rootBuffer = await this.execGit(['rev-parse', '--show-toplevel'], dir);
      if (rootBuffer) {
        const root = path.normalize(rootBuffer.toString().trim());
        if (root) {
          this.repoRoots.set(root.toLowerCase(), root);
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
      const child = cp.spawn('git', args, { cwd });
      const chunks: Buffer[] = [];

      child.stdout.on('data', (data) => {
        chunks.push(Buffer.from(data));
      });

      if (input !== undefined) {
        child.stdin.write(input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          if (args[0] === 'check-ignore' && code === 1) {
            resolve(Buffer.alloc(0));
          } else {
            resolve(null);
          }
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }
}
