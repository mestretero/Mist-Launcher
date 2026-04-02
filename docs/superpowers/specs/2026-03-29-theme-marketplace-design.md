# Tema Pazarı ve SC Sistemi Tasarımı

**Tarih:** 2026-03-29
**Durum:** Onaylandı
**Kapsam:** Profil tema mağazası, Stealike Coin (SC) sistemi, günlük giriş bonusu

---

## Problem

- Profil temaları 4 hardcoded picsum.photos URL'sinden oluşuyor — gerçek görseller yok
- Tema satın alma mekanizması yok
- Sanal para sistemi altyapısı var ama kullanılmıyor (walletBalance, WalletTransaction)
- Kullanıcıların kazanım motivasyonu yok

## Kararlar

| Karar | Seçilen | Neden |
|-------|---------|-------|
| Para birimi | SC (Stealike Coin), ileride ismi değiştirilebilir | Hayali para, tek constant'tan yönetilir |
| Tema fiyatları | Hepsi 200 SC (ücretsizler 0 SC) | Basit, adil, bir fotoğraf için kademeli fiyat gereksiz |
| SC kazanım | Kayıt 500 SC + günlük giriş 50 SC + referans + admin | Çoklu motivasyon |
| Tema depolama | DB'de Theme modeli, görseller static dosya | Temalar sabit, dinamik ekleme kolay |

---

## 1. Veritabanı

### WalletTxType Enum Güncelleme

Mevcut enum'a yeni değerler eklenir:
```prisma
enum WalletTxType {
  DEPOSIT
  PURCHASE
  REFERRAL_EARNING
  REFUND
  THEME_PURCHASE
  DAILY_BONUS
  SIGNUP_BONUS
}
```

### Theme Modeli

```prisma
model Theme {
  id          String      @id
  name        String
  imageUrl    String      @map("image_url")
  price       Int         @default(200)
  category    String      @default("game")
  isActive    Boolean     @default(true) @map("is_active")
  createdAt   DateTime    @default(now()) @map("created_at")

  purchases   UserTheme[]

  @@map("themes")
}
```

**Notlar:**
- `id` slug formatında: `"witchers-path"`, `"night-city-v"` vb.
- `price`: 0 = ücretsiz, 200 = satılık (SC cinsinden, Int)
- `category`: `"default"` (ücretsiz), `"game"`, `"crossover"`
- `isActive`: Temayı pazardan kaldırmak için (sahiplik korunur)
- Görseller `server/public/themes/` altında static dosya

### UserTheme Modeli (Satın Alma Kaydı)

```prisma
model UserTheme {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  themeId     String   @map("theme_id")
  purchasedAt DateTime @default(now()) @map("purchased_at")

  user  User  @relation(fields: [userId], references: [id])
  theme Theme @relation(fields: [themeId], references: [id])

  @@unique([userId, themeId])
  @@index([userId])
  @@map("user_themes")
}
```

**User modeline eklenmesi gereken relation:**
```prisma
userThemes UserTheme[]
```

**User modeline eklenmesi gereken alan (günlük bonus takibi):**
```prisma
lastDailyBonus DateTime? @map("last_daily_bonus")
```
Günlük bonus tarihini type-safe şekilde User modelinde tutarız — preferences JSON'da değil. Bu sayede client-side manipülasyon riski ortadan kalkar.

### Decimal vs Int Uyumu

`User.walletBalance` mevcut `Decimal(10,2)` tipinde kalır. Tema fiyatları `Int` olarak tanımlanır. Karşılaştırmalarda `Number(user.walletBalance) >= theme.price` kullanılır. SC tamamen sanal ve tam sayı olsa da mevcut walletBalance migration'ı gereksiz karmaşıklık ekler — Decimal Int'i kapsadığı için sorun olmaz.

### Seed Data

18 tema seed olarak eklenir:

| ID | Ad | Fiyat | Kategori |
|----|-----|-------|----------|
| midnight-bus-stop | Midnight Bus Stop | 0 | default |
| night-city-v | Night City | 0 | default |
| witchers-path | Witcher's Path | 0 | default |
| red-dead-sunset | Red Dead Sunset | 0 | default |
| elden-ring-tarnished | Elden Ring | 200 | game |
| assassins-creed-firenze | Assassin's Creed | 200 | game |
| god-of-war-ragnarok | God of War | 200 | game |
| gta-v-trio | GTA V | 200 | game |
| horror-crossover | Horror Night | 200 | crossover |
| internet-cafe-chaos | Internet Cafe | 200 | crossover |
| kitchen-mayhem | Kitchen Mayhem | 200 | crossover |
| legends-tavern | Legends' Tavern | 200 | crossover |
| villains-feast | Villains' Feast | 200 | crossover |
| villains-poker-night | Poker Night | 200 | crossover |
| gaming-legends-assembled | Gaming Legends | 200 | crossover |
| covert-ops | Covert Ops | 200 | crossover |
| pixel-subway | Pixel Subway | 200 | crossover |
| ultimate-battlefield | Ultimate Battlefield | 200 | crossover |

---

