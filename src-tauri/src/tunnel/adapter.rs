use super::{PeerConfig, TunnelInfo, TunnelStatus};
use std::net::{SocketAddr, UdpSocket};
use std::sync::Arc;
use tokio::sync::watch;

/// Create a virtual LAN tunnel.
///
/// 1. Creates a WinTUN virtual network adapter
/// 2. Assigns the virtual IP (10.13.37.x)
/// 3. Opens a UDP socket for encrypted P2P traffic
/// 4. Starts background tasks for packet routing: TUN ↔ crypto ↔ UDP
pub async fn create_adapter(
    room_id: &str,
    virtual_ip: &str,
    private_key: &str,
    peers: &[PeerConfig],
) -> Result<TunnelInfo, String> {
    let keypair = super::wg::generate_keypair();

    // Step 1: Load WinTUN DLL
    let dll_path = find_wintun_dll()?;
    let wintun = unsafe {
        wintun::load_from_path(dll_path)
            .map_err(|e| format!("WinTUN yüklenemedi: {}. Antivirüs engelliyor olabilir.", e))?
    };

    // Step 2: Create virtual adapter
    let adapter_name = format!("Stealike-{}", &room_id[..8.min(room_id.len())]);
    let adapter = match wintun::Adapter::create(&wintun, "Stealike", &adapter_name, None) {
        Ok(a) => a,
        Err(e) => {
            return Err(format!(
                "Ağ adaptörü oluşturulamadı: {}. Yönetici olarak çalıştırmayı deneyin.",
                e
            ));
        }
    };

    // Step 3: Assign IP address via netsh
    let netsh_result = std::process::Command::new("netsh")
        .args([
            "interface",
            "ip",
            "set",
            "address",
            &adapter_name,
            "static",
            virtual_ip,
            "255.255.255.0",
        ])
        .output()
        .map_err(|e| format!("IP atanamadı: {}", e))?;

    if !netsh_result.status.success() {
        let stderr = String::from_utf8_lossy(&netsh_result.stderr);
        // Sometimes netsh fails on first try, retry once
        std::thread::sleep(std::time::Duration::from_millis(500));
        let retry = std::process::Command::new("netsh")
            .args([
                "interface",
                "ip",
                "set",
                "address",
                &adapter_name,
                "static",
                virtual_ip,
                "255.255.255.0",
            ])
            .output()
            .map_err(|e| format!("IP atanamadı (retry): {}", e))?;
        if !retry.status.success() {
            return Err(format!("IP atanamadı: {}", stderr));
        }
    }

    // Step 4: Open UDP socket for tunnel traffic (random port)
    let udp_socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("UDP soketi açılamadı: {}", e))?;
    let listen_port = udp_socket
        .local_addr()
        .map_err(|e| format!("Port alınamadı: {}", e))?
        .port();

    // Step 4.5: STUN discovery — find our public endpoint for NAT traversal
    let public_endpoint = match super::stun::discover_public_endpoint(&udp_socket) {
        Ok(addr) => {
            eprintln!("[STUN] Public endpoint discovered: {}", addr);
            addr.to_string()
        }
        Err(e) => {
            eprintln!("[STUN] Discovery failed: {} — LAN mode only", e);
            format!("0.0.0.0:{}", listen_port) // fallback to local
        }
    };

    udp_socket
        .set_nonblocking(true)
        .map_err(|e| format!("Non-blocking ayarlanamadı: {}", e))?;

    // Step 5: Start TUN session
    let session = Arc::new(
        adapter
            .start_session(0x20000) // 128KB ring buffer
            .map_err(|e| format!("TUN oturumu başlatılamadı: {}", e))?,
    );

    // Step 6: Derive shared secrets for each peer
    let mut peer_entries: Vec<PeerEntry> = Vec::new();
    for peer in peers {
        if peer.endpoint.is_empty() || peer.public_key.is_empty() {
            continue;
        }
        let shared_key = super::wg::derive_shared_secret(private_key, &peer.public_key)
            .map_err(|e| format!("Anahtar türetilemedi: {}", e))?;
        let endpoint: SocketAddr = peer
            .endpoint
            .parse()
            .map_err(|e| format!("Geçersiz endpoint: {}", e))?;
        peer_entries.push(PeerEntry {
            endpoint,
            shared_key,
            virtual_ip: peer.virtual_ip.clone(),
        });
    }

    // Step 6.5: UDP hole punching — send empty packets to open NAT tables
    for peer in &peer_entries {
        for _ in 0..3 {
            let _ = udp_socket.send_to(&[0u8; 1], peer.endpoint);
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    // Step 7: Create shutdown channel
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Step 8: Start packet routing tasks
    let session_clone = session.clone();
    let udp_clone = udp_socket
        .try_clone()
        .map_err(|e| format!("UDP klon: {}", e))?;
    let peers_clone = peer_entries.clone();
    let _private_key_clone = private_key.to_string();
    let rx1 = shutdown_rx.clone();

    // TUN → encrypt → UDP (outbound)
    tokio::spawn(async move {
        loop {
            if *rx1.borrow() {
                break;
            }

            // Try to read a packet from the TUN adapter
            match session_clone.try_receive() {
                Ok(Some(packet)) => {
                    let data = packet.bytes();
                    // Route based on destination IP in the packet
                    if data.len() >= 20 {
                        let dst_ip = format!("{}.{}.{}.{}", data[16], data[17], data[18], data[19]);
                        for peer in &peers_clone {
                            if peer.virtual_ip == dst_ip || peers_clone.len() == 1 {
                                if let Ok(encrypted) =
                                    super::wg::encrypt_packet(&peer.shared_key, data)
                                {
                                    let _ = udp_clone.send_to(&encrypted, peer.endpoint);
                                }
                                break;
                            }
                        }
                    }
                }
                Ok(None) => {
                    // No packet available, short sleep to avoid busy loop
                    tokio::time::sleep(tokio::time::Duration::from_micros(100)).await;
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                }
            }
        }
    });

    // UDP → decrypt → TUN (inbound)
    let session_clone2 = session.clone();
    let udp_clone2 = udp_socket
        .try_clone()
        .map_err(|e| format!("UDP klon2: {}", e))?;
    let peers_clone2 = peer_entries.clone();
    let rx2 = shutdown_rx.clone();

    tokio::spawn(async move {
        let mut buf = vec![0u8; 65536];
        loop {
            if *rx2.borrow() {
                break;
            }

            match udp_clone2.recv_from(&mut buf) {
                Ok((n, src_addr)) => {
                    // Find peer by source address, or try all shared keys
                    let matching_peer = peers_clone2
                        .iter()
                        .find(|p| p.endpoint == src_addr);

                    let keys_to_try: Vec<&[u8; 32]> = if let Some(peer) = matching_peer {
                        vec![&peer.shared_key]
                    } else {
                        peers_clone2.iter().map(|p| &p.shared_key).collect()
                    };

                    for key in keys_to_try {
                        if let Ok(decrypted) = super::wg::decrypt_packet(key, &buf[..n]) {
                            // Write decrypted packet to TUN adapter
                            if let Ok(mut write_pack) =
                                session_clone2.allocate_send_packet(decrypted.len() as u16)
                            {
                                write_pack.bytes_mut().copy_from_slice(&decrypted);
                                session_clone2.send_packet(write_pack);
                            }
                            break;
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    tokio::time::sleep(tokio::time::Duration::from_micros(100)).await;
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                }
            }
        }
    });

    // Register tunnel
    let info = TunnelInfo {
        room_id: room_id.to_string(),
        virtual_ip: virtual_ip.to_string(),
        private_key: private_key.to_string(),
        public_key: keypair.public_key,
        listen_port,
        public_endpoint,
    };
    super::register_tunnel(room_id, info.clone(), shutdown_tx);
    super::update_peer_count(room_id, peer_entries.len());

    Ok(info)
}

/// Destroy the tunnel, close adapter and stop background tasks.
pub async fn destroy_adapter(room_id: &str) -> Result<(), String> {
    if let Some(shutdown_tx) = super::unregister_tunnel(room_id) {
        let _ = shutdown_tx.send(true); // Signal background tasks to stop
    }

    // Remove IP configuration
    let adapter_name = format!("Stealike-{}", &room_id[..8.min(room_id.len())]);
    let _ = std::process::Command::new("netsh")
        .args([
            "interface",
            "ip",
            "delete",
            "address",
            &adapter_name,
            "addr=10.13.37.0",
        ])
        .output();

    Ok(())
}

/// Get tunnel status.
pub fn get_status(room_id: &str) -> Result<TunnelStatus, String> {
    Ok(super::get_tunnel_status(room_id))
}

// ── Helpers ─────────────────────────────────────────

#[derive(Clone)]
struct PeerEntry {
    endpoint: SocketAddr,
    shared_key: [u8; 32],
    virtual_ip: String,
}

/// Find wintun.dll — check app directory, resources, src-tauri dir.
fn find_wintun_dll() -> Result<std::path::PathBuf, String> {
    // Check next to executable (bundled with app)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let dll = dir.join("wintun.dll");
            if dll.exists() {
                return Ok(dll);
            }
            // Check resources subdirectory (Tauri bundle)
            let res = dir.join("resources").join("wintun.dll");
            if res.exists() {
                return Ok(res);
            }
        }
    }

    // Check src-tauri directory (dev mode)
    let dev_path = std::path::PathBuf::from("src-tauri/wintun.dll");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Check current directory
    let cwd = std::path::PathBuf::from("wintun.dll");
    if cwd.exists() {
        return Ok(cwd);
    }

    Err(
        "wintun.dll bulunamadı. Lütfen uygulamayı yeniden yükleyin veya wintun.dll dosyasını uygulama dizinine koyun."
            .to_string(),
    )
}
