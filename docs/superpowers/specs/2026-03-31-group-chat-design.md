# Grup Sohbeti Tasarım Dokümanı

**Tarih:** 2026-03-31
**Durum:** Onaylandı
**Referans:** `docs/superpowers/specs/2026-03-31-group-chat-handoff.md`

---

## Kapsam

Mevcut DM (direkt mesaj) sisteminin üzerine, birden fazla arkadaşı aynı anda içeren grup sohbeti özelliği eklenir. Mevcut DM akışına, lobi sistemine ve WS token mekanizmasına dokunulmaz.

---

## Veritabanı Şeması

### Yeni Modeller

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
  groupId  String    @map("group_id") @db.Uuid
  group    GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId   String    @map("user_id") @db.Uuid
  user     User      @relation("GroupMemberOf", fields: [userId], references: [id])
  joinedAt DateTime  @default(now()) @map("joined_at")

  @@id([groupId, userId])
  @@map("group_chat_members")
}

model GroupChatMessage {
  id        String    @id @default(uuid()) @db.Uuid
  groupId   String    @map("group_id") @db.Uuid
  group     GroupChat @relation(fields: [groupId], references: [id], onDelete: Cascade)
  senderId  String    @map("sender_id") @db.Uuid
  sender    User      @relation("GroupChatMessageSender", fields: [senderId], references: [id])
  content   String
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([groupId, createdAt])
  @@map("group_chat_messages")
}
```

**Tasarım kararları:**
- `GroupChatMember`'da composite PK (`groupId + userId`) kullanılır — UUID primary key gereksiz.
- Relation isimleri model ismiyle çakışmayacak şekilde seçildi: `"GroupMemberOf"` (üye), `"GroupChatCreator"` (yaratıcı), `"GroupChatMessageSender"` (mesaj gönderen).

### User Modeline Eklenecek Back-Relation Alanları

`schema.prisma`'daki `User` modeline aşağıdaki 3 satır eklenir (diğer relation'ların yanına):

```prisma
createdGroups       GroupChat[]          @relation("GroupChatCreator")
groupMemberships    GroupChatMember[]    @relation("GroupMemberOf")
sentGroupMessages   GroupChatMessage[]   @relation("GroupChatMessageSender")
```

---

## Backend

### Yeni Dosyalar

#### `server/src/services/group.service.ts`

Fonksiyonlar:
- `createGroup(creatorId, name, memberIds[])` — grup + üyeler oluştur, creator da üye olarak eklenir
- `getUserGroups(userId)` — kullanıcının tüm grupları (son mesaj bilgisi ile)
- `getGroupMessages(groupId, userId)` — üyelik doğrula, son 50 mesaj
- `sendMessage(groupId, senderId, content)` — üyelik doğrula, mesaj oluştur, sender bilgisi ile döndür
- `addMember(groupId, requesterId, newUserId)` — sadece creator ekleyebilir, arkadaşlık kontrolü
- `removeMember(groupId, requesterId, targetUserId)` — sadece creator çıkarabilir
- `leaveGroup(groupId, userId)` — herhangi bir üye ayrılabilir; creator ayrılırsa grup tüm üyeleriyle silinir
- `deleteGroup(groupId, requesterId)` — sadece creator silebilir
- `cleanupOldMessages()` — 8 saatten eski mesajları sil (DM cleanup ile aynı zamanda çalışır)

**Edge case:** `leaveGroup` ve `removeMember` fonksiyonları `group not found` / `user not member` durumları için hata fırlatır. Çağıran (route handler veya WS handler) bu hataları yakalar ve uygun HTTP/WS hata yanıtı döner. Race condition (creator ayrılırken başkası aynı gruba istek atar) Prisma'nın transaction + cascade delete ile handle edilir — sonraki istek `not found` alır.

#### `server/src/routes/groups.ts`

| Method | Path | Açıklama | Yetki |
|--------|------|----------|-------|
| `POST` | `/groups` | Grup oluştur | Auth |
| `GET` | `/groups` | Grupları listele | Auth |
| `GET` | `/groups/:id/messages` | Mesaj geçmişi | Üye |
| `POST` | `/groups/:id/messages` | Mesaj gönder | Üye |
| `POST` | `/groups/:id/members` | Üye ekle | Creator |
| `DELETE` | `/groups/:id/members/:userId` | Üyeyi çıkar | Creator |
| `DELETE` | `/groups/:id/leave` | Gruptan ayrıl | Üye |
| `DELETE` | `/groups/:id` | Grubu sil | Creator |

**Not:** "Ayrıl" için `/leave` yolu kullanılır (önceki `/members/me` değil). Bu, Fastify'da `/:userId` route'uyla çakışmayı önler.

### Değişen Dosyalar

#### `server/src/ws/handlers.ts`

WS handler'lar **sadece real-time broadcast** için kullanılır. Üyelik mutasyonları (ayrılma, çıkarma, silme) REST üzerinden yapılır — WS event'leri REST yanıtının arkasından broadcast edilir. Bu, DM sistemindeki mevcut pattern ile tutarlıdır.

`handleMessage` switch'e tek yeni case eklenir:

| WS Event (gelen) | İşlem | WS Event (gönderilen) |
|-----------------|-------|----------------------|
| `group:send` | Kullanılmaz (frontend REST kullanır) | — |

REST route handler'lar, işlem tamamlandıktan sonra WS gateway üzerinden broadcast yapar:

| REST Action | WS Broadcast |
|-------------|-------------|
| `POST /groups/:id/messages` | `group:message` → tüm online üyeler |
| `DELETE /groups/:id/members/:userId` | `group:member-kicked` → kicked user + diğerleri |
| `DELETE /groups/:id/leave` | `group:member-left` → diğer üyeler |
| `DELETE /groups/:id` | `group:deleted` → tüm üyeler |
| `POST /groups/:id/members` | `group:member-added` → tüm üyeler |

Bu yaklaşım REST'i canonical mutation path olarak belirler; WS sadece gerçek zamanlı bildirim kanalıdır.

#### `server/src/services/dm.service.ts`

`cleanupOldMessages()` fonksiyonuna grup mesaj temizliği eklenir — ayrı cron değil, aynı interval.

#### `server/prisma/schema.prisma`

3 yeni model + `User` modeline 3 yeni back-relation alanı eklenir (yukarıda belirtildi).

---

## Frontend

### Dosya Yapısı

**Yeni dosyalar:**
```
src/
  components/
    FriendsList.tsx       ← ChatPanel'den ayrılır: arkadaş listesi + context menu
    GroupList.tsx         ← Grup listesi bölümü ("GRUPLAR" header + group satırları)
    ChatView.tsx          ← ChatPanel'den ayrılır: DM chat görünümü
    GroupChatView.tsx     ← Grup mesajlaşma + üye yönetimi
    CreateGroupModal.tsx  ← Arkadaş seçimi (checkbox) + grup adı input
  stores/
    groupStore.ts         ← Grup state yönetimi
