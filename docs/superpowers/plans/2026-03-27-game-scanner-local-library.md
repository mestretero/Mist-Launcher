# Game Scanner & Local Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local game scanning, manual .exe addition, and unified library merging to Stealike — transforming it from a store-only app into a hybrid gaming platform.

**Architecture:** Tauri Rust backend handles all local operations (disk scan, registry read, SQLite, exe launch). Fastify server stays for social/store. Frontend merges both sources into one library.

**Tech Stack:** Rust (rusqlite, winreg, walkdir, reqwest), TypeScript/React, Tauri 2, Zustand

**Spec:** `docs/superpowers/specs/2026-03-27-game-scanner-hybrid-platform-design.md`

---

## Chunk 1: Rust Foundation — Dependencies, Database, Data Structures

### Task 1: Add New Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add crates to Cargo.toml**

Add these dependencies under `[dependencies]`:

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
winreg = "0.52"
walkdir = "2"
dotenvy = "0.15"
```

- [ ] **Step 2: Add tauri-plugin-dialog**

```toml
tauri-plugin-dialog = "2"
urlencoding = "2"
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 3: Install JS-side dialog plugin**

Run: `npm install @tauri-apps/plugin-dialog`

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors (warnings OK)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml package.json package-lock.json
git commit -m "feat: add rusqlite, winreg, walkdir, dotenvy, dialog plugin deps"
```

---

### Task 2: Create Data Structures Module

**Files:**
- Create: `src-tauri/src/commands/scanner/mod.rs`
- Create: `src-tauri/src/commands/scanner/models.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create scanner module directory**

```bash
mkdir -p src-tauri/src/commands/scanner
```

- [ ] **Step 2: Write models.rs with all data structures**

```rust
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
pub struct ScannedGame {
    pub exe_path: String,
    pub suggested_title: String,
    pub install_path: String,
    pub detected_launcher: Option<String>,
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
pub struct ScanProgress {
    pub scanned_dirs: u32,
    pub total_dirs: u32,
    pub found_games: u32,
}
```

- [ ] **Step 3: Write scanner/mod.rs**

```rust
// src-tauri/src/commands/scanner/mod.rs
pub mod models;
pub mod db;
pub mod scan;
pub mod metadata;
pub mod library;
```

- [ ] **Step 4: Register scanner module in commands/mod.rs**

Add `pub mod scanner;` to `src-tauri/src/commands/mod.rs`:

```rust
pub mod download;
pub mod launcher;
pub mod auth;
pub mod files;
pub mod scanner;
```

- [ ] **Step 5: Verify it compiles (will have warnings about missing modules — OK for now)**

Run: `cd src-tauri && cargo check`
Expected: Errors for missing db/scan/metadata/library modules — we'll create them next.

Actually, comment out the missing modules in scanner/mod.rs for now:

```rust
pub mod models;
// pub mod db;
// pub mod scan;
// pub mod metadata;
// pub mod library;
```

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/scanner/ src-tauri/src/commands/mod.rs
git commit -m "feat: add scanner data structures (Game, ScannedGame, ScanConfig, etc.)"
```

---

### Task 3: SQLite Database Module

**Files:**
- Create: `src-tauri/src/commands/scanner/db.rs`
- Modify: `src-tauri/src/commands/scanner/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write db.rs — init + migrations**

```rust
// src-tauri/src/commands/scanner/db.rs
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type Db = Arc<Mutex<Connection>>;

pub fn init_db(app_data_dir: &std::path::Path) -> Result<Db, String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    let db_path = app_data_dir.join("stealike.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    run_migrations(&conn)?;
    Ok(Arc::new(Mutex::new(conn)))
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS games (
            id            TEXT PRIMARY KEY,
            title         TEXT NOT NULL,
            exe_path      TEXT NOT NULL UNIQUE,
            install_path  TEXT,
            source        TEXT NOT NULL,
            launcher      TEXT,
            cover_url     TEXT,
            description   TEXT,
            genres        TEXT,
            added_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_played   DATETIME,
            play_time     INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS scan_config (
            id                INTEGER PRIMARY KEY DEFAULT 1,
            scan_paths        TEXT NOT NULL,
            exclude_launchers TEXT NOT NULL,
            last_scan_at      DATETIME
        );

        CREATE TABLE IF NOT EXISTS metadata_cache (
            normalized_title  TEXT PRIMARY KEY,
            raw_response      TEXT NOT NULL,
            fetched_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_games_source ON games(source);
        CREATE INDEX IF NOT EXISTS idx_games_title_normalized ON games(title COLLATE NOCASE);

        INSERT OR IGNORE INTO scan_config (id, scan_paths, exclude_launchers)
        VALUES (1, '[\"C:\\\\Program Files\",\"C:\\\\Program Files (x86)\"]', '[\"steam\",\"epic\",\"ubisoft\",\"gog\",\"ea\"]');
    ").map_err(|e| format!("Migration failed: {}", e))?;
    Ok(())
}
```

- [ ] **Step 2: Uncomment db module in scanner/mod.rs**

```rust
pub mod models;
pub mod db;
// pub mod scan;
// pub mod metadata;
// pub mod library;
```

- [ ] **Step 3: Wire DB init into lib.rs**

Update `src-tauri/src/lib.rs`:

