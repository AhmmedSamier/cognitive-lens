use std::env;
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
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let current_dir = env::current_dir().map_err(|e| e.to_string())?;
        let server_path = current_dir.join("server.js");

        if !server_path.exists() {
             return Err(format!("server.js not found at {:?}", server_path));
        }

        let node_path = zed::node_binary_path()?;

        Ok(zed::Command {
            command: node_path,
            args: vec![
                server_path.to_string_lossy().to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(CognitiveComplexityExtension);
