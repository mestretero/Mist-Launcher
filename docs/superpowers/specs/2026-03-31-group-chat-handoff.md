# Grup Sohbeti + Devam Eden İşler — Sonraki AI İçin Handoff Dokümanı

**Tarih:** 2026-03-31
**Durum:** DM sistemi çalışıyor, grup sohbeti eklenmeli
**Öncelik:** Bu dokümanı BAŞTAN SONA oku, hiçbir bölümü atlama.

---

## ⚠️ KRİTİK KURALLAR

1. **HİÇBİR ŞEYİ BOZMA.** Mevcut çalışan sistemi koru. Yeni kod ekle, mevcut kodu değiştirme (sadece gerekli yerlerde minimal değişiklik).
2. **Seed script'i ÇALIŞTIRMA.** `server/prisma/seed.ts` tüm oyunları siler. ASLA çalıştırma.
3. **Test et, commit et, sonra devam et.** Her adımda `npx tsc --noEmit` (frontend + server) çalıştır.
4. **Mevcut DM ve lobi sistemini BOZMA.** Her ikisi de çalışıyor — üstüne ekle.

---

## Mevcut Mimari (DOKUNMA)

### Teknoloji Stack
- **Frontend:** React 19 + Zustand + Tailwind CSS + Tauri 2
- **Backend:** Fastify 5 + TypeScript + PostgreSQL (Prisma 7)
- **Real-time:** WebSocket (@fastify/websocket) + REST API hibrit
- **i18n:** 4 dil (TR, EN, ES, DE) — `src/i18n/locales/*.json`

### Çalışan Sistemler

#### 1. Çok Oyunculu Lobi Sistemi
Kullanıcılar "oyuncu arama ilanı" şeklinde lobi açar. P2P/tunnel YOK — sadece bilgi paylaşımı + sohbet.

**Dosyalar:**
- `src/pages/MultiplayerPage.tsx` — Lobi listesi + filtreler (oyun, dil, visibility)
- `src/pages/RoomPage.tsx` — Lobi detay: oyuncu listesi + sohbet
- `src/components/CreateRoomModal.tsx` — Lobi oluşturma formu
- `src/stores/roomStore.ts` — Zustand store, WS bağlantısı, mesaj yönetimi
- `server/src/services/room.service.ts` — Room CRUD + mesajlar
- `server/src/ws/handlers.ts` — WS mesaj handler'ları
- `server/src/routes/rooms.ts` — REST endpoint'ler

