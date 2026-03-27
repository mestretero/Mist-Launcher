// src-tauri/src/commands/scanner/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub title: String,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub genres: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExeOption {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedGame {
    pub exe_path: String,
    pub suggested_title: String,
    pub install_path: String,
    pub detected_launcher: Option<String>,
    pub available_exes: Vec<ExeOption>,
    /// 0-100 confidence that this is actually a game
    pub confidence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub exe_path: String,
    pub install_path: Option<String>,
    pub source: String,
    pub launcher: Option<String>,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub genres: Option<Vec<String>>,
    pub added_at: String,
    pub last_played: Option<String>,
    pub play_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub scan_paths: Vec<String>,
    pub exclude_launchers: Vec<String>,
    pub last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriveInfo {
    pub letter: String,       // "C:", "D:", etc.
    pub label: String,        // Volume label or "Yerel Disk"
    pub total_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub scanned_dirs: u32,
    pub total_dirs: u32,
    pub found_games: u32,
}
