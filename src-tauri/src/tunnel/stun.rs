use std::net::{SocketAddr, UdpSocket};

const STUN_SERVERS: &[&str] = &[
    "stun.l.google.com:19302",
    "stun1.l.google.com:19302",
    "stun.cloudflare.com:3478",
];

const MAGIC_COOKIE: [u8; 4] = [0x21, 0x12, 0xA4, 0x42];

/// Discover our public IP:port by sending a STUN Binding Request (RFC 5389).
/// Uses the existing UDP socket so the NAT mapping is preserved.
pub fn discover_public_endpoint(local_socket: &UdpSocket) -> Result<SocketAddr, String> {
    // Build STUN Binding Request (20 bytes header, no attributes)
    let mut request = [0u8; 20];
    request[0] = 0x00;
    request[1] = 0x01; // Type: Binding Request
    request[2] = 0x00;
    request[3] = 0x00; // Length: 0
    request[4..8].copy_from_slice(&MAGIC_COOKIE);
    // Transaction ID: random 12 bytes
    use rand::RngCore;
    rand::rngs::OsRng.fill_bytes(&mut request[8..20]);

    // Save original timeout to restore later
    let original_timeout = local_socket.read_timeout().ok().flatten();

    for server in STUN_SERVERS {
        // Resolve STUN server address
        let addr: SocketAddr = match resolve_stun_addr(server) {
            Some(a) => a,
            None => continue,
        };

        // Send STUN request
        if local_socket.send_to(&request, addr).is_err() {
            continue;
        }

        // Set read timeout for response
        local_socket
            .set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .ok();

        let mut buf = [0u8; 256];
        let (n, _) = match local_socket.recv_from(&mut buf) {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Restore non-blocking mode
        local_socket.set_nonblocking(true).ok();

        // Parse STUN response
        if let Some(addr) = parse_stun_response(&buf[..n]) {
            return Ok(addr);
        }
    }

    // Restore original timeout
    if let Some(t) = original_timeout {
        local_socket.set_read_timeout(Some(t)).ok();
    } else {
        local_socket.set_nonblocking(true).ok();
    }

    Err("STUN discovery failed — no server responded".to_string())
}

fn resolve_stun_addr(server: &str) -> Option<SocketAddr> {
    use std::net::ToSocketAddrs;
    server.to_socket_addrs().ok()?.next()
}

fn parse_stun_response(data: &[u8]) -> Option<SocketAddr> {
    if data.len() < 20 {
        return None;
    }

    let mut offset = 20; // Skip 20-byte header
    while offset + 4 <= data.len() {
        let attr_type = u16::from_be_bytes([data[offset], data[offset + 1]]);
        let attr_len = u16::from_be_bytes([data[offset + 2], data[offset + 3]]) as usize;

        if offset + 4 + attr_len > data.len() {
            break;
        }

        let attr_data = &data[offset + 4..offset + 4 + attr_len];

        match attr_type {
            0x0020 if attr_len >= 8 => {
                // XOR-MAPPED-ADDRESS (preferred)
                if let Some(addr) = parse_xor_mapped_address(attr_data) {
                    return Some(addr);
                }
            }
            0x0001 if attr_len >= 8 => {
                // MAPPED-ADDRESS (fallback)
                if let Some(addr) = parse_mapped_address(attr_data) {
                    return Some(addr);
                }
            }
            _ => {}
        }

        // Advance to next attribute (4-byte aligned)
        offset += 4 + attr_len;
        if attr_len % 4 != 0 {
            offset += 4 - (attr_len % 4);
        }
    }

    None
}

fn parse_xor_mapped_address(data: &[u8]) -> Option<SocketAddr> {
    let family = data[1];
    if family != 0x01 {
        return None; // Only IPv4
    }
    let xor_port = u16::from_be_bytes([data[2], data[3]]) ^ 0x2112;
    let ip = std::net::Ipv4Addr::new(
        data[4] ^ MAGIC_COOKIE[0],
        data[5] ^ MAGIC_COOKIE[1],
        data[6] ^ MAGIC_COOKIE[2],
        data[7] ^ MAGIC_COOKIE[3],
    );
    Some(SocketAddr::new(std::net::IpAddr::V4(ip), xor_port))
}

fn parse_mapped_address(data: &[u8]) -> Option<SocketAddr> {
    let family = data[1];
    if family != 0x01 {
        return None; // Only IPv4
    }
    let port = u16::from_be_bytes([data[2], data[3]]);
    let ip = std::net::Ipv4Addr::new(data[4], data[5], data[6], data[7]);
    Some(SocketAddr::new(std::net::IpAddr::V4(ip), port))
}
