use super::{PeerConfig, TunnelInfo, TunnelStatus};

pub async fn create_adapter(
    room_id: &str,
    virtual_ip: &str,
    private_key: &str,
    _peers: &[PeerConfig],
) -> Result<TunnelInfo, String> {
    // Phase 1 scaffold: register tunnel info
    // Actual WireGuard + WinTUN integration will be added iteratively
    let keypair = super::wg::generate_keypair();
    let info = TunnelInfo {
        room_id: room_id.to_string(),
        virtual_ip: virtual_ip.to_string(),
        private_key: private_key.to_string(),
        public_key: keypair.public_key,
    };
    super::register_tunnel(room_id, info.clone());
    Ok(info)
}

pub async fn destroy_adapter(room_id: &str) -> Result<(), String> {
    super::unregister_tunnel(room_id);
    Ok(())
}

pub fn get_status(room_id: &str) -> Result<TunnelStatus, String> {
    match super::get_tunnel(room_id) {
        Some(info) => Ok(TunnelStatus {
            active: true,
            virtual_ip: info.virtual_ip,
            peer_count: 0,
        }),
        None => Ok(TunnelStatus {
            active: false,
            virtual_ip: String::new(),
            peer_count: 0,
        }),
    }
}