```

**Değişen dosyalar:**
```
src/
  components/
    ChatPanel.tsx         ← Sadece container (~80 satır); FriendsList + GroupList + ChatView/GroupChatView bağlar
  stores/
    dmStore.ts            ← Değişmez (sadece okunur)
    roomStore.ts          ← handleWsMessage'a group:* case'leri eklenir
  lib/
    api.ts                ← groups: { ... } namespace eklenir
    types.ts              ← Group, GroupMessage, GroupMember tipleri eklenir
  i18n/locales/
    en.json / tr.json / es.json / de.json  ← chat.* namespace'e yeni key'ler eklenir
```

### `groupStore.ts` State

```typescript
interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  groupMessages: GroupMessage[];
  unreadGroups: Set<string>;

  loadGroups(): Promise<void>;
  openGroup(group: Group): Promise<void>;
  closeGroup(): void;
  sendMessage(content: string): Promise<void>;
  receiveMessage(msg: GroupMessage): void;
  receiveMemberUpdate(update: GroupMemberUpdate): void;
  receiveGroupDeleted(groupId: string): void;
}
```

### UI Akışı

**Grup oluşturma:**
1. Arkadaş listesinde sağ tık → "Grup Sohbeti Oluştur"
2. `CreateGroupModal` açılır: arkadaş listesi (checkbox) + grup adı input
3. En az 1 arkadaş seçilmeli, isim zorunlu
4. Oluştur → `POST /groups` → `groupStore.loadGroups()` tetiklenir

**Mesajlaşma:**
1. "GRUPLAR" bölümünden gruba tıkla
2. `GroupChatView` sol panelde açılır (DM ile aynı slide animasyonu, aynı genişlik)
3. Mesaj gönderme: REST `POST /groups/:id/messages` (güvenilirlik), WS `group:message` echo ile real-time

**Grup yönetimi (`GroupChatView` içinde):**
- Header'da grup adı + ⚙️ ikonu
- ⚙️ tıklanınca üye listesi görünümüne geçilir (aynı panel içinde slide)
- Creator: her üye yanında "Çıkar" butonu + "Üye Ekle" butonu
- Herkes: "Gruptan Ayrıl" butonu (kırmızı, bottom)
- Creator ayrılırsa → grup silinir, tüm üyeler `group:deleted` ile bilgilendirilir, `receiveGroupDeleted()` grubu listeden kaldırır

### WS Entegrasyonu

`roomStore.ts`'deki `handleWsMessage` switch'e eklenir (mevcut `dm:message` pattern ile aynı dynamic import yaklaşımı):

```typescript
case "group:message":
  import("./groupStore").then(({ useGroupStore }) => {
    useGroupStore.getState().receiveMessage(payload);
  });
  // browser notification (tab arka plandaysa, mevcut DM notification pattern ile aynı)
  break;
