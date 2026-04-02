# Profil Sayfası Gerçek Veri Tasarımı

**Tarih:** 2026-03-29
**Durum:** Onaylandı
**Kapsam:** Profil bloklarının gerçek oyun verileriyle çalışması, yerel oyun senkronizasyonu

---

## Problem

Profil sayfasında üç temel sorun var:

1. **Favori Oyun / Oyun Vitrini blokları "Oyun seçilmedi" gösteriyor** — Blok config'inde `gameId` olarak LibraryItem UUID saklanıyor, ama `library-summary` endpoint'i Game UUID döndürüyor. ID uyuşmazlığı.
2. **İstatistikler yanlış veri gösteriyor** — `library.service.ts`'deki fallback, kullanıcının kütüphanesi boşsa TÜM kullanıcıların oyunlarını döndürüyor.
3. **Yerel oyunlar başka kullanıcılar tarafından görülemiyor** — Yerel oyun verileri sadece SQLite'da, sunucuda karşılığı yok.

## Kararlar

| Karar | Seçilen | Neden |
|-------|---------|-------|
| Yerel oyun verisini profilde gösterme | Sunucuya metadata senkronizasyonu | Kullanıcı zaten bloğa koyup koymamayı seçiyor |
| Senkronizasyon zamanlaması | Uygulama açılışı + oyun kapatıldığında | Gereksiz istek yok, doğal anlar yakalanır |
| ID standardizasyonu | Tüm ID'ler Game UUID / Cache UUID | Blok bileşenleri kaynak farkı bilmeden çalışır |
| Gizlilik | exePath hash'lenir, ham yol sunucuya gitmez | KURALLAR.md Kural 10 uyumu |

---

## 1. Veritabanı: `ProfileGameCache` Tablosu

Kullanıcının yerel oyunlarının görüntüleme metadata'sını sunucuda tutar.

```prisma
model ProfileGameCache {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  title        String
  coverUrl     String?   @map("cover_url")
  playTimeMins Int       @default(0) @map("play_time_mins")
  exePathHash  String    @map("exe_path_hash")
  source       String    @default("local")
  lastPlayedAt DateTime? @map("last_played_at")
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, exePathHash])
  @@index([userId])
  @@map("profile_game_cache")
}
```

**User modeline eklenmesi gereken relation:**
```prisma
// User modeline ekle:
profileGameCache ProfileGameCache[]
```

**Gizlilik (KURALLAR.md Kural 10):**
- `exePathHash`: Client tarafında `sha256(exePath)` hesaplanır, sunucuya yalnızca hash gönderilir
- Ham dosya yolu (`D:/Games/Minecraft/minecraft.exe`) sunucuya **asla** gitmez
- Hash, aynı oyunun tekrar eklenmesini önlemek için benzersiz anahtar olarak kullanılır
- Sadece görüntüleme metadata'sı (title, coverUrl, playTimeMins) sunucuya senkronize edilir

**Notlar:**
- Mağaza oyunları bu tabloya girmez — onlar LibraryItem + Game tablolarında
- `source` alanı ileride genişletilebilir ("local", "manual" vs.)

---

## 2. Senkronizasyon Akışı

### 2a. Uygulama Açılışında — Toplu Senkronizasyon

```
POST /profiles/me/sync-games
Authorization: Bearer <token>
Body: [
  { title: "Minecraft", coverUrl: "https://...", playTimeMins: 845, exePathHash: "a1b2c3...", lastPlayedAt: "2026-03-28T..." },
  ...
]
Limit: Maksimum 500 öğe

Response: {
  data: [
    { id: "uuid-1", title: "Minecraft", exePathHash: "a1b2c3..." },
    ...
  ]
}
```

