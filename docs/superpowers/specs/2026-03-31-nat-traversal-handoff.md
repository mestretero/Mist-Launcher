# NAT Traversal Entegrasyonu — Sonraki AI İçin Handoff Dokümanı

**Tarih:** 2026-03-31
**Durum:** Mevcut sistem LAN'da çalışıyor, internet üzerinden bağlantı için NAT traversal gerekli
**Öncelik:** Bu dokümanı BAŞTAN SONA oku, hiçbir bölümü atlama.

---

## ⚠️ KRİTİK KURALLAR

1. **HİÇBİR ŞEYİ BOZMA.** Mevcut çalışan sistemi koru. Yeni kod ekle, mevcut kodu değiştirme (sadece gerekli yerlerde minimal değişiklik).
2. **Seed script'i ÇALIŞTIRMA.** `server/prisma/seed.ts` tüm oyunları siler. ASLA çalıştırma.
3. **Mevcut tunnel akışını koru.** LAN bağlantısı şu an çalışıyor — NAT traversal onu bozmadan üstüne eklenmeli.
4. **Test et, commit et, sonra devam et.** Her adımda `npx tsc --noEmit` (frontend + server) ve `cargo check` (Rust) çalıştır.

---

## Mevcut Mimari (DOKUNMA)

```
┌─────────────────────────────────────┐
│         Stealike Server              │
│    Fastify + WebSocket + PostgreSQL  │
│                                      │
│  • Room CRUD (REST)                  │
│  • WebSocket signaling               │
│  • Peer key + endpoint exchange      │
│  • Chat mesajları                    │
│                                      │
│  ⚠ Oyun trafiği buradan GEÇMEZ     │
└──────────┬──────────┬───────────────┘
           │ WS       │ WS
           ▼          ▼
┌────────────────┐  ┌────────────────┐
│  Host (Tauri)   │  │ Client (Tauri) │
│                 │  │                │
│ WinTUN adapter  │◄═│ WinTUN adapter │
│ 10.13.37.1      │P2P│ 10.13.37.2    │
│ XChaCha20+UDP   │  │ XChaCha20+UDP │
│                 │  │                │
│ Oyun server     │  │ Oyun client   │
└────────────────┘  └────────────────┘
```

### Dosya Yapısı (Mevcut)

**Rust (src-tauri/src/):**
- `tunnel/mod.rs` — TunnelInfo, TunnelStatus, tunnel registry (HashMap), register/unregister/get
- `tunnel/wg.rs` — X25519 keypair generation, XChaCha20-Poly1305 encrypt/decrypt
- `tunnel/adapter.rs` — **ANA DOSYA**: WinTUN adapter oluşturma, IP atama, UDP socket, packet routing loop
- `commands/tunnel.rs` — Tauri commands: generate_keypair, create_tunnel, destroy_tunnel, get_tunnel_status, get_tunnel_listen_port

**Server (server/src/):**
- `ws/gateway.ts` — WebSocket gateway, JWT auth, client registry, heartbeat
- `ws/handlers.ts` — room:join, room:leave, peer:offer, peer:answer → signaling
- `services/room.service.ts` — Room CRUD, joinRoom (virtual IP allocation), leaveRoom
- `routes/rooms.ts` — REST endpoints

**Frontend (src/):**
- `stores/roomStore.ts` — Zustand store: WS connection, room state, tunnel state, peer signaling
- `pages/RoomPage.tsx` — Lobby UI: player list, chat, game launch
- `pages/MultiplayerPage.tsx` — Room listing, create room
- `lib/wsClient.ts` — WebSocket wrapper with auto-reconnect

### Şu Anki Bağlantı Akışı

1. Host "Oda Oluştur" → REST'le oda açılır → `create_tunnel` çağrılır → WinTUN adapter + UDP socket açılır
2. Host WS'ye `room:join` gönderir (publicKey + endpoint `0.0.0.0:{listen_port}`)
3. Client "Katıl" → WS'ye `room:join` gönderir (publicKey)
4. Server her iki tarafa `peer:signal` ile karşı tarafın publicKey + endpoint bilgisini iletir
5. Client `peer:signal` alınca `create_tunnel` çağırır → kendi WinTUN adapter + UDP socket açar
6. **SORUN BURADA:** Endpoint olarak `0.0.0.0:PORT` gönderiliyor — bu LAN'da çalışır ama internet'te çalışmaz çünkü gerçek public IP bilinmiyor

