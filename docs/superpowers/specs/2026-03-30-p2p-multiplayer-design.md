# P2P Multiplayer — Virtual LAN Gaming

**Date:** 2026-03-30
**Status:** Draft
**Approach:** WireGuard tunnel (boringtun) + WinTUN virtual adapter + WebSocket signaling

## Overview

Stealike acts as a matchmaker and connection broker for multiplayer gaming — especially cracked games where official online multiplayer is disabled but LAN play still works. Users host game servers from their own computers. Stealike handles peer discovery, key exchange, and NAT traversal. Once connected, game traffic flows directly between peers (P2P) — the Stealike server carries zero game traffic.

The system creates a virtual LAN (like Hamachi/Radmin VPN) so games see other players as being on the same local network.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Stealike Server                     │
│         (Fastify + WebSocket + PostgreSQL)        │
│                                                   │
│  • Room CRUD (create/list/delete)                │
│  • WebSocket signaling (key exchange, peer info) │
│  • Game hosting profiles (port/protocol DB)      │
│                                                   │
│  ⚠ Game traffic does NOT pass through here       │
└──────────────┬──────────────┬────────────────────┘
               │ signaling    │ signaling
               ▼              ▼
┌──────────────────┐   ┌──────────────────┐
│   Host (Tauri)    │   │  Client (Tauri)   │
│                   │   │                   │
│ • boringtun       │◄═►│ • boringtun       │
│   (WireGuard)     │P2P│   (WireGuard)     │
│ • WinTUN adapter  │   │ • WinTUN adapter  │
│ • Game server     │   │ • Game client     │
│   or LAN host     │   │                   │
└──────────────────┘   └──────────────────┘
       10.13.37.1            10.13.37.2
```

**Why `10.13.37.x`?** This is a private IP range (RFC 1918) unlikely to conflict with home routers (which typically use `192.168.x.x` or `10.0.0.x`). The `.13.37` subnet is distinctive and avoids collisions.

### Connection Flow

1. Host clicks "Create Room" → Room record created in DB + WebSocket connection opened
2. Client clicks "Join" → Server brokers WireGuard public key exchange via WebSocket
3. Server sends each peer the other's real IP:port (signaling)
4. boringtun performs UDP hole punching for direct P2P connection
5. WinTUN creates virtual network adapter → assigns `10.13.37.x` IPs
6. Game discovers other players via LAN → gameplay begins
7. Server is no longer involved in data flow

## Scope: Phase 1 (MVP) Only

This spec describes **Phase 1 only**. Future phases are listed at the end as brief notes.

**Phase 1 includes:**
- Room CRUD + WebSocket signaling
- WireGuard tunnel (boringtun + WinTUN)
- Multiplayer page + Room page UI
- Friends-only visibility (no public lobbies, no invite links)
- Text chat in rooms
- Manual port configuration
- 5-10 curated hosting profiles (Minecraft, Terraria, L4D2, etc.)

**Phase 1 explicitly excludes:**
- TURN relay fallback (Phase 2)
- Public lobbies and invite links (Phase 2)
- Community-submitted hosting profiles (Phase 2)
- Library integration tab (Phase 2)
- Dedicated server auto-download (Phase 2)
- Notifications for room invites / friend hosting (Phase 2)
- Voice chat (not planned)

## Data Models

All models follow existing Prisma conventions: `@@map("snake_case_table")`, `@map("snake_case")` on fields, `@db.Uuid` on UUID columns. Shown here without annotations for readability — implementor follows `schema.prisma` patterns.

### Room

```prisma
model Room {
  id            String         @id @default(uuid())
  hostId        String
  host          User           @relation("hostedRooms", fields: [hostId], references: [id])
  gameId        String?
  game          Game?          @relation(fields: [gameId], references: [id])
  gameName      String         // fallback for games not in DB
  name          String
  code          String         @unique // 8-char alphanumeric, generated server-side
  visibility    RoomVisibility @default(FRIENDS)
  status        RoomStatus     @default(WAITING)
  maxPlayers    Int            @default(8)
  hostType      HostType       @default(LAN_HOST)
  port          Int?           // game port (from hosting profile or manual)
  config        Json?          // extra settings (mods, seed, etc.)
  createdAt     DateTime       @default(now())
  closedAt      DateTime?

  players       RoomPlayer[]
  messages      RoomMessage[]

  @@index([status, visibility])
  @@index([hostId])
}

enum RoomVisibility {
  FRIENDS     // only friends can see (Phase 1)
  INVITE      // anyone with code/link can join (Phase 2)
  PUBLIC      // visible to everyone (Phase 2)
}

enum RoomStatus {
  WAITING     // lobby, accepting players
  PLAYING     // game started
  CLOSED      // room ended
}

