pub mod wg;
pub mod adapter;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfig {
    pub public_key: String,
    pub endpoint: String,
    pub virtual_ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInfo {
    pub room_id: String,
    pub virtual_ip: String,
    pub private_key: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStatus {
    pub active: bool,
    pub virtual_ip: String,
    pub peer_count: usize,
}

lazy_static::lazy_static! {
    static ref TUNNELS: Mutex<HashMap<String, TunnelInfo>> = Mutex::new(HashMap::new());
}

pub fn register_tunnel(room_id: &str, info: TunnelInfo) {
    TUNNELS.lock().unwrap().insert(room_id.to_string(), info);
}

pub fn unregister_tunnel(room_id: &str) {
    TUNNELS.lock().unwrap().remove(room_id);
}

pub fn get_tunnel(room_id: &str) -> Option<TunnelInfo> {
    TUNNELS.lock().unwrap().get(room_id).cloned()
}