---

## Yapılması Gereken: NAT Traversal

### Amaç

İnternet üzerindeki iki kullanıcının NAT/firewall arkasından birbirine P2P bağlantı kurabilmesi.

### Yaklaşım: STUN + UDP Hole Punching + TURN Fallback

```
┌──────────────┐
│  STUN Server  │  (Ücretsiz: Google, Cloudflare)
│  (Public)     │  stun.l.google.com:19302
└──────┬───────┘
       │ "Senin public IP:port şu"
       ▼
┌──────────────┐         ┌──────────────┐
│   Host        │ ◄─────► │   Client      │
│ NAT arkası    │  UDP     │ NAT arkası    │
│ 192.168.1.5   │ Hole     │ 192.168.1.10  │
│               │ Punch    │               │
│ Public:       │         │ Public:        │
│ 85.x.x.x:4521│         │ 90.x.x.x:7832 │
└──────────────┘         └──────────────┘
```

### Adım 1: STUN Client (Rust)

**Yeni dosya:** `src-tauri/src/tunnel/stun.rs`

STUN protokolü basit: UDP paketi STUN server'a gönder, server senin public IP:port'unu döndürür.

```rust
// STUN Binding Request (RFC 5389)
// 1. UDP socket aç (zaten tunnel'da var)
// 2. STUN server'a Binding Request gönder
// 3. Response'dan XOR-MAPPED-ADDRESS parse et
// 4. Bu senin public endpoint'in: "85.x.x.x:4521"

use std::net::{SocketAddr, UdpSocket};

const STUN_SERVERS: &[&str] = &[
    "stun.l.google.com:19302",
    "stun1.l.google.com:19302",
    "stun.cloudflare.com:3478",
];

pub fn discover_public_endpoint(local_socket: &UdpSocket) -> Result<SocketAddr, String> {
    // STUN Binding Request packet (20 bytes header, no attributes)
    // Type: 0x0001 (Binding Request)
    // Length: 0x0000
    // Magic Cookie: 0x2112A442
    // Transaction ID: random 12 bytes

    let mut request = [0u8; 20];
    request[0] = 0x00; request[1] = 0x01; // Binding Request
    request[2] = 0x00; request[3] = 0x00; // Length: 0
    // Magic cookie
    request[4] = 0x21; request[5] = 0x12; request[6] = 0xA4; request[7] = 0x42;
    // Transaction ID (random)
    use rand::RngCore;
    rand::rngs::OsRng.fill_bytes(&mut request[8..20]);

    let magic_cookie = [0x21, 0x12, 0xA4, 0x42];

    for server in STUN_SERVERS {
        let addr: SocketAddr = server.parse().map_err(|e| format!("{}", e))?;

        // Send request
        if local_socket.send_to(&request, addr).is_err() { continue; }

        // Wait for response (timeout 2s)
        local_socket.set_read_timeout(Some(std::time::Duration::from_secs(2))).ok();
        let mut buf = [0u8; 256];
        let (n, _) = match local_socket.recv_from(&mut buf) {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Restore non-blocking
        local_socket.set_nonblocking(true).ok();

        // Parse STUN response — find XOR-MAPPED-ADDRESS (0x0020) or MAPPED-ADDRESS (0x0001)
        if n < 20 { continue; }

        let mut offset = 20; // Skip header
        while offset + 4 <= n {
            let attr_type = u16::from_be_bytes([buf[offset], buf[offset + 1]]);
            let attr_len = u16::from_be_bytes([buf[offset + 2], buf[offset + 3]]) as usize;

            if attr_type == 0x0020 && attr_len >= 8 {
                // XOR-MAPPED-ADDRESS
                let family = buf[offset + 5];
                if family == 0x01 { // IPv4
                    let xor_port = u16::from_be_bytes([buf[offset + 6], buf[offset + 7]]) ^ 0x2112;
                    let xor_ip = [
                        buf[offset + 8] ^ magic_cookie[0],
                        buf[offset + 9] ^ magic_cookie[1],
                        buf[offset + 10] ^ magic_cookie[2],
                        buf[offset + 11] ^ magic_cookie[3],
                    ];
                    let ip = std::net::Ipv4Addr::new(xor_ip[0], xor_ip[1], xor_ip[2], xor_ip[3]);
                    return Ok(SocketAddr::new(std::net::IpAddr::V4(ip), xor_port));
                }
            } else if attr_type == 0x0001 && attr_len >= 8 {
                // MAPPED-ADDRESS (fallback)
                let family = buf[offset + 5];
                if family == 0x01 {
                    let port = u16::from_be_bytes([buf[offset + 6], buf[offset + 7]]);
                    let ip = std::net::Ipv4Addr::new(buf[offset + 8], buf[offset + 9], buf[offset + 10], buf[offset + 11]);
                    return Ok(SocketAddr::new(std::net::IpAddr::V4(ip), port));
                }
            }

            offset += 4 + attr_len;
            // Padding to 4-byte boundary
            if attr_len % 4 != 0 { offset += 4 - (attr_len % 4); }
        }
    }

    Err("STUN discovery failed — tüm serverlar yanıt vermedi".to_string())
}
```