```rust
mod commands;

use commands::scanner::db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir");
            let database = db::init_db(&app_data_dir)
                .expect("Failed to initialize database");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::download::download_game,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::cancel_download,
            commands::launcher::launch_game,
            commands::launcher::stop_game,
            commands::files::get_disk_space,
            commands::files::verify_game_files,
            commands::files::uninstall_game,
            commands::auth::store_token,
            commands::auth::get_token,
            commands::auth::delete_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Update capabilities for dialog plugin**

Add to `src-tauri/capabilities/default.json` permissions array:

```json
"dialog:default",
"dialog:allow-open"
```

- [ ] **Step 5: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/scanner/db.rs src-tauri/src/commands/scanner/mod.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add SQLite database init with migrations and dialog plugin"
```

---

## Chunk 2: Scanner Engine — Registry, Disk Scan, Launcher Detection

### Task 4: Game Scanner (Registry + Filesystem)

**Files:**
- Create: `src-tauri/src/commands/scanner/scan.rs`
- Modify: `src-tauri/src/commands/scanner/mod.rs`

- [ ] **Step 1: Write scan.rs**

```rust
// src-tauri/src/commands/scanner/scan.rs
use super::models::{ScannedGame, ScanProgress};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

/// Known launcher path patterns for detection
const LAUNCHER_PATTERNS: &[(&str, &str)] = &[
    ("steam", "steamapps"),
    ("epic", "Epic Games"),
    ("ubisoft", "Ubisoft Game Launcher"),
    ("gog", "GOG Galaxy"),
    ("ea", "Origin Games"),
    ("ea", "EA Games"),
];

/// Suffixes to strip from exe names when extracting titles
const STRIP_SUFFIXES: &[&str] = &[
    "Launcher", "Setup", "Installer", "Uninstall",
    "x64", "x86", "Win64", "Win32", "DX11", "DX12",
    "Shipping", "Binaries", "Bin",
];

pub fn exe_to_title(exe_name: &str) -> String {
    let name = exe_name.trim_end_matches(".exe").trim_end_matches(".EXE");

    // Split CamelCase and numbers
    let mut result = String::new();
    let mut prev_lower = false;
    for ch in name.chars() {
        if ch == '_' || ch == '-' || ch == '.' {
            result.push(' ');
            prev_lower = false;
        } else if ch.is_uppercase() && prev_lower {
            result.push(' ');
            result.push(ch);
            prev_lower = false;
        } else if ch.is_ascii_digit() && prev_lower {
            result.push(' ');
            result.push(ch);
            prev_lower = false;
        } else {
            result.push(ch);
            prev_lower = ch.is_lowercase();
        }
    }

    // Strip known suffixes
    let mut title = result.trim().to_string();
    for suffix in STRIP_SUFFIXES {
        if title.ends_with(suffix) {
            title = title[..title.len() - suffix.len()].trim().to_string();
        }
    }

    title
}

fn detect_launcher(path: &Path) -> Option<String> {
    let path_str = path.to_string_lossy().to_lowercase();
    for (launcher, pattern) in LAUNCHER_PATTERNS {
        if path_str.contains(&pattern.to_lowercase()) {
            return Some(launcher.to_string());
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn scan_registry() -> Vec<(String, PathBuf)> {
    let mut results = Vec::new();
    let keys = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (hive, path) in keys {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(path, KEY_READ) {
            for name in key.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = key.open_subkey_with_flags(&name, KEY_READ) {
                    let display_name: Result<String, _> = subkey.get_value("DisplayName");
                    let install_loc: Result<String, _> = subkey.get_value("InstallLocation");
                    if let (Ok(name), Ok(loc)) = (display_name, install_loc) {
                        if !loc.is_empty() {
                            results.push((name, PathBuf::from(loc)));
                        }
                    }
                }
            }
        }
    }
    results
}

#[cfg(not(target_os = "windows"))]
fn scan_registry() -> Vec<(String, PathBuf)> {
    Vec::new()
}

fn scan_directory(dir: &Path, max_depth: usize) -> Vec<PathBuf> {
    WalkDir::new(dir)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension()
                .map(|ext| ext.eq_ignore_ascii_case("exe"))
                .unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect()
}

#[tauri::command]
pub async fn scan_games(
    app: AppHandle,
    paths: Vec<String>,
    exclude_launchers: Vec<String>,
) -> Result<Vec<ScannedGame>, String> {
    let exclude_set: HashSet<String> = exclude_launchers.into_iter()
        .map(|l| l.to_lowercase())
        .collect();

    let mut all_games: Vec<ScannedGame> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    // Phase 1: Registry scan
    let registry_entries = scan_registry();
    for (name, install_path) in &registry_entries {
        let launcher = detect_launcher(install_path);
        if let Some(ref l) = launcher {
            if exclude_set.contains(l) {
                continue;
            }
        }
        // Find .exe in install path (depth 2)
        let exes = scan_directory(install_path, 2);
        for exe in exes {
            let exe_str = exe.to_string_lossy().to_string();
            if seen_paths.contains(&exe_str.to_lowercase()) {
                continue;
            }
            seen_paths.insert(exe_str.to_lowercase());
            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: name.clone(),
                install_path: install_path.to_string_lossy().to_string(),
                detected_launcher: launcher.clone(),
            });
        }
    }

    let _ = app.emit("scan-progress", ScanProgress {
        scanned_dirs: 1,
        total_dirs: paths.len() as u32 + 1,
        found_games: all_games.len() as u32,
    });

    // Phase 2: Filesystem scan of user-specified paths
    for (i, path_str) in paths.iter().enumerate() {
        let dir = Path::new(path_str);
        if !dir.exists() || !dir.is_dir() {
            continue;
        }

        let exes = scan_directory(dir, 4);
        for exe in exes {
            let exe_str = exe.to_string_lossy().to_string();
            if seen_paths.contains(&exe_str.to_lowercase()) {
                continue;
            }

            let launcher = detect_launcher(&exe);
            if let Some(ref l) = launcher {
                if exclude_set.contains(l) {
                    continue;
                }
            }

            let file_name = exe.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let parent = exe.parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            seen_paths.insert(exe_str.to_lowercase());
            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: exe_to_title(&file_name),
                install_path: parent,
                detected_launcher: launcher,
            });
        }

        let _ = app.emit("scan-progress", ScanProgress {
            scanned_dirs: (i + 2) as u32,
            total_dirs: paths.len() as u32 + 1,
            found_games: all_games.len() as u32,
        });
    }

    Ok(all_games)
}
```

