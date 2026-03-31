# Otomatik Oyun Başlatma + NAT Traversal Tasarım Dokümanı

**Tarih:** 2026-03-31
**Durum:** Onaylandı, implementasyona hazır

---

## Kapsam

İki bağımsız ama ilişkili feature:

1. **Otomatik Oyun Başlatma** — Host "Başlat" dediğinde oyun server modunda açılır, client'lar otomatik bağlanır
2. **NAT Traversal** — STUN + UDP hole punching ile internet üzerinden P2P bağlantı

---

## Feature 1: Otomatik Oyun Başlatma

### Problem

`launch_game` Rust komutu oyunu hiçbir argüman olmadan başlatıyor. Oyun açılıyor ama:
- Host tarafında server başlamıyor
- Client tarafında otomatik bağlantı olmuyor

### Çözüm

`GameHostingProfile`'a launch args template'leri ekle, oyun başlatılırken placeholder'ları gerçek değerlerle değiştirip argüman olarak geç.

### Değişiklikler

#### 1. Schema — `GameHostingProfile`'a 2 alan

```prisma
model GameHostingProfile {
  // ... mevcut alanlar
  hostLaunchArgs    String?  @map("host_launch_args")    // "--host --port {port}"
  clientLaunchArgs  String?  @map("client_launch_args")  // "--connect {ip}:{port}"
}
```

Placeholder'lar:
- `{ip}` → host virtual IP (10.13.37.1)
- `{port}` → room port numarası

#### 2. Room oluşturma — Launch args'ı config'e kaydet

`CreateRoomModal` → `roomStore.createRoom()` akışında, seçilen profilin `hostLaunchArgs` ve `clientLaunchArgs` değerleri room oluştururken backend'e gönderilir. Server bunları room'un `config` JSON alanında saklar.

#### 3. Server broadcast — `room:game-starting` payload genişlet

```typescript
// handlers.ts — handleStartGame
broadcastToRoom(roomId, {
  type: "room:game-starting",
  payload: {
    roomId,
    hostType: room.hostType,
    port: room.port,
    hostVirtualIp: "10.13.37.1",
    hostLaunchArgs: room.config?.hostLaunchArgs || null,
    clientLaunchArgs: room.config?.clientLaunchArgs || null,
  },
});
```

#### 4. Rust `launch_game` — args parametresi ekle

```rust
pub async fn launch_game(
    app: AppHandle,
    db: State<'_, Db>,
    game_id: String,
    exe_path: String,
    args: Vec<String>,  // YENİ
) -> Result<u32, String> {
    let child = Command::new(&exe_path)
        .args(&args)  // YENİ
        .spawn()
        .map_err(|e| format!("Failed to launch: {}", e))?;
    // ... geri kalanı aynı
}
```

#### 5. Frontend store — Launch bilgisini kaydet

```typescript
// roomStore.ts — room:game-starting handler
case "room:game-starting": {
  const room = get().currentRoom;
  if (room) set({
    currentRoom: {
      ...room,
      status: "PLAYING" as const,
      config: {
        ...room.config,
        hostLaunchArgs: payload.hostLaunchArgs,
        clientLaunchArgs: payload.clientLaunchArgs,
        hostVirtualIp: payload.hostVirtualIp,
        gamePort: payload.port,
      },
    },
  });
  break;
}
```

#### 6. RoomPage — Template → args dönüşümü

```typescript
function buildLaunchArgs(template: string | null, ip: string, port: number): string[] {
  if (!template) return [];
  const resolved = template
    .replace(/\{ip\}/g, ip)
    .replace(/\{port\}/g, String(port));
  return resolved.split(/\s+/).filter(Boolean);
}

async function handleLaunchGame() {
  // ... mevcut oyun bulma mantığı
  const config = currentRoom.config || {};
  const template = isHost ? config.hostLaunchArgs : config.clientLaunchArgs;
  const args = buildLaunchArgs(
    template,
    config.hostVirtualIp || "10.13.37.1",
    config.gamePort || currentRoom.port || 0
  );
  await invoke("launch_game", { gameId: match.id, exePath: match.exe_path, args });
}
```

### Örnek Akış

```
Minecraft odası (port: 25565):
  Profile: hostLaunchArgs = "--port {port}", clientLaunchArgs = "--server {ip} --port {port}"

  Host başlatır → oyun "--port 25565" ile açılır → server modu
  Client'a sinyal → oyun "--server 10.13.37.1 --port 25565" ile açılır → otomatik bağlantı
```

---

## Feature 2: NAT Traversal (STUN + Hole Punching)

Handoff dokümanında (`2026-03-31-nat-traversal-handoff.md`) detaylı olarak tanımlanmış. Özet:

### Değişiklikler

#### 1. Yeni dosya: `src-tauri/src/tunnel/stun.rs`

STUN Binding Request gönderip XOR-MAPPED-ADDRESS parse eden basit client. Google/Cloudflare STUN sunucularını kullanır. Public IP:port döndürür.

#### 2. `tunnel/mod.rs` — TunnelInfo'ya `public_endpoint` ekle

```rust
pub struct TunnelInfo {
    // ... mevcut alanlar
    pub public_endpoint: String,  // "85.x.x.x:4521" veya fallback "0.0.0.0:PORT"
}
```

#### 3. `tunnel/adapter.rs` — STUN discovery + hole punch

- UDP socket açıldıktan sonra STUN ile public endpoint keşfet
- Peer endpoint bilindiğinde 3x boş UDP paketi gönder (hole punch)
- Public endpoint'i TunnelInfo'ya yaz

#### 4. Frontend — Public endpoint gönder

`roomStore.ts`'de endpoint olarak `tunnelInfo.public_endpoint` kullan (`0.0.0.0:PORT` yerine).

#### 5. Types — TunnelInfo type güncelle

`publicEndpoint` alanı ekle.

---

## Kurallar (Handoff'tan)

- Seed script ÇALIŞTIRMA
- Mevcut çalışan kodu BOZMA
- Her adımda `npx tsc --noEmit` + `cargo check` çalıştır
- LAN akışı korunmalı (NAT traversal başarısız olursa fallback)

---

## Değişecek Dosyalar Özeti

| # | Dosya | Feature | Değişiklik |
|---|-------|---------|-----------|
| 1 | `server/prisma/schema.prisma` | Auto-launch | +2 alan |
| 2 | `server/src/ws/handlers.ts` | Auto-launch | Broadcast payload genişlet |
| 3 | `src-tauri/src/commands/launcher.rs` | Auto-launch | args parametresi |
| 4 | `src/stores/roomStore.ts` | Her ikisi | Launch args + public endpoint |
| 5 | `src/pages/RoomPage.tsx` | Auto-launch | Template → args |
| 6 | `src/lib/types.ts` | Her ikisi | Type güncellemeleri |
| 7 | `src-tauri/src/tunnel/stun.rs` | NAT | YENİ: STUN client |
| 8 | `src-tauri/src/tunnel/mod.rs` | NAT | public_endpoint + pub mod stun |
| 9 | `src-tauri/src/tunnel/adapter.rs` | NAT | STUN discovery + hole punch |
| 10 | `src/components/CreateRoomModal.tsx` | Auto-launch | Launch args'ı room'a geçir |