### Adım 2: Adapter'a STUN Entegrasyonu

**Dosya:** `src-tauri/src/tunnel/adapter.rs`

`create_adapter` fonksiyonunda, UDP socket açıldıktan sonra STUN discovery çağır:

```rust
// Mevcut kod (Step 4):
let udp_socket = UdpSocket::bind("0.0.0.0:0")?;
let listen_port = udp_socket.local_addr()?.port();

// EKLE (Step 4.5):
let public_endpoint = match super::stun::discover_public_endpoint(&udp_socket) {
    Ok(addr) => addr.to_string(),
    Err(e) => {
        eprintln!("STUN discovery failed: {} — LAN mode only", e);
        format!("0.0.0.0:{}", listen_port) // fallback to local
    }
};

// TunnelInfo'ya public_endpoint ekle
```

### Adım 3: TunnelInfo'ya public_endpoint Ekle

**Dosya:** `src-tauri/src/tunnel/mod.rs`

```rust
pub struct TunnelInfo {
    pub room_id: String,
    pub virtual_ip: String,
    pub private_key: String,
    pub public_key: String,
    pub listen_port: u16,
    pub public_endpoint: String,  // YENİ: "85.x.x.x:4521" veya "0.0.0.0:PORT"
}
```

### Adım 4: Frontend'de Public Endpoint Gönder

**Dosya:** `src/stores/roomStore.ts`

`createRoom` ve `peer:offer` gönderirken public_endpoint kullan:

```typescript
// Mevcut (adapter.rs'den dönen TunnelInfo artık public_endpoint içeriyor):
const tunnelInfo = await invoke("create_tunnel", { ... });

// WS'ye gönderirken:
wsClient.send("room:join", {
  roomId: room.id,
  publicKey,
  endpoint: tunnelInfo.public_endpoint, // Artık gerçek public IP:port
});
```

### Adım 5: UDP Hole Punching

**Dosya:** `src-tauri/src/tunnel/adapter.rs`

Peer'ın endpoint'i bilindiğinde, hole punch yapılmalı. Outbound task'ın başına ekle:

```rust
// Hole punch: peer'a birkaç boş UDP paketi gönder
// Bu NAT tablolarını açar böylece peer'dan gelen paketler kabul edilir
for peer in &peers {
    for _ in 0..3 {
        let _ = udp_socket.send_to(&[0u8; 1], peer.endpoint);
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}
```

### Adım 6: TURN Relay Fallback (Opsiyonel, Phase 3)

Eğer hole punch başarısız olursa (symmetric NAT), Stealike server'ı TURN relay olarak kullanılabilir. Ama bu server yükünü artırır. Başlangıçta STUN + hole punch yeterli — %80-85 bağlantıda çalışır.