- [ ] **Step 2: Uncomment scan module in scanner/mod.rs**

```rust
pub mod models;
pub mod db;
pub mod scan;
// pub mod metadata;
// pub mod library;
```

- [ ] **Step 3: Register scan_games command in lib.rs**

Add to `invoke_handler` in `src-tauri/src/lib.rs`:

```rust
commands::scanner::scan::scan_games,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/scanner/scan.rs src-tauri/src/commands/scanner/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add game scanner with registry + filesystem scanning and launcher detection"
```

---

### Task 5: Metadata Fetcher (RAWG API + Cache)

**Files:**
- Create: `src-tauri/src/commands/scanner/metadata.rs`
- Modify: `src-tauri/src/commands/scanner/mod.rs`

- [ ] **Step 1: Write metadata.rs**

```rust
// src-tauri/src/commands/scanner/metadata.rs
use super::db::Db;
use super::models::GameMetadata;
use tauri::State;

fn normalize_title(title: &str) -> String {
    title.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

fn check_cache(db: &Db, normalized: &str) -> Option<GameMetadata> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT raw_response FROM metadata_cache WHERE normalized_title = ?1"
    ).ok()?;
    let json: String = stmt.query_row([normalized], |row| row.get(0)).ok()?;
    serde_json::from_str(&json).ok()
}

fn write_cache(db: &Db, normalized: &str, metadata: &GameMetadata) {
    if let Ok(json) = serde_json::to_string(metadata) {
        let conn = db.lock().unwrap();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO metadata_cache (normalized_title, raw_response) VALUES (?1, ?2)",
            rusqlite::params![normalized, json],
        );
    }
}

async fn fetch_from_rawg(title: &str) -> Option<GameMetadata> {
    let api_key = option_env!("RAWG_API_KEY").unwrap_or("");
    if api_key.is_empty() {
        eprintln!("[metadata] RAWG_API_KEY not set — metadata fetch disabled. Set it at build time.");
        return None;
    }

    let url = format!(
        "https://api.rawg.io/api/games?key={}&search={}&page_size=1",
        api_key,
        urlencoding::encode(title)
    );

    let resp = reqwest::get(&url).await.ok()?;
    let body: serde_json::Value = resp.json().await.ok()?;
    let game = body["results"].as_array()?.first()?;

    Some(GameMetadata {
        title: game["name"].as_str()?.to_string(),
        cover_url: game["background_image"].as_str().map(|s| s.to_string()),
        description: None, // RAWG search doesn't return description
        genres: Some(
            game["genres"].as_array()
                .map(|arr| arr.iter().filter_map(|g| g["name"].as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default()
        ),
    })
}

// IGDB fallback — requires Twitch OAuth, stubbed for Phase 1
// Can be implemented later with client_id/client_secret
async fn fetch_from_igdb(_title: &str) -> Option<GameMetadata> {
    // TODO Phase 2: Implement IGDB API with Twitch OAuth
    None
}

#[tauri::command]
pub async fn fetch_metadata(
    db: State<'_, Db>,
    game_title: String,
) -> Result<Option<GameMetadata>, String> {
    let normalized = normalize_title(&game_title);

    // Check cache first
    if let Some(cached) = check_cache(&db, &normalized) {
        return Ok(Some(cached));
    }

    // Rate limit: simple delay between calls
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    // Fetch from RAWG, fallback to IGDB
    let metadata = match fetch_from_rawg(&game_title).await {
        Some(m) => Some(m),
        None => fetch_from_igdb(&game_title).await,
    };

    if let Some(ref m) = metadata {
        write_cache(&db, &normalized, m);
    }

    Ok(metadata)
}
```

- [ ] **Step 2: Uncomment metadata module in scanner/mod.rs**

```rust
pub mod models;
pub mod db;
pub mod scan;
pub mod metadata;
// pub mod library;
```

- [ ] **Step 3: Register fetch_metadata command in lib.rs**

Add to `invoke_handler`:
```rust
commands::scanner::metadata::fetch_metadata,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/scanner/metadata.rs src-tauri/src/commands/scanner/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add RAWG metadata fetcher with SQLite caching and IGDB stub"
```

---

