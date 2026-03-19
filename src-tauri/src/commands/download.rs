use reqwest::Client;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    download_id: String,
    percent: f64,
    speed_bps: u64,
    eta_secs: u64,
}

#[tauri::command]
pub async fn download_game(
    app: AppHandle,
    _game_id: String,
    url: String,
    dest_path: String,
) -> Result<String, String> {
    let download_id = Uuid::new_v4().to_string();
    let download_id_clone = download_id.clone();

    tokio::spawn(async move {
        if let Err(e) = do_download(&app, &download_id_clone, &url, &dest_path).await {
            eprintln!("Download error: {}", e);
        }
    });

    Ok(download_id)
}

async fn do_download(
    app: &AppHandle,
    download_id: &str,
    url: &str,
    dest_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let response = client.get(url).send().await?;
    let total_size = response.content_length().unwrap_or(0);

    let path = PathBuf::from(dest_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::fs::File::create(&path).await?;
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 { (downloaded as f64 / elapsed) as u64 } else { 0 };
        let percent = if total_size > 0 { (downloaded as f64 / total_size as f64) * 100.0 } else { 0.0 };
        let remaining = if speed > 0 { (total_size - downloaded) / speed } else { 0 };

        let _ = app.emit("download-progress", DownloadProgress {
            download_id: download_id.to_string(),
            percent,
            speed_bps: speed,
            eta_secs: remaining,
        });
    }

    file.flush().await?;
    Ok(())
}

#[tauri::command]
pub async fn pause_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub — pause/resume requires tracking download handles in a global map.
    // Demo files are small (10-50MB), so pause/resume is not critical for investor demo.
    // Full implementation deferred to Faz 1.
    Ok(())
}

#[tauri::command]
pub async fn resume_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub — see pause_download
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub
    Ok(())
}
