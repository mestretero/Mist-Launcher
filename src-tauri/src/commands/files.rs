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

    // Resolve to absolute path to prevent path traversal (e.g. "../../Windows/System32")
    let canonical = p.canonicalize().map_err(|e| format!("Invalid path: {e}"))?;

    // Block dangerous system directories
    let path_lower = canonical.to_string_lossy().to_lowercase();
    let blocked = ["\\windows", "\\program files", "\\program files (x86)", "\\users\\", "\\system32"];
    for b in &blocked {
        if path_lower.contains(b) && !path_lower.contains("\\program files\\steam\\steamapps")
            && !path_lower.contains("\\program files (x86)\\steam\\steamapps") {
            return Err(format!("Cannot delete from protected directory: {}", canonical.display()));
        }
    }

    if canonical.is_dir() {
        tokio::fs::remove_dir_all(&canonical).await.map_err(|e| e.to_string())?;
    } else if canonical.is_file() {
        tokio::fs::remove_file(&canonical).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
