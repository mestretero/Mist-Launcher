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