## 2. SC (Stealike Coin) Sistemi

### Para Birimi Adı Değiştirilebilirlik

Frontend'de tek bir constant dosyası:
```typescript
// src/lib/constants.ts
export const CURRENCY_NAME = "SC";
export const CURRENCY_FULL_NAME = "Stealike Coin";
```

Server'da da:
```typescript
// server/src/lib/constants.ts
export const CURRENCY_NAME = "SC";
```

Tüm UI ve backend description string'leri bu constant'ları kullanır. İleride isim değişikliği iki dosyadan yapılır.

### Mevcut Altyapı Değişiklikleri

- `User.walletBalance` → SC bakiyesi olarak kullanılır (Decimal tipi aynı kalır)
- `WalletTransaction` → yeni type'lar: `THEME_PURCHASE`, `DAILY_BONUS`, `SIGNUP_BONUS`
- `WalletTransaction.referenceId` → tema satın almada `themeId` saklanır
- `POST /wallet/deposit` → Admin SC yükleme (mevcut endpoint)
- `server/src/services/wallet.service.ts` → hardcoded "TL" string'leri `CURRENCY_NAME` ile değiştirilir

### Frontend Label Değişikliği

Mevcut "TL" gösterimleri → `CURRENCY_NAME` constant'ı ile değiştirilir:
- TopBar profil dropdown'daki bakiye
- Cüzdan geçmişi

---

## 3. SC Kazanım Mekanikleri

### 3a. Kayıt Bonusu (500 SC)

`registerUser()` içinde:
- Kullanıcı oluşturulurken `walletBalance: 500` set edilir
- WalletTransaction kaydı: `{ type: "SIGNUP_BONUS", amount: 500, description: "Welcome bonus" }`

### 3b. Günlük Giriş Bonusu (50 SC)

Login başarılı olduğunda:
1. `user.lastDailyBonus` kontrol edilir (User modelindeki dedicated DateTime? alanı)
2. Bugünün tarihiyle karşılaştırılır (UTC gün bazında)
3. Farklıysa → 50 SC eklenir, WalletTransaction yazılır (`type: "DAILY_BONUS"`), `lastDailyBonus` güncellenir
4. Aynıysa → atlanır (sessiz)
5. Login response'una `dailyBonusAwarded: true/false` eklenir
6. Frontend: `dailyBonusAwarded === true` ise toast gösterilir

**Güvenlik:** `lastDailyBonus` User modelinde dedicated alan olduğu için, preferences update endpoint'i ile manipüle edilemez.

### 3c. Referans Kazanımı

Mevcut referral sistemi aynen SC ile çalışır. Değişiklik gerekmez.

---

## 4. API Endpoint'leri

### Tema Listesi (Public)
```
GET /marketplace/themes
Response: { data: Theme[] }
```
Sadece `isActive: true` olan temalar döner.

### Kullanıcının Sahip Olduğu Temalar
```
GET /marketplace/my-themes
Auth: Required
Response: { data: string[] }  // satın alınan tema ID'leri + ücretsiz tema ID'leri birleşik
```
Response, `price === 0` olan temaları otomatik olarak dahil eder. Frontend ayrıca kontrol yapmak zorunda kalmaz.

### Tema Satın Alma
```
POST /marketplace/themes/:id/purchase
Auth: Required
Response: { data: { success: true, newBalance: number } }
Errors:
  - 400: "Already owned"
  - 400: "Insufficient SC balance"
  - 404: "Theme not found"
```

**Satın alma mantığı (atomik `prisma.$transaction` içinde):**

Mevcut `wallet.service.deduct()` kullanılmaz — race condition riski var. Marketplace service kendi atomik transaction'ını yazar:

```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (Number(user.walletBalance) < theme.price) throw badRequest("Insufficient SC");

  const existing = await tx.userTheme.findUnique({ where: { userId_themeId: { userId, themeId } } });
  if (existing) throw badRequest("Already owned");

  const newBalance = Number(user.walletBalance) - theme.price;
  await tx.user.update({ where: { id: userId }, data: { walletBalance: newBalance } });
  await tx.userTheme.create({ data: { userId, themeId } });
  await tx.walletTransaction.create({
    data: {
      id: randomUUID(), userId, amount: -theme.price,
      type: "THEME_PURCHASE", referenceId: themeId,
      balanceAfter: newBalance, description: `Theme: ${theme.name}`
    }
  });
  return newBalance;
});
```

Ücretsiz temalar `GET /marketplace/my-themes`'de otomatik dahil olduğu için satın alma gerekmez. Ücretsiz tema satın almaya çalışılırsa sessizce başarılı döner (400 hatası yerine, UX dostu).

---

## 5. Pazar Sayfası (MarketplacePage)

### Navigasyon
- TopBar'a yeni menü öğesi: **"PAZAR"** (text, ikon değil, diğer nav item'lar gibi)
- `App.tsx`'te yeni route: `marketplace`

### Sayfa Yapısı
- Üst bar: Sayfa başlığı + SC bakiye göstergesi (sağ üst)
- Filtre sekmeleri: Tümü / Oyun / Crossover / Sahip Olunanlar
- Grid layout: 3 sütun (lg), 2 sütun (md), 1 sütun (sm)

