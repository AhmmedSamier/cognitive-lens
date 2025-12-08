use zed_extension_api::{self as zed, Result};

struct CognitiveComplexityExtension {
}

impl zed::Extension for CognitiveComplexityExtension {
    fn new() -> Self {
        Self { }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node_path = worktree.which("node").ok_or_else(|| "node not found")?;

        // We assume the extension is installed and the server.js is at the root of the extension folder?
        // Or we need to resolve it relative to the extension installation.
        // `worktree` is the user's project.
        // We need the path to OUR extension.

        // Zed API: How to get extension path?
        // Usually, we can assume relative path if we bundle the server?
        // But `Command` executes in the worktree root or globally?
        // `node_path` is the executable.

        // Let's assume the user has `cognitive-complexity-ls` in their path OR we try to run the JS file.
        // Ideally, we want to run `node /path/to/extension/server.js`.
        // But getting `/path/to/extension` is tricky in Zed API currently unless we use `std::env::current_exe`?

        // Workaround: We will expect `node` to be available.
        // And we will try to execute the server.js relative to the extension bundle.
        // "When an extension is loaded, the current directory is the extension's directory?"
        // Not guaranteed.

        // However, many Zed extensions download the server.
        // Since we are building it, we can embed it or assume a path?
        // Wait, if I'm building a local extension for myself:
        // "To install a local extension: zed: extensions: install dev extension -> select folder".
        // The folder is where `extension.toml` is.
        // So the `server.js` will be there.

        // How do I get that path in Rust?
        // `std::env::current_dir()` might work during initialization?
        // But `language_server_command` is called later.

        // Let's try to pass the script path as an argument.
        // If we can't get the absolute path, we are stuck.

        // Check `zed_extension_api` docs or examples.
        // `zed::Extension::language_server_command`

        // If I cannot resolve the path, I will fallback to `cognitive-complexity-ls` command,
        // and instruct the user to ensure it's in PATH or alias it.
        // But I can also try to assume it's in a standard location.

        // Let's stick to "node" and "server.js" if we can find it.
        // But for now, let's just run "node" with the argument being the absolute path to `server.js` if we knew it.

        // Since I cannot reliably get the extension path in this minimal environment without downloading,
        // I will instruct the user to install the server globally or add it to path.
        // `npm install -g @cognitive-complexity/language-server` -> provides `cognitive-complexity-ls`.

        // BUT, I am building it here.
        // So I will create a `bin` script `cognitive-complexity-ls` in the root of the repo (or `dist`)
        // and ask the user to add it to PATH.

        // Better: The Zed extension will look for `cognitive-complexity-ls` in PATH.

        let path = worktree.which("cognitive-complexity-ls").ok_or_else(|| "cognitive-complexity-ls not found in PATH. Please install it globally or add it to your PATH.")?;

        Ok(zed::Command {
            command: path,
            args: vec![],
            env: Default::default(),
        })
    }
}

zed::register_extension!(CognitiveComplexityExtension);
