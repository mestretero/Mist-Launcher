use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// ── Security: only numeric Steam App IDs are accepted ─────────────────────────
fn validate_steam_app_id(raw: &str) -> Option<u32> {
    // Must be 1–10 digits, no leading zeros beyond "0" itself
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 10 {
        return None;
    }
    if !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    trimmed.parse::<u32>().ok()
}

// ── Known-unlocked cache (per watcher session) ─────────────────────────────────
pub type UnlockedCache = Arc<Mutex<HashSet<String>>>;

#[derive(Clone, serde::Serialize)]
pub struct AchievementUnlockedEvent {
    pub game_id: String,
    pub api_name: String,
    pub unlocked_at: i64, // Unix ms
}

// ── Locate achievement files for all known emulators ──────────────────────────
fn candidate_paths(app_id: u32) -> Vec<(PathBuf, AchievementFormat)> {
    let id = app_id.to_string();
    let mut paths: Vec<(PathBuf, AchievementFormat)> = Vec::new();

    // %APPDATA% – roaming
    if let Ok(appdata) = std::env::var("APPDATA") {
        let base = PathBuf::from(&appdata);

        // Goldberg SteamEmu
        paths.push((
            base.join("Goldberg SteamEmu Saves").join(&id).join("achievements.json"),
            AchievementFormat::GoldbergJson,
        ));
        paths.push((
            base.join("GSE Saves").join(&id).join("achievements.json"),
            AchievementFormat::GoldbergJson,
        ));

        // EMPRESS
        paths.push((
            base.join("EMPRESS").join(&id).join("remote").join("achievements.json"),
            AchievementFormat::GoldbergJson,
        ));

        // SmartSteamEmu
        paths.push((
            base.join("SmartSteamEmu").join(&id).join("User").join("Achievements.ini"),
            AchievementFormat::IniAchieved,
        ));
    }

    // %USERPROFILE%
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let base = PathBuf::from(&profile);

        // SKIDROW
        paths.push((
            base.join("Documents").join("SKIDROW").join(&id).join("Player").join("achiev.ini"),
            AchievementFormat::IniAchieved,
        ));
    }

    // Public documents – CODEX / RUNE
    if let Ok(public) = std::env::var("PUBLIC") {
        let base = PathBuf::from(&public);
        paths.push((
            base.join("Documents").join("Steam").join("CODEX").join(&id).join("achievements.ini"),
            AchievementFormat::IniAchieved,
        ));
    }

    // ProgramData – RLD!
    if let Ok(pd) = std::env::var("ProgramData") {
        let base = PathBuf::from(&pd);
        paths.push((
            base.join("RLD!").join(&id).join("achievements.ini"),
            AchievementFormat::IniAchieved,
        ));
        paths.push((
            base.join("Steam").join(&id).join("Player").join("achievements.ini"),
            AchievementFormat::IniAchieved,
        ));
    }

    paths
}

#[derive(Clone, Copy)]
enum AchievementFormat {
    GoldbergJson,
    IniAchieved,
}

// ── Parse Goldberg-style JSON ──────────────────────────────────────────────────
// Format: { "ACH_NAME": { "earned": true, "earned_time": 1234567890 } }
// Or array: [{ "name": "ACH_NAME", "earned": true, "earned_time": 123 }]
fn parse_goldberg_json(content: &str) -> Vec<(String, i64)> {
    let mut result = Vec::new();

    // Try object format first
    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(map) = obj.as_object() {
            for (key, val) in map {
                let earned = val.get("earned").and_then(|v| v.as_bool()).unwrap_or(false);
                if earned {
                    let ts = val.get("earned_time").and_then(|v| v.as_i64()).unwrap_or(0);
                    result.push((key.clone(), ts * 1000)); // seconds → ms
                }
            }
        } else if let Some(arr) = obj.as_array() {
            for item in arr {
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let earned = item.get("earned").and_then(|v| v.as_bool()).unwrap_or(false);
                if !name.is_empty() && earned {
                    let ts = item.get("earned_time").and_then(|v| v.as_i64()).unwrap_or(0);
                    result.push((name, ts * 1000));
                }
            }
        }
    }

    result
}

// ── Parse INI-style achievement files (CODEX, SKIDROW, SmartSteamEmu) ─────────
// [ACH_NAME]\nAchieved=1\nUnlockTime=1234567890
fn parse_ini_achieved(content: &str) -> Vec<(String, i64)> {
    let mut result = Vec::new();
    let mut current_section: Option<String> = None;
    let mut achieved = false;
    let mut unlock_time: i64 = 0;

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('[') && line.ends_with(']') {
            // Flush previous section
            if let Some(ref name) = current_section {
                if achieved {
                    result.push((name.clone(), unlock_time * 1000));
                }
            }
            let section_name = &line[1..line.len() - 1];
            // Skip meta sections like [SteamAchievements]
            if section_name == "SteamAchievements" {
                current_section = None;
            } else {
                current_section = Some(section_name.to_string());
            }
            achieved = false;
            unlock_time = 0;
        } else if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_lowercase();
            let val = line[pos + 1..].trim();
            match key.as_str() {
                "achieved" => achieved = val == "1",
                "unlocktime" => unlock_time = val.parse::<i64>().unwrap_or(0),
                _ => {}
            }
        }
    }
    // Flush last section
    if let Some(name) = current_section {
        if achieved {
            result.push((name, unlock_time * 1000));
        }
    }

    result
}

// ── Core watcher loop (runs in a background tokio task) ───────────────────────
async fn watcher_loop(
    app: AppHandle,
    game_id: String,
    app_id: u32,
    cache: UnlockedCache,
) {
    let candidates = candidate_paths(app_id);

    // Find the first existing file and its format
    let mut active: Option<(PathBuf, AchievementFormat)> = None;
    for (path, fmt) in &candidates {
        if path.exists() {
            active = Some((path.clone(), *fmt));
            break;
        }
    }

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;

        // If no file found yet, keep scanning
        if active.is_none() {
            for (path, fmt) in &candidates {
                if path.exists() {
                    active = Some((path.clone(), *fmt));
                    break;
                }
            }
        }

        let Some((ref path, fmt)) = active else { continue };

        // Safety: only read files within expected dirs
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let unlocked = match fmt {
            AchievementFormat::GoldbergJson => parse_goldberg_json(&content),
            AchievementFormat::IniAchieved => parse_ini_achieved(&content),
        };

        let mut seen = cache.lock().unwrap();
        for (api_name, unlocked_at) in unlocked {
            if seen.contains(&api_name) {
                continue;
            }
            seen.insert(api_name.clone());
            let _ = app.emit(
                "achievement-unlocked",
                AchievementUnlockedEvent {
                    game_id: game_id.clone(),
                    api_name,
                    unlocked_at,
                },
            );
        }
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_achievement_watcher(
    app: AppHandle,
    game_id: String,
    steam_app_id: String,
) -> Result<(), String> {
    // Strict validation — no path traversal possible
    let app_id = validate_steam_app_id(&steam_app_id)
        .ok_or_else(|| "Invalid Steam App ID: must be a positive integer".to_string())?;

    // game_id is used only as an identifier in the emitted event, not in any file path.
    // Allow UUIDs (store games) and numeric IDs (local/scanned games).
    let is_valid_id = uuid::Uuid::parse_str(&game_id).is_ok()
        || game_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !is_valid_id || game_id.len() > 64 {
        return Err("Invalid game_id format".to_string());
    }

    let cache: UnlockedCache = Arc::new(Mutex::new(HashSet::new()));

    tokio::spawn(watcher_loop(app, game_id, app_id, cache));

    Ok(())
}
