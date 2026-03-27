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
    let text = resp.text().await.ok()?;
    let body: serde_json::Value = serde_json::from_str(&text).ok()?;
    let game = body["results"].as_array()?.first()?.clone();

    Some(GameMetadata {
        title: game["name"].as_str()?.to_string(),
        cover_url: game["background_image"].as_str().map(|s: &str| s.to_string()),
        description: None,
        genres: Some(
            game["genres"].as_array()
                .map(|arr: &Vec<serde_json::Value>| arr.iter().filter_map(|g| g["name"].as_str().map(|s: &str| s.to_string())).collect())
                .unwrap_or_default()
        ),
    })
}

// IGDB fallback — requires Twitch OAuth, stubbed for Phase 1
async fn fetch_from_igdb(_title: &str) -> Option<GameMetadata> {
    None
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

    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    let metadata = match fetch_from_rawg(&game_title).await {
        Some(m) => Some(m),
        None => fetch_from_igdb(&game_title).await,
    };

    if let Some(ref m) = metadata {
        write_cache(&db, &normalized, m);
    }

    Ok(metadata)
}