enum HostType {
  LAN_HOST       // in-game LAN/host feature
  DEDICATED      // separate server executable
}
```

**Room code generation:** Server generates codes in the service layer using `nanoid(8, '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ')` (excludes I/O to avoid ambiguity). Uniqueness enforced by DB constraint with retry on collision.

### RoomPlayer

```prisma
model RoomPlayer {
  id         String       @id @default(uuid())
  roomId     String
  room       Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId     String
  user       User         @relation(fields: [userId], references: [id])
  virtualIp  String       // e.g. "10.13.37.2"
  publicKey  String       // WireGuard public key for this session
  status     PlayerStatus @default(CONNECTING)
  joinedAt   DateTime     @default(now())

  @@unique([roomId, userId])
  @@index([roomId])
}

enum PlayerStatus {
  CONNECTING   // key exchange in progress
  CONNECTED    // tunnel established
  READY        // player marked ready
  DISCONNECTED // lost connection
}
```

### RoomMessage (chat)

```prisma
model RoomMessage {
  id        String   @id @default(uuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String?  // null for system messages
  user      User?    @relation(fields: [userId], references: [id])
  content   String
  isSystem  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([roomId, createdAt])
}
```

### GameHostingProfile

```prisma
model GameHostingProfile {
  id                String        @id @default(uuid())
  gameId            String?
  game              Game?         @relation(fields: [gameId], references: [id])
  gameName          String        // for games not in DB
  port              Int
  protocol          GameProtocol  @default(TCP)
  hostType          HostType      @default(LAN_HOST)
  serverFileUrl     String?       // official download URL for dedicated server
  serverFileName    String?       // e.g. "server.jar"
  setupInstructions String?       // markdown instructions
  isOfficial        Boolean       @default(false)
  createdAt         DateTime      @default(now())

  @@index([gameId])
}

enum GameProtocol {
  TCP
  UDP
  BOTH
}
```

Note: In Phase 1, all hosting profiles are official (created by admin/seed). Community submissions (`submittedById`, `status` field) deferred to Phase 2.

### Reverse Relations on Existing Models

Add to `User`:
```prisma
hostedRooms   Room[]        @relation("hostedRooms")
roomPlayers   RoomPlayer[]
roomMessages  RoomMessage[]
```

Add to `Game`:
```prisma
rooms            Room[]
hostingProfiles  GameHostingProfile[]
```

## Server Components

### 1. WebSocket Gateway (`server/src/ws/gateway.ts`)

New WebSocket layer on Fastify using `@fastify/websocket`.

**Authentication:** WebSocket upgrade request must include JWT token as query parameter: `ws://localhost:3001/ws?token=<jwt>`. The gateway verifies the token using the same `authPlugin` logic. Invalid/expired token → connection rejected with 401.

**Authorization per event:**
- `room:start-game` — only host (checked via `room.hostId === userId`)
- `room:kick` — only host
- `room:send-message` — any room member
- `room:ready` / `room:leave` — any room member

**Heartbeat/Reconnection:**
- Server sends `ping` every 30 seconds, expects `pong` within 10 seconds
- If no pong: mark player as `DISCONNECTED`, notify other room members
- Grace period: 60 seconds before auto-removing disconnected player from room
- WireGuard tunnel is independent of WebSocket — tunnel stays alive even if WS drops temporarily
- Client auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s)

**Message Format:** All WebSocket messages are JSON:

```typescript
// Envelope
{ type: string; payload: object }

// --- Server → Client ---

// room:player-joined
{ type: "room:player-joined", payload: {
  userId: string, username: string, avatarUrl: string | null,
  virtualIp: string, publicKey: string
}}

// room:player-left
{ type: "room:player-left", payload: {
  userId: string, reason: "left" | "kicked" | "disconnected"
}}

// room:player-ready
{ type: "room:player-ready", payload: {
  userId: string, ready: boolean
}}

// room:message
{ type: "room:message", payload: {
  id: string, userId: string | null, username: string | null,
  content: string, isSystem: boolean, createdAt: string
}}

// room:game-starting
{ type: "room:game-starting", payload: {
  hostType: "LAN_HOST" | "DEDICATED", port: number,
  hostVirtualIp: string
}}

// room:closed
{ type: "room:closed", payload: { reason: "host-left" | "host-closed" }}

// peer:signal
{ type: "peer:signal", payload: {
  fromUserId: string, publicKey: string,
  endpoint: string // "ip:port"
}}

// peer:connected
{ type: "peer:connected", payload: {
  userId: string, virtualIp: string, latencyMs: number
}}

// --- Client → Server ---

// room:join
{ type: "room:join", payload: { roomId: string, publicKey: string }}

// room:leave
{ type: "room:leave", payload: { roomId: string }}

// room:ready
{ type: "room:ready", payload: { roomId: string, ready: boolean }}

// room:send-message
{ type: "room:send-message", payload: { roomId: string, content: string }}

// room:start-game (host only)
{ type: "room:start-game", payload: { roomId: string }}

// room:kick (host only)
{ type: "room:kick", payload: { roomId: string, userId: string }}

// peer:offer
{ type: "peer:offer", payload: {
  roomId: string, targetUserId: string,
  publicKey: string, endpoint: string
}}

// peer:answer
{ type: "peer:answer", payload: {
  roomId: string, targetUserId: string,
  publicKey: string, endpoint: string
}}
```

