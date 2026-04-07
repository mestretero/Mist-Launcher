use super::db::Db;
use super::models::GameMetadata;
use tauri::State;

/// Backend API base — falls back to production if env var missing.
/// Matches the logic in src/lib/api.ts (dev = localhost:3001, prod = api.mistlauncher.com).
fn api_base() -> String {
    std::env::var("MIST_API_URL").unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            "http://localhost:3001".to_string()
        } else {
            "https://api.mistlauncher.com".to_string()
        }
    })
}

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

/// Fetch metadata via backend proxy (IGDB credentials live server-side).
/// Server endpoint: GET /games/metadata-lookup?title=...
async fn fetch_from_backend(title: &str) -> Option<GameMetadata> {
    let url = format!(
        "{}/games/metadata-lookup?title={}",
        api_base(),
        urlencoding::encode(title)
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .ok()?;

    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        eprintln!("[metadata] backend returned {}", resp.status());
        return None;
    }

    let text = resp.text().await.ok()?;
    let body: serde_json::Value = serde_json::from_str(&text).ok()?;
    let data = body.get("data")?;
    if data.is_null() { return None; }

    serde_json::from_value::<GameMetadata>(data.clone()).ok()
}

#[tauri::command]
pub async fn fetch_metadata(
    db: State<'_, Db>,
    game_title: String,
) -> Result<Option<GameMetadata>, String> {
    let normalized = normalize_title(&game_title);

    if let Some(cached) = check_cache(&db, &normalized) {
        return Ok(Some(cached));
    }

    // Rate limit
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    let metadata = fetch_from_backend(&game_title).await;

    if let Some(ref m) = metadata {
        write_cache(&db, &normalized, m);
    }

    Ok(metadata)
}