**Sunucu mantığı:**
- `exePathHash` eşleşen kayıt varsa → `playTimeMins`, `lastPlayedAt`, `title`, `coverUrl` güncelle
- Yoksa → yeni kayıt oluştur (UUID ata)
- Sunucuda olup gelen listede olmayan → soft-delete: `deletedAt = now()` olarak işaretle. Tekrar gelirse `deletedAt = null` yapılır. 30 gün sonra `deletedAt` dolu ve eski olan kayıtlar temizlenir. Hemen silmemek veri kaybını önler (SQLite bozulma, kısmi okuma gibi durumlar).
- Response: atanan UUID'leri döndür
- **Validasyon:** Dizi max 500 öğe, her öğede `title` ve `exePathHash` zorunlu

**Hash hesaplama (client-side):**
```typescript
async function hashExePath(exePath: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(exePath);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### 2b. Oyun Kapatıldığında — Tekil Güncelleme

```
PATCH /profiles/me/sync-games
Authorization: Bearer <token>
Body: { exePathHash: "a1b2c3...", playTimeMins: 860, lastPlayedAt: "2026-03-29T..." }

Response: { data: { id: "uuid-1", playTimeMins: 860 } }
```

**Upsert davranışı:** Hash sunucuda yoksa yeni kayıt oluşturulur (title olmadan gelirse "Unknown Game" atanır). Bu, toplu sync'ten önce oyun kapanırsa veri kaybını önler.

**Tetikleme noktası:** `launcher.rs` oyun kapatıldığında SQLite'a play_time yazıyor → frontend Tauri event alıyor → sunucuya PATCH gönderir.

### 2c. Hata Durumları ve Çevrimdışı Davranış

- **Uygulama açılışında sunucu erişilemezse:** Sync sessizce başarısız olur. Yerel veri otoriter kalır. Sonraki açılışta tekrar denenir.
- **Oyun kapandığında PATCH başarısız olursa:** Başarısız sync `localGameStore`'da `pendingSyncs` listesine eklenir. Sonraki uygulama açılışında toplu sync ile birlikte gönderilir.
- **Sunucu cache'i her zaman "best-effort":** Profil görüntülemede cache verisi kullanılır, eksik olabilir. Kritik veri kaybı olmaz çünkü yerel SQLite otoriter kaynak olarak kalır.

---

## 3. Library Summary Endpoint Güncellemesi

`GET /profiles/:username/library-summary` her iki kaynağı birleştirir.

**Kimlik doğrulama:** Opsiyonel auth kullanır — token varsa `viewerId` çıkarılır, yoksa `undefined` kalır. Bu sayede FRIENDS/PRIVATE visibility doğru çalışır.

```typescript
// Mağaza oyunları
const storeItems = await prisma.libraryItem.findMany({
  where: { userId: user.id },
  include: { game: { select: { id, title, coverImageUrl } } }
});

// Yerel oyunlar (cache)
const localItems = await prisma.profileGameCache.findMany({
  where: { userId: user.id }
});

// Birleşik libraryItems
const libraryItems = [
  ...storeItems.map(i => ({
    id: i.game.id, title: i.game.title, coverUrl: i.game.coverImageUrl,
    playTime: i.playTimeMins, source: "store"
  })),
  ...localItems.map(i => ({
    id: i.id, title: i.title, coverUrl: i.coverUrl,
    playTime: i.playTimeMins, source: "local"
  })),
];

// Stats: her iki kaynağın toplamı
const stats = {
  games: storeItems.length + localItems.length,
  hours: Math.round(totalMins / 60),
  achievements: achievementCount
};

// Recently played: her iki kaynaktan, lastPlayedAt'e göre sıralı
const recentlyPlayed = allItems
  .filter(i => i.lastPlayedAt)
  .sort((a, b) => b.lastPlayed - a.lastPlayed)
  .slice(0, 10)
  .map(i => ({
    id: i.id, title: i.title, coverUrl: i.coverUrl,
    playTime: i.playTime, lastPlayed: i.lastPlayedAt, source: i.source
  }));