### 2. REST API Routes (`server/src/routes/rooms.ts`)

All routes require authentication.

```
POST   /rooms                — Create room
GET    /rooms                — List rooms (friends' rooms with status WAITING/PLAYING)
GET    /rooms/:id            — Room detail with players
DELETE /rooms/:id            — Close room (host only)
PATCH  /rooms/:id            — Update room settings (host only)
GET    /rooms/:id/messages   — Chat history (paginated, last 100)
```

**Rate limiting:** Room creation: max 5 per hour per user.

### 3. Hosting Profiles Routes (`server/src/routes/hosting-profiles.ts`)

Phase 1: read-only (admin seeds the data).

```
GET    /hosting-profiles?gameId=  — Get approved profiles for a game
GET    /hosting-profiles          — List all approved profiles
```

### 4. Room Service (`server/src/services/room.service.ts`)

```typescript
createRoom(hostId, gameId?, gameName, name, maxPlayers, hostType, port?) -> Room
closeRoom(roomId, userId) -> void  // verifies host ownership
listRooms(userId) -> Room[]  // friends' WAITING/PLAYING rooms
joinRoom(roomId, userId, publicKey) -> RoomPlayer  // assigns virtualIp
leaveRoom(roomId, userId) -> void
kickPlayer(roomId, hostId, targetUserId) -> void
toggleReady(roomId, userId, ready) -> void
startGame(roomId, hostId) -> void  // sets status to PLAYING
```

## Tauri/Rust Components

### 1. WireGuard Tunnel Manager (`src-tauri/src/commands/tunnel.rs`)

```rust
#[tauri::command]
async fn create_tunnel(room_id: String, peers: Vec<PeerConfig>) -> Result<TunnelInfo, String>

#[tauri::command]
async fn destroy_tunnel(room_id: String) -> Result<(), String>

#[tauri::command]
async fn get_tunnel_status(room_id: String) -> Result<TunnelStatus, String>

#[tauri::command]
async fn get_peer_latency(room_id: String, peer_ip: String) -> Result<u32, String>
```

Uses `boringtun` crate for WireGuard userspace implementation.
Uses `wintun` crate for Windows virtual network adapter.

**Virtual IP allocation:** `10.13.37.x` range. Host gets `.1`, clients get sequential `.2` through `.254`. Max 253 players per room. Server assigns IPs in `joinRoom()`.

**WinTUN Driver Installation:**
- WinTUN is a lightweight kernel driver (~200KB) by the WireGuard project
- On first use, Stealike checks if WinTUN DLL exists in app directory
- If missing: downloads `wintun.dll` from official WireGuard source and places in app directory
- WinTUN does NOT require admin/UAC elevation when loaded as a DLL — unlike TAP adapters
- The `wintun` Rust crate loads the DLL at runtime, no system-wide driver installation needed
- If loading fails (antivirus block, missing DLL): show clear error with "WinTUN kurulumu gerekli" message and link to manual download

**Error Handling:**

| Error | User-facing message | Recovery |
|-------|-------------------|----------|
| WinTUN DLL not found | "Sanal ağ adaptörü bulunamadı. İndiriliyor..." | Auto-download from official source |
| WinTUN load failed | "Sanal ağ adaptörü yüklenemedi. Antivirüs engelliyor olabilir." | Show troubleshooting guide |
| Adapter creation failed | "Ağ adaptörü oluşturulamadı. Uygulamayı yönetici olarak çalıştırmayı deneyin." | Suggest admin restart |
| UDP hole punch failed | "Doğrudan bağlantı kurulamadı. Bağlantı türünüz desteklenmiyor olabilir." | Phase 2: TURN fallback |
| Peer unreachable | "Oyuncu bağlantısı kesildi." | Auto-retry 3 times, then mark DISCONNECTED |
| Port conflict | "Port {port} kullanımda. Farklı bir port deneyin." | Suggest alternative port |

### 2. Dedicated Server Manager (`src-tauri/src/commands/server_manager.rs`)

```rust
#[tauri::command]
async fn start_dedicated_server(
  game_id: String, exe_path: String, args: Vec<String>, port: u16
) -> Result<u32, String>  // returns process ID

#[tauri::command]
async fn stop_dedicated_server(process_id: u32) -> Result<(), String>

#[tauri::command]
async fn get_server_status(process_id: u32) -> Result<ServerStatus, String>
```

