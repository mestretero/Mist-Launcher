pub mod adapter;
pub mod stun;
pub mod wg;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
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
    pub listen_port: u16,       // our UDP listen port for peers to connect
    pub public_endpoint: String, // public IP:port from STUN, or "0.0.0.0:PORT" fallback
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStatus {
    pub active: bool,
    pub virtual_ip: String,
    pub peer_count: usize,
    pub listen_port: u16,
    pub public_endpoint: String,
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
    if let Ok(mut tunnels) = TUNNELS.lock() {
        tunnels.insert(
            room_id.to_string(),
            ActiveTunnel {
                info,
                shutdown_tx,
                peer_count: 0,
            },
        );
    } else {
        eprintln!("[tunnel] Failed to lock TUNNELS for register");
    }
}

pub fn unregister_tunnel(room_id: &str) -> Option<watch::Sender<bool>> {
    TUNNELS
        .lock()
        .ok()?
        .remove(room_id)
        .map(|t| t.shutdown_tx)
}

pub fn get_tunnel_info(room_id: &str) -> Option<TunnelInfo> {
    TUNNELS.lock().ok()?.get(room_id).map(|t| t.info.clone())
}

pub fn get_tunnel_status(room_id: &str) -> TunnelStatus {
    let default = TunnelStatus {
        active: false,
        virtual_ip: String::new(),
        peer_count: 0,
        listen_port: 0,
        public_endpoint: String::new(),
    };

    let Ok(tunnels) = TUNNELS.lock() else {
        return default;
    };

    match tunnels.get(room_id) {
        Some(t) => TunnelStatus {
            active: true,
            virtual_ip: t.info.virtual_ip.clone(),
            peer_count: t.peer_count,
            listen_port: t.info.listen_port,
            public_endpoint: t.info.public_endpoint.clone(),
        },
        None => default,
    }
}

pub fn update_peer_count(room_id: &str, count: usize) {
    if let Ok(mut tunnels) = TUNNELS.lock() {
        if let Some(t) = tunnels.get_mut(room_id) {
            t.peer_count = count;
        }
    }
}
