use serde::Serialize;
use tauri::AppHandle;
use tauri::Emitter;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub process_id: u32,
    pub running: bool,
}

#[tauri::command]
pub async fn start_dedicated_server(
    app: AppHandle,
    game_id: String,
    exe_path: String,
    args: Vec<String>,
    _port: u16,
) -> Result<u32, String> {
    let child = tokio::process::Command::new(&exe_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Sunucu başlatılamadı: {}", e))?;
    let pid = child.id().ok_or("Process ID alınamadı".to_string())?;
    let app_clone = app.clone();
    tokio::spawn(async move {
        let mut child = child;
        let _ = child.wait().await;
        let _ = app_clone.emit(
            "server-status",
            serde_json::json!({
                "gameId": game_id,
                "processId": pid,
                "status": "stopped"
            }),
        );
    });
    Ok(pid)
}

/// Search for a server binary by filename near the game's exe path.
/// Checks: same dir, parent dir, sibling dirs, common Steam paths.
#[tauri::command]
pub async fn find_server_binary(game_exe_path: String, server_file_name: String) -> Result<String, String> {
    let game_path = std::path::Path::new(&game_exe_path);

    // Search directories: game dir, parent, grandparent, and their children
    let mut search_dirs: Vec<std::path::PathBuf> = Vec::new();
    if let Some(dir) = game_path.parent() {
        search_dirs.push(dir.to_path_buf());
        if let Some(parent) = dir.parent() {
            search_dirs.push(parent.to_path_buf());
            // Sibling directories (e.g., "Don't Starve Together Dedicated Server" next to "Don't Starve Together")
            if let Ok(entries) = std::fs::read_dir(parent) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        search_dirs.push(entry.path());
                        // Also check bin, bin64 subdirs
                        search_dirs.push(entry.path().join("bin"));
                        search_dirs.push(entry.path().join("bin64"));
                    }
                }
            }
        }
    }

    for dir in &search_dirs {
        let candidate = dir.join(&server_file_name);
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Err(format!("Server binary '{}' not found near game path", server_file_name))
}

#[tauri::command]
pub async fn stop_dedicated_server(process_id: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &process_id.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Sunucu durdurulamadı: {}", e))?;
    }
    Ok(())
}
