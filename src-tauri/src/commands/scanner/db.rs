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

        CREATE TABLE IF NOT EXISTS local_collection_items (
            collection_id TEXT NOT NULL,
            game_id       TEXT NOT NULL,
            added_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (collection_id, game_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_games_source ON games(source);
        CREATE INDEX IF NOT EXISTS idx_games_title_normalized ON games(title COLLATE NOCASE);

        INSERT OR IGNORE INTO scan_config (id, scan_paths, exclude_launchers)
        VALUES (1, '[\"C:\\\\Program Files\",\"C:\\\\Program Files (x86)\"]', '[\"steam\",\"epic\",\"ubisoft\",\"gog\",\"ea\"]');
    ").map_err(|e| format!("Migration failed: {}", e))?;
    Ok(())
}