**Özellikler:**
- Lobi oluştur (oyun adı, sunucu adresi, Discord linki, açıklama, dil, süre, randevu)
- Visibility: PUBLIC / FRIENDS / SCHEDULED (randevulu)
- Mesaj geçmişi kalıcı (DB'de, lobiye sonradan katılan görür)
- Host lobiden ayrılamaz (sadece "Lobiyi Kapat" ile silebilir)
- Otomatik süre dolumu (durationHours veya scheduledEnd)
- Filtreler: oyun, dil, visibility
- Host online durumu (yeşil dot)

#### 2. DM (Direkt Mesaj) Sistemi — Steam Tarzı
Sağ altta sabit panel. Arkadaş listesi + tıklayınca sola doğru chat açılır.

**Dosyalar:**
- `src/components/ChatPanel.tsx` — Sağ alt floating panel
- `src/stores/dmStore.ts` — DM state yönetimi
- `server/src/services/dm.service.ts` — DM CRUD + temizleme
- `server/src/routes/dm.ts` — DM REST endpoint'leri

**Özellikler:**
- Accordion animasyonla açılma/kapanma (max-height transition)
- Arkadaş listesi: Online/Offline bölümleri, yeşil dot
- Chat sola doğru genişler (width transition)
- Mesaj gönderme REST API ile (güvenilir), WS ile real-time echo
- 8 saatte bir eski mesajlar otomatik silinir
- Sağ tık context menu: "Profili Görüntüle" + "Mesaj Gönder"
- İsme tıklayınca profil sayfasına git
- Browser notification (tab arka plandayken)
- 4 dilde çeviriler

**DB Modeli:**
```prisma
model DirectMessage {
  id         String   @id @default(uuid()) @db.Uuid
  senderId   String   @map("sender_id") @db.Uuid
  sender     User     @relation("DMSender", fields: [senderId], references: [id])
  receiverId String   @map("receiver_id") @db.Uuid
  receiver   User     @relation("DMReceiver", fields: [receiverId], references: [id])
  content    String
  createdAt  DateTime @default(now()) @map("created_at")
}
```

#### 3. WebSocket Akışı
- `WsClient` (`src/lib/wsClient.ts`) — auto-reconnect, token auth
- `roomStore.connect(token)` — App.tsx'te auth sonrası çağrılır
- `handleWsMessage` — room:* ve dm:* event'leri yönetir
- WS token: `getAccessToken()` (`src/lib/api.ts`) ile alınır
- `waitForWs()` — join/send öncesi WS bağlantısını bekler (5s timeout)

#### 4. Arkadaşlık Sistemi
- `server/src/services/friendship.service.ts` — getFriends, searchUsers, sendRequest, acceptRequest
- `server/src/routes/friends.ts` — REST + online status enrich
- `isUserOnline()` / `getOnlineUserIds()` — WS gateway'den

---

## YAPILACAK: Grup Sohbeti

### Konsept
Kullanıcı arkadaş listesinde sağ tıklayınca "Grup Sohbeti Oluştur" seçeneği. Birden fazla arkadaşı seçip grup oluşturabilir. Mevcut ChatPanel içinde, DM'lerin yanında grup sohbetleri de gösterilir.

### Önerilen DB Modeli

```prisma
model GroupChat {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  creatorId String   @map("creator_id") @db.Uuid
  creator   User     @relation("GroupChatCreator", fields: [creatorId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  members  GroupChatMember[]
  messages GroupChatMessage[]

  @@map("group_chats")
}

model GroupChatMember {
  id        String   @id @default(uuid()) @db.Uuid
  groupId   String   @map("group_id") @db.Uuid
  group     GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  joinedAt  DateTime @default(now()) @map("joined_at")

  @@unique([groupId, userId])
  @@map("group_chat_members")
}

model GroupChatMessage {
  id        String   @id @default(uuid()) @db.Uuid
  groupId   String   @map("group_id") @db.Uuid
  group     GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  senderId  String   @map("sender_id") @db.Uuid
  sender    User     @relation(fields: [senderId], references: [id])
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  @@index([groupId, createdAt])
  @@map("group_chat_messages")
}
```

### Önerilen Akış

1. **Grup oluşturma:**
   - Sağ tık → "Grup Sohbeti Oluştur" → arkadaş seçim modal'ı açılır
   - Birden fazla arkadaş seçilir + grup adı girilir → oluştur
   - REST: `POST /groups` → { name, memberIds: string[] }

2. **Grup mesajlaşma:**
   - ChatPanel'de gruplar DM'lerin yanında listelenir (ayrı bölüm veya karışık)
   - Grup tıklanınca chat açılır (aynı sol panel)
   - Mesaj gönderme: REST `POST /groups/:id/messages`
   - Real-time: WS `group:send` → tüm üyelere `group:message` broadcast

3. **Grup yönetimi:**
   - Üye ekleme/çıkarma (sadece creator)
   - Gruptan ayrılma
   - Grup silme (creator)

4. **ChatPanel değişiklikleri:**
   - Arkadaş listesinin altına "GRUPLAR" bölümü ekle
   - Sağ tık menüsüne "Grup Sohbeti Oluştur" ekle
   - `dmStore.ts`'ye grup state'leri ekle (veya ayrı `groupStore.ts`)

5. **Mesaj temizleme:**
   - Grup mesajları da 8 saatte bir silinsin (DM ile aynı)

### Dikkat Edilecekler
- ChatPanel.tsx zaten karmaşık — grup eklerken dosyayı bölmeyi düşün (ChatPanel, FriendsList, ChatView, GroupView gibi)
- WS handler'ları (`handlers.ts`) group:* event'leri için yeni case'ler ekle
- i18n: 4 dilde yeni key'ler ekle (chat.createGroup, chat.groupName, chat.addMembers vs.)
- Context menu'ye "Grup Sohbeti Oluştur" seçeneği ekle
- `dmStore.ts` veya yeni `groupStore.ts` — grup state yönetimi

---

## Dosya Haritası

```
src/
  components/
    ChatPanel.tsx         ← Sağ alt floating panel (DM + gelecekte grup)
    CreateRoomModal.tsx   ← Lobi oluşturma modal'ı
  stores/
    roomStore.ts          ← Lobi + WS bağlantısı
    dmStore.ts            ← DM state (arkadaşlar, mesajlar, panel)
    authStore.ts          ← Kullanıcı oturumu
  pages/
    MultiplayerPage.tsx   ← Lobi listesi
    RoomPage.tsx          ← Lobi detay + sohbet
  lib/
    api.ts                ← REST API client (rooms, dm, friends)
    wsClient.ts           ← WebSocket wrapper
    types.ts              ← TypeScript interfaces

server/src/
  ws/
    gateway.ts            ← WS server, client registry, online status
    handlers.ts           ← WS mesaj handler'ları (room:*, dm:*)
  services/
    room.service.ts       ← Lobi CRUD + mesajlar + cleanup
    dm.service.ts         ← DM CRUD + cleanup
    friendship.service.ts ← Arkadaşlık CRUD
  routes/
    rooms.ts              ← Lobi REST endpoint'leri
    dm.ts                 ← DM REST endpoint'leri
    friends.ts            ← Arkadaşlık REST + online status
```

---

## Test Etme

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit

# Full build
npm run tauri dev
```

---

## DOKUNMA Listesi

- `server/prisma/seed.ts` — ÇALIŞTIRMA, tüm oyunları siler
- Mevcut DM akışı (REST gönder + WS echo) — BOZMA
- Lobi host koruması (host leave edemez) — KALDIRMA
- WS token mekanizması (`getAccessToken` + `waitForWs`) — DEĞİŞTİRME
- ChatPanel accordion animasyonu — BOZMA
- Browser notification sistemi — BOZMA
- 4 dil desteği — YENİ KEY'LER EKLERKEN 4 DİLDE DE EKLE
