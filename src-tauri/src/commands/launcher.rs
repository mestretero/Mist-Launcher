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
    args: Option<Vec<String>>,
) -> Result<u32, String> {
    let mut cmd = Command::new(&exe_path);
    if let Some(ref a) = args {
        cmd.args(a);
    }
    let child = cmd.spawn()
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
