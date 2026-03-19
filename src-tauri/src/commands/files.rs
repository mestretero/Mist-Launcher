use sha2::{Sha256, Digest};
use std::path::Path;

#[derive(serde::Serialize)]
pub struct DiskSpace {
    free_bytes: u64,
    total_bytes: u64,
}

#[tauri::command]
pub async fn get_disk_space(path: String) -> Result<DiskSpace, String> {
    // Simplified: return available space for the drive
    let metadata = fs2::available_space(&path).map_err(|e| e.to_string())?;
    let total = fs2::total_space(&path).map_err(|e| e.to_string())?;
    Ok(DiskSpace { free_bytes: metadata, total_bytes: total })
}

#[tauri::command]
pub async fn verify_game_files(
    _game_id: String,
    path: String,
    expected_hash: String,
) -> Result<bool, String> {
    let data = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hex::encode(hasher.finalize());
    Ok(result == expected_hash)
}

#[tauri::command]
pub async fn uninstall_game(_game_id: String, path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        tokio::fs::remove_dir_all(p).await.map_err(|e| e.to_string())?;
    } else if p.is_file() {
        tokio::fs::remove_file(p).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