### Tema Kartı
- Arka plan: Tema görseli (küçültülmüş, aspect-ratio 16:9)
- Alt kısım: Tema adı + kategori etiketi
- Buton durumları:
  - Ücretsiz tema → "Ücretsiz" (mavi badge, tıklanamaz)
  - Satın alınmış → "Sahipsin" (yeşil tik)
  - Satın alınabilir → "200 SC" butonu
  - Bakiye yetersiz → disabled buton "Yetersiz SC"

### Tema Önizleme Modal
- Karta tıklayınca modal açılır
- Tam boyut tema görseli
- Tema adı, kategori, fiyat bilgisi
- Satın al butonu (veya "Sahipsin" durumu)
- Satın alma sonrası başarı toast'ı

---

## 6. Profil Tema Seçici Güncellemesi

### ProfilePage
- Mevcut hardcoded `THEMES` dizisi kaldırılır
- Sunucudan tema listesi + sahip olunan temalar çekilir
- Tema seçicide:
  - Sahip olunan temalar → seçilebilir
  - Sahip olunmayan temalar → kilit ikonu + "Pazara Git" linki
  - Ücretsiz temalar `my-themes` response'unda zaten dahil

### UserProfilePage
- Mevcut `bannerTheme` alanı tema slug'ına map'lenir
- Tema görseli `http://localhost:3001/public/themes/{slug}.jpeg` URL'sinden yüklenir

### Mevcut Tema Değerleri Migration

Eski `bannerTheme` string değerleri yeni slug'lara eşleştirilir:
```sql
UPDATE user_profiles SET banner_theme = 'midnight-bus-stop' WHERE banner_theme = 'default';
UPDATE user_profiles SET banner_theme = 'night-city-v' WHERE banner_theme = 'cyber';
UPDATE user_profiles SET banner_theme = 'witchers-path' WHERE banner_theme = 'nature';
UPDATE user_profiles SET banner_theme = 'red-dead-sunset' WHERE banner_theme = 'mech';
```

Eski `preferences.profileThemeIndex` değeri artık kullanılmaz — `bannerTheme` slug tek kaynak olur. ProfilePage `profileThemeIndex` yerine `bannerTheme` kullanacak şekilde güncellenir.

---

## 7. i18n

Yeni key'ler 4 dilde eklenir (TR/EN/DE/ES):
- `nav.marketplace` → "Pazar" / "Marketplace" / "Marktplatz" / "Mercado"
- `marketplace.title` → sayfa başlığı
- `marketplace.buy` → "Satın Al" / "Buy" / "Kaufen" / "Comprar"
- `marketplace.owned` → "Sahipsin" / "Owned" / "Besitzt" / "Adquirido"
- `marketplace.free` → "Ücretsiz" / "Free" / "Kostenlos" / "Gratis"
- `marketplace.insufficientBalance` → "Yetersiz SC"
- `marketplace.purchaseSuccess` → "Tema satın alındı!"
- `marketplace.all` / `marketplace.games` / `marketplace.crossovers` / `marketplace.myThemes` → filtre sekmeleri
- `marketplace.dailyBonus` → "Günlük 50 SC kazandın!"
- `marketplace.preview` → "Önizleme" / "Preview" / "Vorschau" / "Vista previa"
- Kategori isimleri: `marketplace.categoryGame`, `marketplace.categoryCrossover`, `marketplace.categoryDefault`

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `server/prisma/schema.prisma` | Theme, UserTheme modelleri + User relation + lastDailyBonus + WalletTxType enum |
| `server/prisma/seed.ts` | 18 tema seed verisi |
| `server/prisma/migrations/` | Yeni migration + bannerTheme data migration |
| `server/src/lib/constants.ts` | Yeni: CURRENCY_NAME |
| `server/src/services/marketplace.service.ts` | Yeni: tema listesi, satın alma, sahiplik kontrolü |
| `server/src/routes/marketplace.ts` | Yeni: GET /themes, GET /my-themes, POST /purchase |
| `server/src/services/auth.service.ts` | Kayıt bonusu (500 SC) + günlük giriş bonusu (50 SC) |
| `server/src/services/wallet.service.ts` | "TL" → CURRENCY_NAME değişikliği |
| `server/src/index.ts` | marketplace route kaydı |
| `src/lib/constants.ts` | Yeni: CURRENCY_NAME, CURRENCY_FULL_NAME |
| `src/lib/api.ts` | marketplace API methods |
| `src/pages/MarketplacePage.tsx` | Yeni: pazar sayfası |
| `src/pages/ProfilePage.tsx` | Tema seçici güncelleme (DB'den tema listesi) |
| `src/pages/UserProfilePage.tsx` | Tema görseli URL güncellemesi |
| `src/components/TopBar.tsx` | "PAZAR" nav item + SC label değişikliği |
| `src/App.tsx` | marketplace route |
| `src/i18n/locales/*.json` | 4 dilde yeni key'ler |