## Chunk 3: Library CRUD + Launcher Play-Time Update

### Task 6: Library Management Commands

**Files:**
- Create: `src-tauri/src/commands/scanner/library.rs`
- Modify: `src-tauri/src/commands/scanner/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write library.rs**

```rust
// src-tauri/src/commands/scanner/library.rs
use super::db::Db;
use super::models::{Game, GameMetadata, ScanConfig};
use tauri::State;

#[tauri::command]
pub fn get_local_games(db: State<'_, Db>) -> Result<Vec<Game>, String> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, exe_path, install_path, source, launcher, cover_url, description, genres, added_at, last_played, play_time FROM games ORDER BY title COLLATE NOCASE"
    ).map_err(|e| e.to_string())?;

    let games = stmt.query_map([], |row| {
        let genres_json: Option<String> = row.get(8)?;
        Ok(Game {
            id: row.get(0)?,
            title: row.get(1)?,
            exe_path: row.get(2)?,
            install_path: row.get(3)?,
            source: row.get(4)?,
            launcher: row.get(5)?,
            cover_url: row.get(6)?,
            description: row.get(7)?,
            genres: genres_json.and_then(|j| serde_json::from_str(&j).ok()),
            added_at: row.get(9)?,
            last_played: row.get(10)?,
            play_time: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(games)
}

#[tauri::command]
pub fn add_manual_game(
    db: State<'_, Db>,
    exe_path: String,
    metadata: GameMetadata,
) -> Result<Game, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let genres_json = metadata.genres.as_ref().map(|g| serde_json::to_string(g).unwrap_or_default());
    let install_path = std::path::Path::new(&exe_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO games (id, title, exe_path, install_path, source, launcher, cover_url, description, genres) VALUES (?1, ?2, ?3, ?4, 'manual', 'none', ?5, ?6, ?7)",
        rusqlite::params![id, metadata.title, exe_path, install_path, metadata.cover_url, metadata.description, genres_json],
    ).map_err(|e| e.to_string())?;

    Ok(Game {
        id,
        title: metadata.title,
        exe_path,
        install_path,
        source: "manual".to_string(),
        launcher: Some("none".to_string()),
        cover_url: metadata.cover_url,
        description: metadata.description,
        genres: metadata.genres,
        added_at: chrono::Utc::now().to_rfc3339(),
        last_played: None,
        play_time: 0,
    })
}

#[tauri::command]
pub fn add_scanned_games(
    db: State<'_, Db>,
    games: Vec<super::models::ScannedGame>,
    metadata_map: std::collections::HashMap<String, GameMetadata>,
) -> Result<Vec<Game>, String> {
    let conn = db.lock().unwrap();
    let mut added = Vec::new();

    for scanned in games {
        let id = uuid::Uuid::new_v4().to_string();
        let meta = metadata_map.get(&scanned.exe_path);
        let title = meta.map(|m| m.title.clone()).unwrap_or(scanned.suggested_title);
        let cover_url = meta.and_then(|m| m.cover_url.clone());
        let description = meta.and_then(|m| m.description.clone());
        let genres = meta.and_then(|m| m.genres.clone());
        let genres_json = genres.as_ref().map(|g| serde_json::to_string(g).unwrap_or_default());

        conn.execute(
            "INSERT OR IGNORE INTO games (id, title, exe_path, install_path, source, launcher, cover_url, description, genres) VALUES (?1, ?2, ?3, ?4, 'scan', ?5, ?6, ?7, ?8)",
            rusqlite::params![id, title, scanned.exe_path, scanned.install_path, scanned.detected_launcher, cover_url, description, genres_json],
        ).map_err(|e| e.to_string())?;

        added.push(Game {
            id,
            title,
            exe_path: scanned.exe_path,
            install_path: Some(scanned.install_path),
            source: "scan".to_string(),
            launcher: scanned.detected_launcher,
            cover_url,
            description,
            genres,
            added_at: chrono::Utc::now().to_rfc3339(),
            last_played: None,
            play_time: 0,
        });
    }

    Ok(added)
}

#[tauri::command]
pub fn update_game(
    db: State<'_, Db>,
    game_id: String,
    metadata: GameMetadata,
) -> Result<Game, String> {
    let genres_json = metadata.genres.as_ref().map(|g| serde_json::to_string(g).unwrap_or_default());

    let conn = db.lock().unwrap();
    conn.execute(
        "UPDATE games SET title = ?1, cover_url = ?2, description = ?3, genres = ?4 WHERE id = ?5",
        rusqlite::params![metadata.title, metadata.cover_url, metadata.description, genres_json, game_id],
    ).map_err(|e| e.to_string())?;

    // Re-fetch updated game
    let mut stmt = conn.prepare(
        "SELECT id, title, exe_path, install_path, source, launcher, cover_url, description, genres, added_at, last_played, play_time FROM games WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    stmt.query_row([&game_id], |row| {
        let genres_json: Option<String> = row.get(8)?;
        Ok(Game {
            id: row.get(0)?,
            title: row.get(1)?,
            exe_path: row.get(2)?,
            install_path: row.get(3)?,
            source: row.get(4)?,
            launcher: row.get(5)?,
            cover_url: row.get(6)?,
            description: row.get(7)?,
            genres: genres_json.and_then(|j| serde_json::from_str(&j).ok()),
            added_at: row.get(9)?,
            last_played: row.get(10)?,
            play_time: row.get(11)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_game(db: State<'_, Db>, game_id: String) -> Result<(), String> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM games WHERE id = ?1", [&game_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_scan_config(db: State<'_, Db>) -> Result<ScanConfig, String> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT scan_paths, exclude_launchers, last_scan_at FROM scan_config WHERE id = 1"
    ).map_err(|e| e.to_string())?;

    stmt.query_row([], |row| {
        let paths_json: String = row.get(0)?;
        let launchers_json: String = row.get(1)?;
        Ok(ScanConfig {
            scan_paths: serde_json::from_str(&paths_json).unwrap_or_default(),
            exclude_launchers: serde_json::from_str(&launchers_json).unwrap_or_default(),
            last_scan_at: row.get(2)?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_scan_config(db: State<'_, Db>, config: ScanConfig) -> Result<(), String> {
    let paths_json = serde_json::to_string(&config.scan_paths).map_err(|e| e.to_string())?;
    let launchers_json = serde_json::to_string(&config.exclude_launchers).map_err(|e| e.to_string())?;

    let conn = db.lock().unwrap();
    conn.execute(
        "UPDATE scan_config SET scan_paths = ?1, exclude_launchers = ?2, last_scan_at = ?3 WHERE id = 1",
        rusqlite::params![paths_json, launchers_json, config.last_scan_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Uncomment library module in scanner/mod.rs**

```rust
pub mod models;
pub mod db;
pub mod scan;
pub mod metadata;
pub mod library;
```

- [ ] **Step 3: Register all library commands in lib.rs**

Add to `invoke_handler`:

```rust
commands::scanner::library::get_local_games,
commands::scanner::library::add_manual_game,
commands::scanner::library::add_scanned_games,
commands::scanner::library::update_game,
commands::scanner::library::delete_game,
commands::scanner::library::get_scan_config,
commands::scanner::library::update_scan_config,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/scanner/library.rs src-tauri/src/commands/scanner/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add local library CRUD commands (get, add, update, delete, scan config)"
```

---

### Task 7: Update Launcher to Write Play-Time to SQLite

**Files:**
- Modify: `src-tauri/src/commands/launcher.rs`

- [ ] **Step 1: Update launch_game to accept Db state and write play_time on exit**

```rust
// src-tauri/src/commands/launcher.rs
use std::process::Command;
use tauri::{AppHandle, Emitter, State};
use crate::commands::scanner::db::Db;

#[derive(Clone, serde::Serialize)]
struct GameStatus {
    game_id: String,
    status: String,
    play_time_secs: u64,
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    db: State<'_, Db>,
    game_id: String,
    exe_path: String,
) -> Result<u32, String> {
    let child = Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Failed to launch: {}", e))?;

    let pid = child.id();
    let app_clone = app.clone();
    let game_id_clone = game_id.clone();
    let db_clone = db.inner().clone();

    tokio::spawn(async move {
        let start = std::time::Instant::now();
        let _ = app_clone.emit("game-status", GameStatus {
            game_id: game_id_clone.clone(),
            status: "running".to_string(),
            play_time_secs: 0,
        });

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            let elapsed = start.elapsed().as_secs();

            #[cfg(target_os = "windows")]
            let running = {
                let output = Command::new("tasklist")
                    .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                    .output();
                output.map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string())).unwrap_or(false)
            };

            #[cfg(not(target_os = "windows"))]
            let running = {
                let output = Command::new("kill").args(["-0", &pid.to_string()]).output();
                output.map(|o| o.status.success()).unwrap_or(false)
            };

            if !running {
                // Write play_time to SQLite
                if let Ok(conn) = db_clone.lock() {
                    let _ = conn.execute(
                        "UPDATE games SET play_time = play_time + ?1, last_played = datetime('now') WHERE id = ?2",
                        rusqlite::params![elapsed as i64, game_id_clone],
                    );
                }

                let _ = app_clone.emit("game-status", GameStatus {
                    game_id: game_id_clone.clone(),
                    status: "stopped".to_string(),
                    play_time_secs: elapsed,
                });
                break;
            }
        }
    });

    Ok(pid)
}

#[tauri::command]
pub async fn stop_game(_game_id: String) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles OK

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/launcher.rs
git commit -m "feat: launcher writes play_time to SQLite on game exit"
```

---

## Chunk 4: Frontend — Scanner Page, Library Merge, Settings

### Task 8: Local Game Store (Zustand)

**Files:**
- Create: `src/stores/localGameStore.ts`

- [ ] **Step 1: Write localGameStore.ts**

```typescript
// src/stores/localGameStore.ts
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface LocalGame {
  id: string;
  title: string;
  exe_path: string;
  install_path: string | null;
  source: "scan" | "manual" | "store";
  launcher: string | null;
  cover_url: string | null;
  description: string | null;
  genres: string[] | null;
  added_at: string;
  last_played: string | null;
  play_time: number;
}

export interface ScannedGame {
  exe_path: string;
  suggested_title: string;
  install_path: string;
  detected_launcher: string | null;
}

export interface ScanConfig {
  scan_paths: string[];
  exclude_launchers: string[];
  last_scan_at: string | null;
}

export interface GameMetadata {
  title: string;
  cover_url: string | null;
  description: string | null;
  genres: string[] | null;
}

interface LocalGameState {
  games: LocalGame[];
  scanConfig: ScanConfig | null;
  loading: boolean;
  scanning: boolean;

  loadGames: () => Promise<void>;
  loadScanConfig: () => Promise<void>;
  updateScanConfig: (config: ScanConfig) => Promise<void>;
  scanGames: (paths: string[], excludeLaunchers: string[]) => Promise<ScannedGame[]>;
  addScannedGames: (games: ScannedGame[], metadataMap: Record<string, GameMetadata>) => Promise<void>;
  addManualGame: (exePath: string, metadata: GameMetadata) => Promise<void>;
  updateGame: (gameId: string, metadata: GameMetadata) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  fetchMetadata: (title: string) => Promise<GameMetadata | null>;
}

export const useLocalGameStore = create<LocalGameState>((set, get) => ({
  games: [],
  scanConfig: null,
  loading: false,
  scanning: false,

  loadGames: async () => {
    set({ loading: true });
    try {
      const games = await invoke<LocalGame[]>("get_local_games");
      set({ games });
    } finally {
      set({ loading: false });
    }
  },

  loadScanConfig: async () => {
    const config = await invoke<ScanConfig>("get_scan_config");
    set({ scanConfig: config });
  },

  updateScanConfig: async (config) => {
    await invoke("update_scan_config", { config });
    set({ scanConfig: config });
  },

  scanGames: async (paths, excludeLaunchers) => {
    set({ scanning: true });
    try {
      return await invoke<ScannedGame[]>("scan_games", { paths, excludeLaunchers });
    } finally {
      set({ scanning: false });
    }
  },

  addScannedGames: async (games, metadataMap) => {
    await invoke("add_scanned_games", { games, metadataMap });
    await get().loadGames();
  },

  addManualGame: async (exePath, metadata) => {
    await invoke("add_manual_game", { exePath, metadata });
    await get().loadGames();
  },

  updateGame: async (gameId, metadata) => {
    await invoke("update_game", { gameId, metadata });
    await get().loadGames();
  },

  deleteGame: async (gameId) => {
    await invoke("delete_game", { gameId });
    await get().loadGames();
  },

  fetchMetadata: async (title) => {
    return await invoke<GameMetadata | null>("fetch_metadata", { gameTitle: title });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/localGameStore.ts
git commit -m "feat: add Zustand store for local game library (scan, CRUD, metadata)"
```

---

### Task 9: Game Scanner Page

**Files:**
- Create: `src/pages/GameScannerPage.tsx`

- [ ] **Step 1: Write GameScannerPage.tsx**

This is a large component with multiple states (config → scanning → results → metadata). Write it with these sections:

1. **Config step** — show scan paths, launcher exclude checkboxes, "Start Scan" button
2. **Scanning step** — progress bar listening to `scan-progress` events
3. **Results step** — list of found games with checkboxes, "Add Selected" button
4. **Done step** — confirmation, link back to Library

The full implementation should use `useLocalGameStore` for all Tauri interactions and `listen` from `@tauri-apps/api/event` for scan progress.

```typescript
// src/pages/GameScannerPage.tsx
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useLocalGameStore, ScannedGame, GameMetadata } from "../stores/localGameStore";
import { useToastStore } from "../stores/toastStore";

type ScanStep = "config" | "scanning" | "results" | "done";

interface ScanProgress {
  scanned_dirs: number;
  total_dirs: number;
  found_games: number;
}

export default function GameScannerPage() {
  const store = useLocalGameStore();
  const toast = useToastStore();
  const [step, setStep] = useState<ScanStep>("config");
  const [progress, setProgress] = useState<ScanProgress>({ scanned_dirs: 0, total_dirs: 0, found_games: 0 });
  const [results, setResults] = useState<ScannedGame[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeLaunchers, setIncludeLaunchers] = useState(false);

  useEffect(() => {
    store.loadScanConfig();
  }, []);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleAddPath = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && store.scanConfig) {
      const newPaths = [...store.scanConfig.scan_paths, selected as string];
      await store.updateScanConfig({ ...store.scanConfig, scan_paths: newPaths });
    }
  };

  const handleRemovePath = async (path: string) => {
    if (store.scanConfig) {
      const newPaths = store.scanConfig.scan_paths.filter(p => p !== path);
      await store.updateScanConfig({ ...store.scanConfig, scan_paths: newPaths });
    }
  };

  const handleScan = async () => {
    if (!store.scanConfig) return;
    setStep("scanning");
    const excludeLaunchers = includeLaunchers ? [] : store.scanConfig.exclude_launchers;
    const found = await store.scanGames(store.scanConfig.scan_paths, excludeLaunchers);
    setResults(found);
    setSelected(new Set(found.map(g => g.exe_path)));
    setStep("results");
  };

  const toggleSelect = (exePath: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(exePath)) next.delete(exePath);
      else next.add(exePath);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const selectedGames = results.filter(g => selected.has(g.exe_path));
    // Fetch metadata for each
    const metadataMap: Record<string, GameMetadata> = {};
    for (const game of selectedGames) {
      const meta = await store.fetchMetadata(game.suggested_title);
      if (meta) {
        metadataMap[game.exe_path] = meta;
      }
    }
    await store.addScannedGames(selectedGames, metadataMap);
    toast.addToast("success", `${selectedGames.length} oyun eklendi!`);
    setStep("done");
  };

  if (!store.scanConfig) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-50 mb-6">Oyun Tarayıcı</h1>

      {step === "config" && (
        <div className="space-y-6">
          {/* Launcher checkbox */}
          <div className="bg-brand-800/50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLaunchers}
                onChange={(e) => setIncludeLaunchers(e.target.checked)}
                className="w-4 h-4 accent-yellow-400"
              />
              <span className="text-brand-200">Steam, Epic, Ubisoft vb. oyunlarını da dahil et</span>
            </label>
          </div>

          {/* Scan paths */}
          <div className="bg-brand-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-400 mb-3">Tarama Klasörleri</h3>
            <div className="space-y-2">
              {store.scanConfig.scan_paths.map((path) => (
                <div key={path} className="flex items-center justify-between bg-brand-900/50 rounded px-3 py-2">
                  <span className="text-brand-200 text-sm font-mono truncate">{path}</span>
                  <button onClick={() => handleRemovePath(path)} className="text-red-400 hover:text-red-300 text-sm ml-2">Kaldır</button>
                </div>
              ))}
            </div>
            <button onClick={handleAddPath} className="mt-3 px-4 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded text-sm">+ Klasör Ekle</button>
          </div>

          {/* Start scan button */}
          <button onClick={handleScan} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-brand-900 font-bold rounded-lg text-lg">
            Taramayı Başlat
          </button>
        </div>
      )}

      {step === "scanning" && (
        <div className="text-center space-y-4 py-12">
          <div className="animate-spin w-12 h-12 border-3 border-yellow-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-brand-200">Oyunlar taranıyor...</p>
          <div className="bg-brand-800 rounded-full h-2 max-w-md mx-auto overflow-hidden">
            <div
              className="bg-yellow-400 h-full transition-all duration-300"
              style={{ width: `${progress.total_dirs ? (progress.scanned_dirs / progress.total_dirs) * 100 : 0}%` }}
            />
          </div>
          <p className="text-brand-400 text-sm">{progress.found_games} oyun bulundu | {progress.scanned_dirs}/{progress.total_dirs} klasör tarandı</p>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-brand-200">{results.length} oyun bulundu — eklemek istediklerini seç</p>
            <button onClick={handleAddSelected} disabled={selected.size === 0} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-brand-900 font-bold rounded">
              {selected.size} Oyunu Ekle
            </button>
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {results.map((game) => (
              <label key={game.exe_path} className="flex items-center gap-3 bg-brand-800/50 hover:bg-brand-800 rounded px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(game.exe_path)}
                  onChange={() => toggleSelect(game.exe_path)}
                  className="w-4 h-4 accent-yellow-400"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-brand-100 font-medium truncate">{game.suggested_title}</p>
                  <p className="text-brand-400 text-xs font-mono truncate">{game.exe_path}</p>
                </div>
                {game.detected_launcher && (
                  <span className="text-xs bg-brand-700 text-brand-300 px-2 py-1 rounded capitalize">{game.detected_launcher}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-12 space-y-4">
          <div className="text-5xl">✓</div>
          <p className="text-brand-100 text-xl font-bold">Oyunlar Eklendi!</p>
          <p className="text-brand-400">Kütüphanene git ve oyunlarını gör</p>
          <button onClick={() => setStep("config")} className="px-6 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded">
            Tekrar Tara
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add scanner route in `src/App.tsx`**

Import and add the scanner page. The app uses a custom router with `navigate("page")` pattern.

Add import at top:
```tsx
import GameScannerPage from "./pages/GameScannerPage";
```

Add in the render section after the collections line:
```tsx
{page === "scanner" && <GameScannerPage onNavigate={navigate} />}
```

- [ ] **Step 3: Add navigation link in `src/components/Layout.tsx`**

Add a "Oyun Tara" button/link in the sidebar navigation that calls `onNavigate("scanner")`. Place it near the "Kütüphane" link.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GameScannerPage.tsx
git commit -m "feat: add GameScannerPage with config, scanning, results, and done steps"
```

---

### Task 10: Update LibraryPage to Merge Local + Store Games

**Files:**
- Modify: `src/pages/LibraryPage.tsx`

- [ ] **Step 1: Import localGameStore and merge games**

At the top of LibraryPage, add:

```typescript
import { useLocalGameStore, LocalGame } from "../stores/localGameStore";
import { open } from "@tauri-apps/plugin-dialog";
```

- [ ] **Step 2: Add merge logic**

In the component body, fetch local games alongside server games:

```typescript
const { games: localGames, loadGames: loadLocalGames } = useLocalGameStore();

useEffect(() => {
  loadLocalGames();
}, []);

// Merge logic: combine local + store games, dedup by normalized title
const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

const mergedGames = useMemo(() => {
  const storeMap = new Map(storeGames.map(g => [normalizeTitle(g.title), g]));
  const merged: Array<LocalGame & { storeGame?: typeof storeGames[0] }> = [];

  for (const local of localGames) {
    const storeMatch = storeMap.get(normalizeTitle(local.title));
    merged.push({ ...local, storeGame: storeMatch || undefined });
    if (storeMatch) storeMap.delete(normalizeTitle(local.title));
  }

  // Add remaining store-only games
  for (const store of storeMap.values()) {
    merged.push({
      id: store.id,
      title: store.title,
      exe_path: "",
      install_path: null,
      source: "store" as const,
      launcher: null,
      cover_url: store.coverImage || null,
      description: store.description || null,
      genres: null,
      added_at: "",
      last_played: null,
      play_time: 0,
      storeGame: store,
    });
  }

  return merged;
}, [localGames, storeGames]);
```

- [ ] **Step 3: Add source badges to game list items**

In the game list rendering, add a source badge:

```tsx
{game.source === "scan" && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Taranmış</span>}
{game.source === "manual" && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Manuel</span>}
{game.source === "store" && <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Mağaza</span>}
{game.storeGame && game.source !== "store" && <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">Yüklü + Mağaza</span>}
```

- [ ] **Step 4: Add "Oyun Tara" and "Oyun Ekle" buttons to Library header**

```tsx
<div className="flex gap-2">
  <Link to="/scanner" className="px-4 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded text-sm">Oyun Tara</Link>
  <button onClick={handleAddManualGame} className="px-4 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded text-sm">+ Oyun Ekle</button>
</div>
```

- [ ] **Step 5: Add manual game addition handler**

```typescript
const handleAddManualGame = async () => {
  const selected = await open({ filters: [{ name: "Executable", extensions: ["exe"] }] });
  if (!selected) return;
  const exePath = selected as string;
  const fileName = exePath.split("\\").pop() || exePath.split("/").pop() || "Unknown";
  const title = fileName.replace(/\.exe$/i, "").replace(/([A-Z])/g, " $1").trim();

  // Try to fetch metadata
  const meta = await useLocalGameStore.getState().fetchMetadata(title);
  await useLocalGameStore.getState().addManualGame(exePath, meta || { title, cover_url: null, description: null, genres: null });
  toast.addToast("success", `${meta?.title || title} eklendi!`);
};
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/LibraryPage.tsx
git commit -m "feat: merge local + store games in LibraryPage with source badges and manual add"
```

---

### Task 11: Add Scanner Settings to SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add a "Scanner" tab to the existing tabs**

Add "Scanner" as a 4th tab alongside Account, Payments, Downloads.

- [ ] **Step 2: Add Scanner tab content**

```tsx
{activeTab === "scanner" && (
  <div className="space-y-6">
    <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-400">Tarama Ayarları</h3>

    {/* Scan paths */}
    <div className="space-y-2">
      <label className="text-brand-300 text-sm">Tarama Klasörleri</label>
      {scanConfig?.scan_paths.map((path) => (
        <div key={path} className="flex items-center justify-between bg-brand-800/50 rounded px-3 py-2">
          <span className="text-brand-200 text-sm font-mono truncate">{path}</span>
          <button onClick={() => removeScanPath(path)} className="text-red-400 text-sm">Kaldır</button>
        </div>
      ))}
      <button onClick={addScanPath} className="px-4 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded text-sm">+ Klasör Ekle</button>
    </div>

    {/* Launcher filters */}
    <div className="space-y-2">
      <label className="text-brand-300 text-sm">Varsayılan Hariç Tutulan Launcher'lar</label>
      {["steam", "epic", "ubisoft", "gog", "ea"].map((launcher) => (
        <label key={launcher} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scanConfig?.exclude_launchers.includes(launcher) || false}
            onChange={() => toggleLauncherExclude(launcher)}
            className="w-4 h-4 accent-yellow-400"
          />
          <span className="text-brand-200 capitalize">{launcher}</span>
        </label>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add state and handlers for scanner settings**

```typescript
import { useLocalGameStore } from "../stores/localGameStore";
import { open } from "@tauri-apps/plugin-dialog";

// In component:
const { scanConfig, loadScanConfig, updateScanConfig } = useLocalGameStore();

useEffect(() => { loadScanConfig(); }, []);

const addScanPath = async () => {
  const dir = await open({ directory: true, multiple: false });
  if (dir && scanConfig) {
    await updateScanConfig({ ...scanConfig, scan_paths: [...scanConfig.scan_paths, dir as string] });
  }
};

const removeScanPath = async (path: string) => {
  if (scanConfig) {
    await updateScanConfig({ ...scanConfig, scan_paths: scanConfig.scan_paths.filter(p => p !== path) });
  }
};

const toggleLauncherExclude = async (launcher: string) => {
  if (!scanConfig) return;
  const current = scanConfig.exclude_launchers;
  const updated = current.includes(launcher)
    ? current.filter(l => l !== launcher)
    : [...current, launcher];
  await updateScanConfig({ ...scanConfig, exclude_launchers: updated });
};
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add Scanner settings tab with scan paths and launcher filter config"
```

---

### Task 12: Final Wiring — Verify Full Build

**Files:** None new

- [ ] **Step 1: Build Rust backend**

Run: `cd src-tauri && cargo build`
Expected: Compiles OK

- [ ] **Step 2: Build frontend**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run full Tauri dev**

Run: `npm run tauri dev`
Expected: App starts, Scanner page accessible, can trigger a scan

- [ ] **Step 4: Test scan flow manually**

1. Navigate to /scanner
2. Click "Taramayı Başlat"
3. See results
4. Select games and add
5. Check Library page shows merged games

- [ ] **Step 5: Final commit**

```bash
git add src-tauri/ src/pages/ src/stores/ src/components/Layout.tsx src/App.tsx
git commit -m "feat: complete game scanner and local library integration"
```
