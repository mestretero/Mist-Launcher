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

/// Add a local game to a server collection (stores link in local SQLite)
#[tauri::command]
pub fn add_local_game_to_collection(db: State<'_, Db>, collection_id: String, game_id: String) -> Result<(), String> {
    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO local_collection_items (collection_id, game_id) VALUES (?1, ?2)",
        rusqlite::params![collection_id, game_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a local game from a collection
#[tauri::command]
pub fn remove_local_game_from_collection(db: State<'_, Db>, collection_id: String, game_id: String) -> Result<(), String> {
    let conn = db.lock().unwrap();
    conn.execute(
        "DELETE FROM local_collection_items WHERE collection_id = ?1 AND game_id = ?2",
        rusqlite::params![collection_id, game_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get local game IDs for a collection
#[tauri::command]
pub fn get_local_collection_games(db: State<'_, Db>, collection_id: String) -> Result<Vec<String>, String> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT game_id FROM local_collection_items WHERE collection_id = ?1"
    ).map_err(|e| e.to_string())?;
    let ids = stmt.query_map([&collection_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

/// Get all collection IDs that contain a specific local game
#[tauri::command]
pub fn get_collections_for_local_game(db: State<'_, Db>, game_id: String) -> Result<Vec<String>, String> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT collection_id FROM local_collection_items WHERE game_id = ?1"
    ).map_err(|e| e.to_string())?;
    let ids = stmt.query_map([&game_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

/// Clear all metadata cache (forces re-fetch from IGDB)
#[tauri::command]
pub fn clear_metadata_cache(db: State<'_, Db>) -> Result<(), String> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM metadata_cache", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_game(db: State<'_, Db>, game_id: String) -> Result<(), String> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM games WHERE id = ?1", [&game_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// List exe files in a directory (non-recursive, top-level only)
#[tauri::command]
pub fn list_exe_files(dir_path: String) -> Result<Vec<String>, String> {
    let path = std::path::Path::new(&dir_path);
    if !path.is_dir() {
        return Err("Not a directory".to_string());
    }
    let mut exes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext.eq_ignore_ascii_case("exe") {
                        if let Some(s) = p.to_str() {
                            exes.push(s.to_string());
                        }
                    }
                }
            }
        }
    }
    exes.sort();
    Ok(exes)
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