```

---

## 4. ID Standardizasyonu

### Mevcut Sorun
- ProfilePage `getExtraProps`'ta `libraryItems` oluştururken `id: item.id` (LibraryItem UUID) kullanıyor
- Blok config'inde `gameId: item.id` (LibraryItem UUID) saklanıyor
- `library-summary` endpoint'i `id: item.game.id` (Game UUID) döndürüyor
- ID'ler eşleşmiyor

### Çözüm
- **Tüm `libraryItems` mapping'lerinde `id: Game.id` kullan** (mağaza oyunları için)
- **Yerel oyunlar için `id: ProfileGameCache.id` kullan**
- ProfilePage `getExtraProps`'taki mapping güncellenir

### Mevcut Config Migration
Mevcut blok config'lerinde saklanan LibraryItem UUID'leri Game UUID'lerine dönüştüren bir data migration scripti yazılır:
```sql
-- Migration: ProfileBlock config'lerindeki gameId'leri LibraryItem.id → Game.id olarak güncelle
UPDATE profile_blocks SET config = jsonb_set(
  config, '{gameId}',
  (SELECT to_jsonb(li.game_id::text) FROM library_items li WHERE li.id::text = config->>'gameId')
)
WHERE type IN ('FAVORITE_GAME')
  AND config->>'gameId' IS NOT NULL
  AND EXISTS (SELECT 1 FROM library_items li WHERE li.id::text = config->>'gameId');
```
`GAME_SHOWCASE` blokları için `gameIds` dizisi benzer şekilde güncellenir.

---

## 5. ProfilePage Sadeleştirme

ProfilePage şu an kendi verisini `api.library.list()` + `localGameStore` ile ayrı ayrı hesaplıyor. Bunun yerine:

- ProfilePage de `library-summary` endpoint'ini kullanır (kendi username'iyle çağırır)
- Tek veri kaynağı, tek ID formatı
- Stats hesaplama sunucuda merkezileşir
- `localGameStore` sadece oyun tarama/başlatma için kullanılır, profil blokları için değil

---

## 6. Bug Fix'ler

### 6a. Library Service Fallback Kaldırma
`library.service.ts`'deki "demo fallback" kodu silinir:
```typescript
// SİLİNECEK: Yanlış veri üretiyor
if (items.length === 0) {
  return prisma.libraryItem.findMany({...});
}
```

### 6b. Login/Register Response (Zaten Yapıldı)
`auth.service.ts`'deki `loginUser` ve `registerUser` response'larına `avatarUrl`, `bio` ve diğer eksik alanlar eklendi.

### 6c. ProfilePage loadSession (Zaten Yapıldı)
ProfilePage mount'ta `loadSession()` çağrısı eklenerek en güncel user verisi garanti edildi.

---

## 7. i18n Gereksinimleri

Yeni UI metinleri (varsa) 4 dilde (TR/EN/DE/ES) eklenmelidir. Bu tasarımda potansiyel yeni stringler:
- Blok bileşenlerinde `source` göstergesi gerekirse ("Yerel Oyun" / "Local Game" / "Lokales Spiel" / "Juego Local") — ancak mevcut tasarımda source göstergesi planlanmıyor, bloklar kaynak farkı bilmeden çalışır.
- Sync hata mesajları frontend'de toast olarak gösterilmez (sessiz başarısızlık), yeni string gerekmez.

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `server/prisma/schema.prisma` | ProfileGameCache modeli + User relation eklenir |
| `server/prisma/migrations/` | Yeni migration + config ID migration scripti |
| `server/src/services/profile.service.ts` | getLibrarySummary güncellenir, syncGames/syncGame eklenir |
| `server/src/routes/profiles.ts` | POST/PATCH sync-games route'ları, library-summary opsiyonel auth |
| `server/src/services/library.service.ts` | Fallback kaldırılır |
| `src/lib/api.ts` | syncGames, syncGame methods eklenir |
| `src/pages/ProfilePage.tsx` | library-summary kullanır, getExtraProps ID fix |
| `src/pages/UserProfilePage.tsx` | Zaten library-summary kullanıyor, değişiklik yok |
| `src-tauri/src/commands/launcher.rs` | Oyun kapandığında frontend'e event gönderir (mevcut) |
| `src/stores/localGameStore.ts` | Uygulama açılışında sync tetiklenir, pendingSyncs desteği |