---

## Entegrasyon Kontrol Listesi

- [ ] `src-tauri/src/tunnel/stun.rs` oluştur
- [ ] `src-tauri/src/tunnel/mod.rs` — `pub mod stun;` ekle, TunnelInfo'ya `public_endpoint` ekle
- [ ] `src-tauri/src/tunnel/adapter.rs` — STUN discovery çağır, hole punch ekle, public_endpoint'i TunnelInfo'ya yaz
- [ ] `src/stores/roomStore.ts` — endpoint olarak `tunnelInfo.public_endpoint` gönder
- [ ] `src/lib/types.ts` — TunnelInfo type'ına `publicEndpoint` ekle (frontend tarafı)
- [ ] `cargo check` — 0 hata
- [ ] `npx tsc --noEmit` — 0 hata
- [ ] LAN test — hâlâ çalışıyor mu kontrol et (regression yok)
- [ ] Internet test — iki farklı ağdan bağlantı dene

---

## Dikkat Edilecekler

### DOKUNMA Listesi
- `server/prisma/seed.ts` — ÇALIŞTIRMA, tüm oyunları siler
- `server/prisma/schema.prisma` — NAT traversal için değişiklik GEREKMEZ
- `server/src/ws/handlers.ts` — Signaling zaten çalışıyor, endpoint bilgisi peer:offer/peer:answer'da taşınıyor
- `src/pages/MultiplayerPage.tsx` — UI tamam
- `src/pages/RoomPage.tsx` — UI tamam
- `src/components/CreateRoomModal.tsx` — Tamam

### Minimal Değişiklik Gereken Dosyalar
- `src-tauri/src/tunnel/mod.rs` — TunnelInfo struct'a 1 alan ekle
- `src-tauri/src/tunnel/adapter.rs` — STUN çağrısı + hole punch ekle
- `src/stores/roomStore.ts` — endpoint gönderme mantığı güncelle

### YENİ Dosyalar
- `src-tauri/src/tunnel/stun.rs` — STUN client implementasyonu

---

## Mevcut Teknoloji Stack'i

- **Tauri 2** + Rust (tokio async runtime)
- **Fastify 5** + TypeScript + PostgreSQL (Prisma 7)
- **React 19** + Zustand + Tailwind CSS
- **WinTUN** — sanal ağ adaptörü (wintun.dll bundled)
- **X25519 + XChaCha20-Poly1305** — şifreleme
- **WebSocket** — signaling (@fastify/websocket)

## Rust Crate'ler (src-tauri/Cargo.toml)
- `wintun = "0.5"` — Windows TUN adapter
- `chacha20poly1305 = "0.10"` — AEAD encryption
- `x25519-dalek = "2"` — Key exchange
- `base64 = "0.22"` — Key encoding
- `rand = "0.8"` — Random number generation
- `lazy_static = "1"` — Global state
- `tokio` — Async runtime (full features)
- `serde`, `serde_json` — Serialization

## Test Etme

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit

# Rust
cd src-tauri && cargo check

# Full build test
npm run tauri dev
```

## Proje Yapısı (Önemli Dosyalar)

```
src-tauri/
  src/
    tunnel/
      mod.rs          ← Tunnel registry, types
      wg.rs           ← Crypto (X25519 + XChaCha20)
      adapter.rs      ← WinTUN + UDP routing ← STUN BURAYA EKLENECEK
      stun.rs         ← YENİ: STUN client
    commands/
      tunnel.rs       ← Tauri commands
    lib.rs            ← Command registration
  wintun.dll          ← Bundled, DOKUNMA
  Cargo.toml

server/src/
  ws/
    gateway.ts        ← WebSocket server
    handlers.ts       ← Signaling handlers
  services/
    room.service.ts   ← Room logic
  routes/
    rooms.ts          ← REST API

src/
  stores/
    roomStore.ts      ← Zustand store ← endpoint güncelle
  pages/
    RoomPage.tsx
    MultiplayerPage.tsx
  lib/
    wsClient.ts
    types.ts          ← TunnelInfo type güncelle
```
