use std::env;
use std::fs;
use zed_extension_api::{self as zed, Result};

const SERVER_PATH: &str = "server.js";
const PACKAGE_NAME: &str = "cognitive-lens-ls";

struct CognitiveComplexityExtension {
}

impl zed::Extension for CognitiveComplexityExtension {
    fn new() -> Self {
        Self { }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node_path = zed::node_binary_path()?;

        // 1. Check for local server (Bundled or Dev mode)
        // If the server.js is present in the current directory (which is the extension's root), use it.
        // This covers the case where the user cloned the repo and built it locally (dev extension).
        let current_dir = env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let local_server_path = current_dir.join(SERVER_PATH);

        if local_server_path.exists() {
             return Ok(zed::Command {
                command: node_path,
                args: vec![
                    local_server_path.to_string_lossy().to_string(),
                    "--stdio".to_string(),
                ],
                env: Default::default(),
            });
        }

        // 2. Download from GitHub Releases or use cached version (Distribution mode)
        let _installation_status = zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate
        );

        // Try to fetch latest release. If it fails (e.g. offline), we will try to find a local cache.
        let release_result = zed::latest_github_release(
            "AhmmedSamier/cognitive-lens",
            zed::GithubReleaseOptions {
                require_assets: true,
                pre_release: false,
            },
        );

        let version_dir = match release_result {
            Ok(release) => {
                let asset_name = format!("{}-{}.zip", PACKAGE_NAME, release.version);
                let asset = release
                    .assets
                    .iter()
                    .find(|asset| asset.name == asset_name)
                    .ok_or_else(|| format!("no asset named {} found in release {}", asset_name, release.version))?;

                let version_dir = format!("{}-{}", PACKAGE_NAME, release.version);

                // Check if this version is already downloaded
                if !fs::metadata(&version_dir).is_ok() {
                     zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::Downloading,
                    );

                    zed::download_file(
                        &asset.download_url,
                        &version_dir,
                        zed::DownloadedFileType::Zip,
                    ).map_err(|e| format!("failed to download server: {}", e))?;

                    let entries = fs::read_dir(&version_dir)
                        .map_err(|e| format!("failed to list downloaded files: {}", e))?;
                    for entry in entries {
                        let entry = entry.map_err(|e| format!("failed to read entry: {}", e))?;
                        let path = entry.path();
                        // Ensure executable permissions if needed?
                        // server.js is just read by node, but if there were binaries, we might need zed::make_file_executable
                        if path.extension().map_or(false, |ext| ext == "wasm") {
                             // Just ensuring they exist.
                        }
                    }
                }
                version_dir
            }
            Err(e) => {
                // If fetching release fails, look for existing directories
                let entries = fs::read_dir(&current_dir)
                    .map_err(|err| format!("failed to read directory: {}. Original error: {}", err, e))?;

                let mut found_versions = Vec::new();

                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                                if file_name.starts_with(PACKAGE_NAME) && file_name.starts_with("cognitive-lens-ls-") {
                                    found_versions.push(file_name.to_string());
                                }
                            }
                        }
                    }
                }

                if found_versions.is_empty() {
                    return Err(format!("failed to fetch latest release and no local version found: {}", e).into());
                }

                // Pick the last one (alphabetically, which is roughly correct for versions if they are simple)
                found_versions.sort();
                found_versions.pop().unwrap()
            }
        };

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );

        let server_script_path = current_dir.join(&version_dir).join(SERVER_PATH);

        Ok(zed::Command {
            command: node_path,
            args: vec![
                server_script_path.to_string_lossy().to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(CognitiveComplexityExtension);
