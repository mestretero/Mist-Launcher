# Multiplayer Lobi Basitleştirme — Oyuncu Arama İlan Sistemi

**Tarih:** 2026-03-31
**Durum:** Onaylandı

## Amaç

Tüm P2P/tunnel/NAT karmaşıklığını kaldırıp, çok oyunculu kısmını basit bir "oyuncu arama ilanı" sistemine çevirmek. Kullanıcı lobi açar, bilgilerini yazar (sunucu adresi, Discord linki, açıklama), diğer oyuncular katılıp sohbet eder, bağlantıyı kendileri kurar.

## Kaldırılanlar

- WinTUN tunnel, STUN, NAT traversal, UDP hole punching
- Otomatik oyun başlatma (launch args, dedicated server)
- hostType (LAN_HOST/DEDICATED), GameHostingProfile bağımlılığı
- Peer signaling (peer:offer, peer:answer, peer:signal)
- tunnelActive, virtualIp, publicKey, privateKey state'leri
- Frontend'den tunnel/peer Tauri komut çağrıları

## Kalan

- WebSocket + lobi sohbet
- Oda CRUD + hard delete
- Oyuncu listesi + hazır durumu
- Visibility (PUBLIC/FRIENDS/INVITE)
- Oyun filtresi

## Yeni Alanlar (Room.config JSON)

```json
{
  "serverAddress": "192.168.1.5:25565",
  "discordLink": "https://discord.gg/xxx",
  "description": "Level 10+ Türkçe bilen aranıyor"
}
```

## Değişiklikler

### Silinecek/Temizlenecek
- `roomStore.ts`: tunnel state, peer signaling, keypair, tunnel invoke'ları
- `handlers.ts`: peer:offer, peer:answer handlers
- `RoomPage.tsx`: tunnel/VPN indicator, handlePeerSignal, launch game logic
- `CreateRoomModal.tsx`: hostType, port, profile seçimi, launch args
- `room.service.ts`: hostType/launchArgs/serverFileName parametreleri

### Güncellenecek
- `CreateRoomModal.tsx`: serverAddress, discordLink, description alanları
- `MultiplayerPage.tsx`: yeni minimal tasarım
- `RoomPage.tsx`: bilgi kutusu (sunucu adresi kopyalanabilir, Discord tıklanabilir)
- `roomStore.ts`: basit state (wsConnected, currentRoom, rooms, messages)
- `room.service.ts`: config'e yeni alanlar
