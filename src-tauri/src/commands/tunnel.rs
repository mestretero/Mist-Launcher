use crate::tunnel::{self, PeerConfig, TunnelInfo, TunnelStatus};
use crate::tunnel::wg;

#[tauri::command]
pub async fn generate_keypair() -> Result<(String, String), String> {
    let kp = wg::generate_keypair();
    Ok((kp.private_key, kp.public_key))
}

#[tauri::command]
pub async fn create_tunnel(
    room_id: String,
    virtual_ip: String,
    private_key: String,
    peers: Vec<PeerConfig>,
) -> Result<TunnelInfo, String> {
    tunnel::adapter::create_adapter(&room_id, &virtual_ip, &private_key, &peers).await
}

#[tauri::command]
pub async fn destroy_tunnel(room_id: String) -> Result<(), String> {
    tunnel::adapter::destroy_adapter(&room_id).await
}

#[tauri::command]
pub async fn get_tunnel_status(room_id: String) -> Result<TunnelStatus, String> {
    tunnel::adapter::get_status(&room_id)
}