case "group:member-left":
case "group:member-kicked":
case "group:member-added":
  import("./groupStore").then(({ useGroupStore }) => {
    useGroupStore.getState().receiveMemberUpdate(payload);
  });
  break;
case "group:deleted":
  import("./groupStore").then(({ useGroupStore }) => {
    useGroupStore.getState().receiveGroupDeleted(payload.groupId);
  });
  break;
```

### i18n Key'leri

4 dilde (`en`, `tr`, `es`, `de`) mevcut `chat` objesine eklenecek yeni key'ler:

```json
"chat": {
  "groups": "Groups",
  "noGroups": "No groups yet",
  "createGroup": "Create Group Chat",
  "groupName": "Group Name",
  "groupNamePlaceholder": "Enter group name...",
  "addMembers": "Add Members",
  "addMember": "Add Member",
  "removeMember": "Remove",
  "leaveGroup": "Leave Group",
  "deleteGroup": "Delete Group",
  "manageMembers": "Manage Members",
  "members": "Members",
  "creator": "Creator",
  "creatorLeaveWarning": "You are the creator. Leaving will delete the group for everyone.",
  "selectFriends": "Select friends to add",
  "atLeastOneMember": "Select at least one friend"
}
```

---

## Kritik Kısıtlar (Dokunulmayacaklar)

- `server/prisma/seed.ts` — ÇALIŞTIRMA
- Mevcut DM akışı (REST gönder + WS echo) — BOZMA
- ChatPanel accordion animasyonu (`cubic-bezier(0.22,1,0.36,1)`) — BOZMA
- WS token mekanizması (`getAccessToken` + `waitForWs`) — DEĞİŞTİRME
- Browser notification sistemi — BOZMA
- Lobi host koruması — KALDIRMA

---

## Doğrulama

Her adım sonrası:
```bash
cd e:/PROJELER/Stealike && npx tsc --noEmit
cd e:/PROJELER/Stealike/server && npx tsc --noEmit
```
