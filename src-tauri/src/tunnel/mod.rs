pub mod adapter;
pub mod wg;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::watch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfig {
    pub public_key: String,
    pub endpoint: String,    // "ip:port" of the peer's UDP socket
    pub virtual_ip: String,  // e.g. "10.13.37.2"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInfo {
    pub room_id: String,
    pub virtual_ip: String,
    pub private_key: String,
    pub public_key: String,
    pub listen_port: u16,  // our UDP listen port for peers to connect
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStatus {
    pub active: bool,
    pub virtual_ip: String,
    pub peer_count: usize,
    pub listen_port: u16,
}

/// Active tunnel state with shutdown handle
struct ActiveTunnel {
    info: TunnelInfo,
    shutdown_tx: watch::Sender<bool>,
    peer_count: usize,
}

lazy_static::lazy_static! {
    static ref TUNNELS: Mutex<HashMap<String, ActiveTunnel>> = Mutex::new(HashMap::new());
}

pub fn register_tunnel(room_id: &str, info: TunnelInfo, shutdown_tx: watch::Sender<bool>) {
    TUNNELS.lock().unwrap().insert(
        room_id.to_string(),
        ActiveTunnel {
            info,
            shutdown_tx,
            peer_count: 0,
        },
    );
}

pub fn unregister_tunnel(room_id: &str) -> Option<watch::Sender<bool>> {
    TUNNELS
        .lock()
        .unwrap()
        .remove(room_id)
        .map(|t| t.shutdown_tx)
}

pub fn get_tunnel_info(room_id: &str) -> Option<TunnelInfo> {
    TUNNELS.lock().unwrap().get(room_id).map(|t| t.info.clone())
}

pub fn get_tunnel_status(room_id: &str) -> TunnelStatus {
    match TUNNELS.lock().unwrap().get(room_id) {
        Some(t) => TunnelStatus {
            active: true,
            virtual_ip: t.info.virtual_ip.clone(),
            peer_count: t.peer_count,
            listen_port: t.info.listen_port,
        },
        None => TunnelStatus {
            active: false,
            virtual_ip: String::new(),
            peer_count: 0,
            listen_port: 0,
        },
    }
}

pub fn update_peer_count(room_id: &str, count: usize) {
    if let Some(t) = TUNNELS.lock().unwrap().get_mut(room_id) {
        t.peer_count = count;
    }
}
