use super::db::Db;
use super::models::GameMetadata;
use tauri::State;
use std::sync::Mutex;

/// Cached IGDB access token (Twitch OAuth)
static IGDB_TOKEN: Mutex<Option<(String, std::time::Instant)>> = Mutex::new(None);

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

/// Get IGDB access token via Twitch OAuth (cached for ~60 days)
async fn get_igdb_token() -> Option<String> {
    // Check cached token
    {
        let lock = IGDB_TOKEN.lock().unwrap();
        if let Some((ref token, ref created)) = *lock {
            // Token valid for ~60 days, refresh after 30
            if created.elapsed().as_secs() < 30 * 24 * 3600 {
                return Some(token.clone());
            }
        }
    }

    let client_id = std::env::var("IGDB_CLIENT_ID").ok()?;
    let client_secret = std::env::var("IGDB_CLIENT_SECRET").ok()?;

    if client_id.is_empty() || client_secret.is_empty() {
        eprintln!("[metadata] IGDB_CLIENT_ID or IGDB_CLIENT_SECRET not set in .env");
        return None;
    }

    let url = format!(
        "https://id.twitch.tv/oauth2/token?client_id={}&client_secret={}&grant_type=client_credentials",
        client_id, client_secret
    );

    let client = reqwest::Client::new();
    let resp = client.post(&url).send().await.ok()?;
    let text = resp.text().await.ok()?;
    let body: serde_json::Value = serde_json::from_str(&text).ok()?;
    let token = body["access_token"].as_str()?.to_string();

    // Cache it
    {
        let mut lock = IGDB_TOKEN.lock().unwrap();
        *lock = Some((token.clone(), std::time::Instant::now()));
    }

    Some(token)
}

async fn fetch_from_igdb(title: &str) -> Option<GameMetadata> {
    let client_id = std::env::var("IGDB_CLIENT_ID").ok()?;
    let token = get_igdb_token().await?;

    let client = reqwest::Client::new();
    // Search without category filter (it breaks IGDB search), get top 5 and pick best match
    let body = format!(
        "search \"{}\"; fields name,cover.image_id,summary,genres.name; limit 5;",
        title.replace('"', "\\\"")
    );

    let resp = client
        .post("https://api.igdb.com/v4/games")
        .header("Client-ID", &client_id)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "text/plain")
        .body(body)
        .send()
        .await
        .ok()?;

    let text = resp.text().await.ok()?;
    let games: Vec<serde_json::Value> = serde_json::from_str(&text).ok()?;
    if games.is_empty() { return None; }

    // Pick best match: exact title match > contains match > first result
    let title_lower = title.to_lowercase();
    let game = games.iter()
        .max_by_key(|g| {
            let name = g["name"].as_str().unwrap_or("").to_lowercase();
            if name == title_lower { 100 }
            else if name.contains(&title_lower) || title_lower.contains(&name) { 50 }
            else { 0 }
        })?;

    let cover_url = game["cover"]["image_id"].as_str().map(|id| {
        format!("https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg", id)
    });

    let genres = game["genres"].as_array().map(|arr| {
        arr.iter()
            .filter_map(|g| g["name"].as_str().map(|s| s.to_string()))
            .collect::<Vec<String>>()
    });

    Some(GameMetadata {
        title: game["name"].as_str()?.to_string(),
        cover_url,
        description: game["summary"].as_str().map(|s| s.to_string()),
        genres,
    })
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

    let metadata = fetch_from_igdb(&game_title).await;

    if let Some(ref m) = metadata {
        write_cache(&db, &normalized, m);
    }

    Ok(metadata)
}