Uses `tokio::process::Command` for async process management with stdout/stderr capture. Emits `server-status` events to frontend (similar to existing `game-status` events in `launcher.rs`).

## Frontend Components

### 1. Multiplayer Page (`src/pages/MultiplayerPage.tsx`)

Main hub accessible from nav bar ("Multiplayer" / "Çok Oyunculu"). Sections:
- **My active rooms** — rooms you're currently in (rejoin button)
- **Friends hosting** — friends' WAITING rooms you can join
- **Create room** button → opens create room dialog

### 2. Room Page (`src/pages/RoomPage.tsx`)

Layout (as designed in lobby mockup):
- **Top bar:** room name, #code, visibility badge, settings gear (host only)
- **Game info strip:** game cover, player count, port, host type indicator
- **Left panel (280px):** player list (avatar, username, role, ping, status LED), empty slots, action buttons (Start Game / Ready / Leave)
- **Right panel (flex):** text chat with system messages, input field

### 3. WebSocket Store (`src/stores/roomStore.ts`)

Zustand store managing:
- **WebSocket connection:** connect/disconnect, auto-reconnect with backoff
- **Room state:** current room, players, messages
- **Tunnel state:** tunnel active, peer latencies, connection status
- **Actions:** joinRoom, leaveRoom, sendMessage, toggleReady, startGame, kickPlayer

Connection lifecycle:
1. `connect(token)` → opens WS with JWT query param
2. On `room:join` success → store updates players list
3. On incoming `peer:signal` → invokes Tauri `create_tunnel`
4. On `room:closed` / `room:leave` → invokes Tauri `destroy_tunnel`, disconnects WS
5. On WS drop → auto-reconnect, re-join room, tunnel stays alive

### 4. i18n Keys

All user-facing strings use translation keys. New namespace: `multiplayer.*`

```
multiplayer.title = "Multiplayer" / "Çok Oyunculu"
multiplayer.createRoom = "Create Room" / "Oda Oluştur"
multiplayer.joinRoom = "Join" / "Katıl"
multiplayer.friendsHosting = "Friends Hosting" / "Arkadaşların Oynuyor"
multiplayer.myRooms = "My Rooms" / "Odalarım"
multiplayer.noRooms = "No active rooms" / "Aktif oda yok"
room.players = "Players" / "Oyuncular"
room.chat = "Chat" / "Sohbet"
room.startGame = "Start Game" / "Oyunu Başlat"
room.ready = "Ready" / "Hazırım"
room.leave = "Leave Room" / "Odadan Ayrıl"
room.sendMessage = "Send" / "Gönder"
room.messagePlaceholder = "Type a message..." / "Mesaj yaz..."
room.host = "Host"
room.connecting = "Connecting..." / "Bağlanıyor..."
room.connected = "Connected" / "Bağlandı"
room.emptySlot = "Empty slot" / "Boş slot"
room.visibility.friends = "Friends Only" / "Arkadaşlara Özel"
room.hostType.lan = "LAN Host" / "LAN Host"
room.hostType.dedicated = "Dedicated Server" / "Özel Sunucu"
```

## Security

- **WireGuard encryption** — all game traffic encrypted with Curve25519 keys
- **Per-session keys** — new keypair generated for every room join, discarded on leave
- **Room codes** — 8-char alphanumeric (excludes I/O), ~34^8 = 1.78 trillion combinations
- **Rate limiting** — room creation: 5/hour, messages: 30/min, room joins: 20/hour
- **Host kick** — host can remove players from room
- **Block integration** — blocked users cannot join your rooms or see them
- **WebSocket auth** — JWT verified on upgrade, expired token = disconnected

## Future Phases (Brief Notes)

### Phase 2: Polish
- TURN relay fallback for strict NAT (custom relay forwarding encrypted WG packets, bandwidth-capped at 10Mbps per session)
- Invite links + public lobby browser
- Community hosting profile submissions with admin approval workflow
- Library game detail "Multiplayer" tab
- Dedicated server auto-download for popular games
- Notifications: `ROOM_INVITE`, `FRIEND_HOSTING`

### Phase 3: Advanced
- Auto-detect running game and suggest rooms
- Mod compatibility checking
- Room history / favorites
- Performance stats (ping graph, packet loss)
- Linux/Mac support (TUN adapter per-platform)

## Dependencies

### Rust (Cargo.toml)
- `boringtun` — WireGuard userspace implementation (Cloudflare)
- `wintun` — Windows TUN adapter DLL wrapper
- `x25519-dalek` — Curve25519 key generation
- `base64` — Key encoding for WireGuard

### Server (package.json)
- `@fastify/websocket` — WebSocket support for Fastify
- `nanoid` — Room code generation

### Frontend (package.json)
- No new dependencies — uses native WebSocket API via Zustand store
