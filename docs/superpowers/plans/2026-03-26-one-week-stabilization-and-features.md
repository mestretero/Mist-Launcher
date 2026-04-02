# Stealike 1-Haftalık Stabilizasyon & Özellik Planı

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut bug'ları düzelt, yarım kalan özellikleri tamamla, eksik sayfaları ekle — 7 günde Stealike'ı stabil ve feature-complete bir duruma getir.

**Architecture:** Fastify backend + React/Zustand frontend + Tauri desktop shell + PostgreSQL/Prisma ORM. Ödeme yöntemleri bu plan kapsamı dışında.

**Tech Stack:** TypeScript, React 19, Zustand, Fastify 5, Prisma 7, Tauri 2, Tailwind CSS 4, nodemailer, otplib/qrcode

---

## Chunk 1: Kritik Bug Düzeltmeleri & Bildirim Entegrasyonu (Gün 1)

### Task 1: Arkadaş Ekleme API Uyumsuzluğunu Düzelt

**Files:**
- Modify: `src/lib/api.ts:134` — `userId` → `username` gönderecek şekilde düzelt
- Modify: `src/pages/FriendsPage.tsx` — arama sonucundan `username` gönderecek şekilde düzelt

- [ ] **Step 1: `src/lib/api.ts` satır 134'ü düzelt**

Frontend API client'ta friend request fonksiyonunu düzelt. Backend `username` bekliyor:

```typescript
// src/lib/api.ts — friends bölümü
request: (username: string) =>
  request<any>("/friends/request", {
    method: "POST",
    body: JSON.stringify({ username }),
  }),
```

- [ ] **Step 2: `src/pages/FriendsPage.tsx`'de çağrıyı güncelle**

Arama sonucundan `userId` yerine `username` gönder:

```typescript
// FriendsPage.tsx — handleAddFriend fonksiyonundaki api çağrısı
await api.friends.request(user.username);
```

- [ ] **Step 3: Test et**

Uygulamada arkadaş araması yap, bir kullanıcı ekle. Backend'de friendship kaydının oluştuğunu doğrula.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/pages/FriendsPage.tsx
git commit -m "fix: friend request sends username instead of userId to match backend"
```

---

### Task 2: Wishlist Check Response Uyumsuzluğunu Düzelt

**Files:**
- Modify: `server/src/routes/wishlist.ts:27` — response field adını `wishlisted` yap

- [ ] **Step 1: Backend response'u frontend'e uyumlu hale getir**

```typescript
// server/src/routes/wishlist.ts — check endpoint
return { data: { wishlisted: inWishlist } };
```

- [ ] **Step 2: Test et**

Bir oyun detay sayfasına git, wishlist ikonunun doğru durumu gösterdiğini kontrol et.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/wishlist.ts
git commit -m "fix: wishlist check returns 'wishlisted' field to match frontend expectation"
```

---

### Task 3: Şifre Sıfırlama Parametre Uyumsuzluğunu Düzelt

**Files:**
- Modify: `src/lib/api.ts:84` — `password` → `newPassword` olarak gönder

- [ ] **Step 1: Frontend API client'ı düzelt**

```typescript
// src/lib/api.ts — auth bölümü
resetPassword: (token: string, password: string) =>
  request<any>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword: password }),
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "fix: resetPassword sends newPassword field to match backend schema"
```

---

### Task 4: Payment Callback Parametre Adı Tutarlılığı (Kod Temizliği)

**Files:**
- Modify: `server/src/routes/payments.ts:16-17` — değişken adını service ile tutarlı hale getir

Not: Bu bir runtime bug değil (JS parametreleri isim değil pozisyon bazlı), ama okunabilirlik için düzeltilmeli.

- [ ] **Step 1: Route'daki değişken adını tutarlı yap**

```typescript
// server/src/routes/payments.ts — callback endpoint
const { paymentId } = request.body as { paymentId: string };
const result = await paymentService.handleCallback(paymentId);
// Not: İşlevsel olarak aynı, ama değişken adını service parametresiyle tutarlı tutuyoruz
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/payments.ts
git commit -m "refactor: align payment callback variable name for readability"
```

---

### Task 4.5: Wallet Deposit Validation (Güvenlik — Erkene Alındı)

**Files:**
- Modify: `server/src/routes/wallet.ts` — Zod schema ekle
- Modify: `src/lib/api.ts` — wallet deposit amount'u number olarak gönder

- [ ] **Step 1: Backend'e Zod validation ekle**

```typescript
// server/src/routes/wallet.ts
import { z } from "zod";

const depositSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
});

// deposit endpoint'inde:
const { amount } = depositSchema.parse(request.body);
```

Not: `z.coerce.number()` kullanıyoruz çünkü frontend amount'u string olarak gönderiyor. Bu hem mevcut frontend ile uyumlu hem de güvenli.

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/wallet.ts
git commit -m "fix: add Zod validation to wallet deposit endpoint with coercion"
```

---

### Task 5: Bildirim Sistemi Entegrasyonu — Event'leri Bağla

**Files:**
- Modify: `server/src/services/friendship.service.ts` — arkadaşlık event'lerinde bildirim oluştur
- Modify: `server/src/services/payment.service.ts` — ödeme başarılı olduğunda bildirim oluştur
- Modify: `server/src/services/wallet.service.ts` — para yatırma bildirim

- [ ] **Step 1: friendship.service.ts'e bildirim ekle**

```typescript
// server/src/services/friendship.service.ts — import ekle
import { createNotification } from "./notification.service.js";

// sendRequest fonksiyonunun sonuna ekle (friendship oluşturulduktan sonra):
await createNotification(
  receiverId,
  "FRIEND_REQUEST",
  "Arkadaşlık İsteği",
  `${senderUsername} sana arkadaşlık isteği gönderdi.`,
  { friendshipId: friendship.id }
);

// acceptRequest fonksiyonunun sonuna ekle:
await createNotification(
  friendship.senderId,
  "FRIEND_ACCEPTED",
  "Arkadaşlık Kabul Edildi",
  `${receiverUsername} arkadaşlık isteğini kabul etti.`,
  { friendshipId: friendship.id }
);
```

Not: `senderUsername` ve `receiverUsername` değerlerini friendship kaydından veya parametre olarak almak gerekebilir. İlgili fonksiyon imzalarını uygun şekilde güncelle.

- [ ] **Step 2: payment.service.ts'e bildirim ekle**

```typescript
// server/src/services/payment.service.ts — import ekle
import { createNotification } from "./notification.service.js";

// handleCallback fonksiyonunda, transaction bloğu SONRASINDA (dışında):
// Önce payment'ı game ile birlikte çek:
const paymentWithGame = await prisma.payment.findUniqueOrThrow({
  where: { id: payment.id },
  include: { game: true },
});
await createNotification(
  paymentWithGame.userId,
  "PAYMENT_SUCCESS",
  "Satın Alma Başarılı",
  `${paymentWithGame.game.title} kütüphanene eklendi!`,
  { gameId: paymentWithGame.gameId, paymentId: paymentWithGame.id }
);
```

- [ ] **Step 3: wallet.service.ts deposit'e bildirim ekle**

```typescript
// server/src/services/wallet.service.ts — import ekle
import { createNotification } from "./notification.service.js";

// deposit fonksiyonunun sonuna:
await createNotification(
  userId,
  "SYSTEM",
  "Bakiye Yüklendi",
  `Cüzdanınıza ${amount} TL yüklendi.`,
  { transactionId: tx.id }
);
```

- [ ] **Step 4: Test et**

Arkadaşlık isteği gönder → karşı tarafın bildirim panelinde görünmeli. Cüzdana para yükle → bildirim gelmeli.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/friendship.service.ts server/src/services/payment.service.ts server/src/services/wallet.service.ts
git commit -m "feat: wire notification creation into friendship, payment, and wallet events"
```

---

## Chunk 2: Kategori/Tag Sistemi & Oyun Keşfi (Gün 2)

### Task 6: Prisma Schema'ya Kategori Alanı Ekle

**Files:**
- Modify: `server/prisma/schema.prisma` — Game modeline `categories` alanı ekle
- Create: migration

- [ ] **Step 1: Schema'ya kategori ekle**

Game modeline JSON array olarak kategori ekle (ayrı tablo yerine basit tutuyoruz):

```prisma
// server/prisma/schema.prisma — Game model içine ekle
categories    String[]   @default([])
```

- [ ] **Step 2: Migration oluştur**

```bash
cd e:/PROJELER/Stealike/server
npx prisma migrate dev --name add_game_categories
```

- [ ] **Step 3: Seed verisini güncelle**

```typescript
// server/prisma/seed.ts — her oyuna categories ekle
// Galactic Odyssey → ["Aksiyon", "Macera", "Uzay"]
// Shadow Realm → ["RPG", "Aksiyon", "Fantazi"]
// Speed Legends → ["Yarış", "Arcade", "Spor"]
// Fortress Builder → ["Strateji", "Simülasyon", "İnşa"]
// Cyber Strike → ["FPS", "Aksiyon", "Cyberpunk"]
// Ocean Explorer → ["Macera", "Simülasyon", "Keşif"]
// Pixel Warriors → ["Indie", "Platform", "Retro"]
// Anadolu Efsaneleri → ["Aksiyon", "RPG", "Türk"]
// Istanbul Underground → ["Aksiyon", "Gizlilik", "Açık Dünya"]
// Mech Arena → ["Aksiyon", "FPS", "Mech"]
```

- [ ] **Step 4: Seed'i çalıştır**

```bash
npx prisma db seed
```

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/seed.ts server/prisma/migrations/
git commit -m "feat: add categories field to Game model with seed data"
```

---

### Task 7: Backend Kategori Filtreleme Endpoint'i

**Files:**
- Modify: `server/src/services/game.service.ts` — kategori filtreleme ekle
- Modify: `server/src/routes/games.ts` — query param olarak kategori desteği

- [ ] **Step 1: game.service.ts'e kategori filtreleme ekle**

```typescript
// server/src/services/game.service.ts — listGames fonksiyonuna category parametresi ekle
// NOT: Mevcut fonksiyonda limit parametresi varsa koru. Sadece category ekle.
export async function listGames(page: number = 1, limit: number = 20, category?: string) {
  const where: any = { status: "PUBLISHED" };
  if (category && category !== "Tümü") {
    where.categories = { has: category };
  }
  const games = await prisma.game.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { releaseDate: "desc" },
    include: { publisher: true },
  });
  const total = await prisma.game.count({ where });
  return { games, total, page, totalPages: Math.ceil(total / limit) };
}
```

- [ ] **Step 2: games.ts route'una category query param ekle**

Mevcut Zod schema varsa (`gameListSchema`), ona `category` ekle. Yoksa query'den al:

```typescript
// server/src/routes/games.ts — list endpoint
const { page, limit, category } = request.query as { page?: string; limit?: string; category?: string };
const result = await gameService.listGames(Number(page) || 1, Number(limit) || 20, category);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/game.service.ts server/src/routes/games.ts
git commit -m "feat: add category filtering to game list endpoint"
```

---

### Task 7.5: Game Model'e Eksik Alanları Frontend Type'a Ekle (Task 8'den ÖNCE)

**Files:**
- Modify: `src/lib/types.ts` — Game type'a `categories`, `trailerUrl`, `downloadSize`, `minRequirements` ekle

- [ ] **Step 1: Type'ı güncelle**

```typescript
// src/lib/types.ts — Game interface'ine ekle
categories: string[];
trailerUrl?: string;
downloadSize?: string;
minRequirements?: Record<string, string>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add categories, trailerUrl, downloadSize to Game type"
```

---

### Task 8: Frontend Kategori Filtrelemeyi Backend'e Bağla

**Files:**
- Modify: `src/lib/api.ts` — games.list'e category parametresi ekle
- Modify: `src/pages/StorePage.tsx` — kategori seçildiğinde API'den filtrele (hardcoded search yerine)

- [ ] **Step 1: API client'ı güncelle**

```typescript
// src/lib/api.ts — games bölümü
list: (page?: number, category?: string) => {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (category && category !== "Tümü") params.set("category", category);
  return request<any>(`/games?${params}`);
},
```

- [ ] **Step 2: StorePage'de kategori seçimini API'ye bağla**

Mevcut hardcoded `handleSearch(category)` yerine gerçek kategori filtreleme:

```typescript
// src/pages/StorePage.tsx — kategori butonlarının onClick'i
// Kategori seçildiğinde: setSelectedCategory(cat) + API çağrısı
const [selectedCategory, setSelectedCategory] = useState("Tümü");

// useEffect içinde category değiştiğinde yeni veri çek
useEffect(() => {
  api.games.list(1, selectedCategory).then((res) => {
    setGames(res.data.games);
  });
}, [selectedCategory]);
```

- [ ] **Step 3: Kategori butonlarını güncelle**

```tsx
{CATEGORIES.map((cat) => (
  <button
    key={cat}
    onClick={() => setSelectedCategory(cat)}
    className={`... ${selectedCategory === cat ? "bg-brand-600 text-white" : "bg-white/5 text-gray-400"}`}
  >
    {cat}
  </button>
))}
```

- [ ] **Step 4: Test et**

Mağaza sayfasında "RPG" kategorisine tıkla → sadece RPG oyunları görünmeli. "Tümü" → hepsi.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/pages/StorePage.tsx
git commit -m "feat: connect category filtering to backend API in store page"
```

---

## Chunk 3: Koleksiyonlar Sayfası & Library Gerçek Veri (Gün 3)

### Task 10: Koleksiyonlar Sayfası Oluştur

**Files:**
- Create: `src/pages/CollectionsPage.tsx`
- Modify: `src/App.tsx` — route ekle
- Modify: `src/components/TopBar.tsx` — navigasyona "Koleksiyonlar" linki ekle (veya Library alt menüsüne)

- [ ] **Step 1: CollectionsPage.tsx oluştur**

Sayfa özellikleri:
- Koleksiyon listesi (sol panel)
- Seçili koleksiyonun oyunları (sağ panel)
- Yeni koleksiyon oluşturma (isim girişi + buton)
- Koleksiyon silme
- Koleksiyondan oyun çıkarma
- Boş durum gösterimi

```tsx
// src/pages/CollectionsPage.tsx
// Zustand store gerekmez — doğrudan API çağrıları yeterli
// api.collections.list() → koleksiyonları çek
// api.collections.create(name) → yeni koleksiyon
// api.collections.remove(id) → sil
// api.collections.removeGame(collectionId, gameId) → oyun çıkar
// Tasarım: LibraryPage'in split-panel layout'unu takip et
```

- [ ] **Step 2: App.tsx'e route ekle**

```typescript
// src/App.tsx — renderPage fonksiyonuna case ekle
case "collections":
  return <CollectionsPage />;
```

- [ ] **Step 3: TopBar navigasyonuna ekle**

```tsx
// src/components/TopBar.tsx — nav items array'ine ekle
{ key: "collections", label: "Koleksiyonlar" }
```

- [ ] **Step 4: Test et**

Koleksiyonlar sayfasına git → yeni koleksiyon oluştur → oyun ekle (GameDetailPage'den veya Library'den "Koleksiyona Ekle" butonu lazım olacak) → koleksiyondan oyun çıkar → koleksiyon sil.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CollectionsPage.tsx src/App.tsx src/components/TopBar.tsx
git commit -m "feat: add collections page with create, delete, and manage games"
```

---

### Task 11: "Koleksiyona Ekle" Butonu (GameDetailPage & LibraryPage)

**Files:**
- Modify: `src/pages/GameDetailPage.tsx` — satın alma paneline "Koleksiyona Ekle" dropdown
- Modify: `src/pages/LibraryPage.tsx` — oyun detay bölümüne "Koleksiyona Ekle" dropdown

- [ ] **Step 1: Reusable dropdown bileşeni oluştur**

```tsx
// src/components/AddToCollectionDropdown.tsx
// Props: gameId: string
// State: collections (api.collections.list()), isOpen
// Mevcut koleksiyonları listele, tıklayınca api.collections.addGame(id, gameId) çağır
// Toast ile başarı/hata göster
```

- [ ] **Step 2: GameDetailPage'e ekle**

Wishlist butonunun yanına "Koleksiyona Ekle" dropdown butonu ekle.

- [ ] **Step 3: LibraryPage'e ekle**

Seçili oyun detay paneline "Koleksiyona Ekle" dropdown butonu ekle.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddToCollectionDropdown.tsx src/pages/GameDetailPage.tsx src/pages/LibraryPage.tsx
git commit -m "feat: add 'Add to Collection' dropdown to game detail and library pages"
```

---

### Task 12: LibraryPage Hardcoded Veriyi Gerçek API Verisine Bağla

**Files:**
- Modify: `src/pages/LibraryPage.tsx:302` — achievement stats'ı API'den çek
- Modify: `src/pages/LibraryPage.tsx:373-375` — arkadaş avatarlarını API'den çek
- Modify: `src/pages/LibraryPage.tsx:407-409` — activity feed'i kaldır veya gerçek veriye bağla

- [ ] **Step 1: Achievement stats'ı API'den çek**

```typescript
// LibraryPage.tsx — selectedGame değiştiğinde achievement stats çek
const [achievementStats, setAchievementStats] = useState({ total: 0, unlocked: 0 });

useEffect(() => {
  if (selectedItem) {
    api.achievements.forLibraryItem(selectedItem.id).then((res) => {
      setAchievementStats(res.data);
    }).catch(() => setAchievementStats({ total: 0, unlocked: 0 }));
  }
}, [selectedItem]);

// Render kısmında "12 / 45" yerine:
<span>{achievementStats.unlocked} / {achievementStats.total}</span>
```

- [ ] **Step 2: Arkadaş avatarlarını API ile değiştir**

Arkadaş listesinden "bu oyuna sahip arkadaşlar" göstermek backend değişikliği gerektirir. Şimdilik bu alanı gizle veya "Arkadaşlar" linkine çevir:

```tsx
// Hardcoded avatarlar yerine:
<button onClick={() => navigate("friends")} className="text-sm text-brand-400 hover:text-brand-300">
  Arkadaşlarını Gör →
</button>
```

- [ ] **Step 3: Activity feed'i basitleştir**

Son oynama zamanından ve achievement'lardan oluşan basit bir activity:

```tsx
// Hardcoded event yerine:
{selectedItem?.lastPlayedAt && (
  <div className="...">
    <span>Son oynama: {new Date(selectedItem.lastPlayedAt).toLocaleDateString("tr-TR")}</span>
    <span>{selectedItem.playTimeMins} dakika oynandı</span>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/LibraryPage.tsx
git commit -m "fix: replace hardcoded achievement, friend, and activity data with real API data"
```

---

## Chunk 4: Email Servisi & 2FA (Gün 4)

### Task 13: Email Servisi Oluştur

**Files:**
- Create: `server/src/services/email.service.ts`
- Modify: `server/package.json` — nodemailer bağımlılığı ekle

- [ ] **Step 1: nodemailer yükle**

```bash
cd e:/PROJELER/Stealike/server
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Email servisini oluştur**

```typescript
// server/src/services/email.service.ts
import nodemailer from "nodemailer";

// Development'ta otomatik Ethereal hesabı oluştur, production'da gerçek SMTP
let transporter: nodemailer.Transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Production: gerçek SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: Ethereal test hesabı otomatik oluştur
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("📧 Email test hesabı: https://ethereal.email/login");
    console.log(`   User: ${testAccount.user}`);
  }
  return transporter;
}

const FROM = process.env.SMTP_FROM || "noreply@stealike.com";

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:1420"}/reset-password?token=${token}`;
  const mailer = await getTransporter();
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Stealike - Şifre Sıfırlama",
    html: `<h2>Şifre Sıfırlama</h2>
           <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
           <a href="${resetUrl}">${resetUrl}</a>
           <p>Bu link 1 saat geçerlidir.</p>`,
  });
}

export async function sendEmailVerification(to: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:1420"}/verify-email?token=${token}`;
  const mailer = await getTransporter();
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Stealike - Email Doğrulama",
    html: `<h2>Email Doğrulama</h2>
           <p>Hesabınızı doğrulamak için aşağıdaki linke tıklayın:</p>
           <a href="${verifyUrl}">${verifyUrl}</a>`,
  });
}
```

- [ ] **Step 3: auth.service.ts'e email gönderimini bağla**

```typescript
// server/src/services/auth.service.ts — import ekle
import { sendPasswordResetEmail, sendEmailVerification } from "./email.service.js";

// forgotPassword fonksiyonunda, token oluşturulduktan sonra:
await sendPasswordResetEmail(user.email, resetToken);

// registerUser fonksiyonunda (veya ayrı bir verifyEmail endpointinde):
await sendEmailVerification(user.email, emailVerifyToken);
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/email.service.ts server/src/services/auth.service.ts server/package.json server/package-lock.json
git commit -m "feat: add email service with password reset and email verification emails"
```

---

### Task 14: 2FA (İki Faktörlü Doğrulama) Backend Implementasyonu

**Files:**
- Modify: `server/package.json` — otplib + qrcode bağımlılıkları
- Create: `server/src/services/twoFactor.service.ts`
- Modify: `server/src/routes/auth.ts` — 2FA setup/verify/disable endpoint'leri ekle
- Modify: `server/src/services/auth.service.ts` — login'de 2FA kontrolü

- [ ] **Step 1: Bağımlılıkları yükle**

```bash
cd e:/PROJELER/Stealike/server
npm install otplib qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: twoFactor.service.ts oluştur**

```typescript
// server/src/services/twoFactor.service.ts
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../prisma.js";

export async function generateSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, "Stealike", secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  // Secret'ı geçici olarak kaydet (henüz enable edilmedi)
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  return { qrCodeDataUrl, secret };
}

export async function verifyAndEnable(userId: string, token: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecret) throw new Error("2FA setup not initiated");

  const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
  if (!isValid) throw new Error("Invalid 2FA code");

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });

  return { enabled: true };
}

export async function verifyToken(userId: string, token: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecret) return false;
  return authenticator.verify({ token, secret: user.twoFactorSecret });
}

export async function disable(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  return { enabled: false };
}
```

- [ ] **Step 3: auth.ts'e 2FA endpoint'leri ekle**

```typescript
// server/src/routes/auth.ts — yeni endpoint'ler
import * as twoFactorService from "../services/twoFactor.service.js";

// POST /auth/2fa/setup — QR kod üret
app.post("/auth/2fa/setup", { preHandler: [authenticate] }, async (request) => {
  const result = await twoFactorService.generateSetup(request.user!.userId);
  return { data: result };
});

// POST /auth/2fa/verify — Kodu doğrula ve 2FA'yı aktifleştir
app.post("/auth/2fa/verify", { preHandler: [authenticate] }, async (request) => {
  const { token } = request.body as { token: string };
  const result = await twoFactorService.verifyAndEnable(request.user!.userId, token);
  return { data: result };
});

// POST /auth/2fa/disable — 2FA'yı kapat
app.post("/auth/2fa/disable", { preHandler: [authenticate] }, async (request) => {
  const result = await twoFactorService.disable(request.user!.userId);
  return { data: result };
});
```

- [ ] **Step 4: Login akışına 2FA kontrolü ekle**

```typescript
// server/src/services/auth.service.ts — loginUser fonksiyonu
// Şifre doğrulandıktan sonra, token dönmeden önce:
if (user.twoFactorEnabled) {
  // Token dönme, sadece userId ve 2FA gerekli olduğunu bildir
  return { requires2FA: true, userId: user.id };
}
// 2FA gerekmiyorsa normal token akışı devam etsin
```

- [ ] **Step 5: 2FA ile login tamamlama endpoint'i ekle**

Bu eksik endpoint olmadan 2FA aktif kullanıcılar giriş yapamaz:

```typescript
// server/src/routes/auth.ts — POST /auth/2fa/login
app.post("/auth/2fa/login", async (request) => {
  const { userId, token } = request.body as { userId: string; token: string };
  const isValid = await twoFactorService.verifyToken(userId, token);
  if (!isValid) {
    return reply.status(401).send({ error: "Invalid 2FA code" });
  }
  const tokens = await authService.createTokens(userId);
  return { data: tokens };
});
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/twoFactor.service.ts server/src/routes/auth.ts server/src/services/auth.service.ts server/package.json server/package-lock.json
git commit -m "feat: implement 2FA with TOTP generation, QR code, and login verification"
```

---

### Task 15: 2FA Frontend Entegrasyonu

**Files:**
- Modify: `src/lib/api.ts` — 2FA endpoint'lerini ekle
- Modify: `src/components/TwoFactorSetup.tsx` — gerçek QR kod ve doğrulama
- Modify: `src/pages/SettingsPage.tsx` — 2FA toggle'ı bağla
- Modify: `src/pages/LoginPage.tsx` — 2FA adımı ekle

- [ ] **Step 1: API client'a 2FA endpoint'leri ekle**

```typescript
// src/lib/api.ts — auth bölümüne ekle
twoFactor: {
  setup: () => request<{ qrCodeDataUrl: string; secret: string }>("/auth/2fa/setup", { method: "POST" }),
  verify: (token: string) => request<{ enabled: boolean }>("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ token }) }),
  disable: () => request<{ enabled: boolean }>("/auth/2fa/disable", { method: "POST" }),
},
```

- [ ] **Step 2: TwoFactorSetup.tsx'i gerçek implementasyonla değiştir**

```tsx
// src/components/TwoFactorSetup.tsx
// 1. Mount'ta api.auth.twoFactor.setup() çağır → QR kod al
// 2. QR kodu <img src={qrCodeDataUrl} /> ile göster
// 3. 6 haneli kod girişi al
// 4. api.auth.twoFactor.verify(code) çağır
// 5. Başarılı → onClose callback + toast
// 6. Hata → "Geçersiz kod" mesajı
```

- [ ] **Step 3: SettingsPage'de 2FA butonlarını bağla**

```tsx
// src/pages/SettingsPage.tsx
// Enable butonu: setShow2FASetup(true) → TwoFactorSetup modal'ı aç
// Disable butonu: api.auth.twoFactor.disable() → loadSession() → toast
```

- [ ] **Step 4: LoginPage'e 2FA adımı ekle**

```tsx
// src/pages/LoginPage.tsx
// Login response'da requires2FA: true gelirse:
// 1. Şifre formunu gizle
// 2. 6 haneli TOTP girişi göster
// 3. Kodu doğrula → gerçek token al
```

- [ ] **Step 5: Test et**

Ayarlar → 2FA Etkinleştir → QR kod tarama → Kod girişi → Login'de 2FA adımı.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/components/TwoFactorSetup.tsx src/pages/SettingsPage.tsx src/pages/LoginPage.tsx
git commit -m "feat: complete 2FA frontend with QR code display, verification, and login flow"
```

---

## Chunk 5: Achievement Sistemi & Unlock Mekanizması (Gün 5)

### Task 16: Achievement Unlock Backend

**Files:**
- Modify: `server/src/services/achievement.service.ts` — unlockAchievement fonksiyonu ekle
- Modify: `server/src/routes/achievements.ts` — unlock endpoint ekle
- Create: `server/src/services/achievementTrigger.service.ts` — playtime bazlı otomatik unlock

- [ ] **Step 1: unlockAchievement fonksiyonu ekle**

```typescript
// server/src/services/achievement.service.ts — ekle
export async function unlockAchievement(userId: string, achievementId: string) {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });
  if (existing) return existing;

  const unlock = await prisma.userAchievement.create({
    data: { userId, achievementId },
  });

  // Bildirim oluştur
  const achievement = await prisma.achievement.findUniqueOrThrow({ where: { id: achievementId } });
  await createNotification(
    userId,
    "ACHIEVEMENT_UNLOCKED",
    "Başarım Açıldı!",
    `"${achievement.name}" başarımını kazandın!`,
    { achievementId }
  );

  return unlock;
}
```

- [ ] **Step 2: Playtime bazlı otomatik unlock trigger'ı**

```typescript
// server/src/services/achievementTrigger.service.ts
import { prisma } from "../prisma.js";
import { unlockAchievement } from "./achievement.service.js";

// Playtime bazlı achievement kontrol fonksiyonu
export async function checkPlaytimeAchievements(userId: string, gameId: string, totalPlayTimeMins: number) {
  const achievements = await prisma.achievement.findMany({ where: { gameId } });

  for (const achievement of achievements) {
    // Achievement description'dan hedef dakikayı çıkar (ör: "10 dk", "1 saat", "10 saat")
    // Veya achievement'a bir "triggerMinutes" JSON data alanı ekle
    // Basit yaklaşım: achievement name'den pattern matching
    const thresholds: Record<string, number> = {
      "İlk Adım": 10,     // 10 dakika
      "Kaşif": 60,         // 1 saat
      "Veteran": 600,      // 10 saat
      "Uzman": 1800,       // 30 saat
      "Efsane": 6000,      // 100 saat
    };

    const threshold = thresholds[achievement.name];
    if (threshold && totalPlayTimeMins >= threshold) {
      await unlockAchievement(userId, achievement.id);
    }
  }
}
```

**ÖNEMLİ — library.service.ts'i güncelle:**

```typescript
// server/src/services/library.service.ts — updatePlayTime fonksiyonunun sonuna ekle:
import { checkPlaytimeAchievements } from "./achievementTrigger.service.js";

// updatePlayTime fonksiyonunda, playtime güncellendikten sonra:
await checkPlaytimeAchievements(userId, libraryItem.gameId, libraryItem.playTimeMins + minutes);
```

- [ ] **Step 3: Seed'e achievement verisi ekle**

```typescript
// server/prisma/seed.ts — her oyun için 3-5 achievement ekle
// Örnek: Galactic Odyssey → "İlk Adım" (10 dk), "Kaşif" (1 saat), "Veteran" (10 saat)
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/achievement.service.ts server/src/services/achievementTrigger.service.ts server/src/routes/achievements.ts server/prisma/seed.ts
git commit -m "feat: add achievement unlock mechanism with playtime triggers and notifications"
```

---

### Task 17: Achievement Frontend'i Gerçek Veriye Bağla

**Files:**
- Modify: `src/pages/LibraryPage.tsx` — achievement listesi göster
- Modify: `src/pages/GameDetailPage.tsx` — achievement bölümü ekle

- [ ] **Step 1: LibraryPage achievement bölümünü güncelle**

Achievement tab'ında gerçek verileri göster:

```tsx
// LibraryPage.tsx — "achievements" tab içeriği
// api.achievements.forGame(game.slug) → achievement listesi
// Her achievement: isim, açıklama, ikon, kilidi açıldı mı
// AchievementCard component'ini kullan
```

- [ ] **Step 2: GameDetailPage'e achievement bölümü ekle**

```tsx
// GameDetailPage.tsx — reviews bölümünün altına achievement listesi
// api.achievements.forGame(slug) çağır
// Locked/unlocked durumunu göster
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/LibraryPage.tsx src/pages/GameDetailPage.tsx
git commit -m "feat: display real achievement data in library and game detail pages"
```

---

## Chunk 6: Ayarlar Persistence & Download Kuyruğu & UX (Gün 6)

### Task 18: Ayarlar Persistence — Kullanıcı Tercihleri

**Files:**
- Modify: `server/prisma/schema.prisma` — User modeline preferences JSON alanı ekle
- Modify: `server/src/routes/auth.ts` — PATCH /auth/preferences endpoint'i
- Modify: `server/src/services/auth.service.ts` — updatePreferences fonksiyonu
- Modify: `src/pages/SettingsPage.tsx` — ayarları API'den yükle ve kaydet

- [ ] **Step 1: Schema'ya preferences alanı ekle**

```prisma
// server/prisma/schema.prisma — User modeline
preferences    Json     @default("{}")
```

- [ ] **Step 2: Migration**

```bash
cd e:/PROJELER/Stealike/server
npx prisma migrate dev --name add_user_preferences
```

- [ ] **Step 3: Backend endpoint ekle**

```typescript
// server/src/routes/auth.ts
import { z } from "zod";

const preferencesSchema = z.object({
  downloadPath: z.string().optional(),
  bandwidthLimit: z.string().optional(),
  profileThemeIndex: z.number().int().min(0).max(10).optional(),
  language: z.string().optional(),
}).strict(); // strict() rejects unknown keys

app.patch("/auth/preferences", { preHandler: [authenticate] }, async (request) => {
  const prefs = preferencesSchema.parse(request.body);
  const updated = await authService.updatePreferences(request.user!.userId, prefs);
  return { data: updated };
});
```

- [ ] **Step 4: Frontend'de ayarları bağla**

```typescript
// SettingsPage.tsx — mount'ta preferences yükle
// İndirme yolu, bant genişliği, profil teması → preferences JSON'dan
// Kaydet butonuna tıklayınca api.auth.updatePreferences(prefs) çağır
```

- [ ] **Step 5: ProfilePage tema seçimini preferences'a bağla**

```typescript
// ProfilePage.tsx — bgIndex değiştiğinde preferences'ı güncelle
```

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ server/src/routes/auth.ts server/src/services/auth.service.ts src/pages/SettingsPage.tsx src/pages/ProfilePage.tsx src/lib/api.ts
git commit -m "feat: persist user preferences (download path, bandwidth, theme) to backend"
```

---

### Task 19: Download Kuyruğu Pause/Cancel Butonları

**Files:**
- Modify: `src/components/DownloadQueue.tsx` — butonlara handler ekle
- Modify: `src/stores/downloadStore.ts` — pause/cancel action'ları (dosya mevcut)

- [ ] **Step 1: Tauri komutlarını kontrol et**

Pause/resume/cancel için Tauri backend'de komut var mı kontrol et. Yoksa frontend state ile simüle et.

- [ ] **Step 2: Butonlara handler ekle**

```tsx
// DownloadQueue.tsx
// Pause butonu: downloadStore.pauseDownload(gameId) veya Tauri invoke
// Cancel butonu: downloadStore.cancelDownload(gameId) veya Tauri invoke
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DownloadQueue.tsx
git commit -m "feat: wire download queue pause and cancel buttons"
```

---

## Chunk 7: Test & DLC Temeli (Gün 7)

### Task 21: Uçtan Uca Manuel Test

- [ ] **Step 1: Auth akışları**
  - Register → Login → Logout → Forgot Password → Email geldi mi kontrol

- [ ] **Step 2: Mağaza**
  - Kategori filtreleme çalışıyor mu
  - Arama çalışıyor mu
  - Oyun detay sayfası açılıyor mu

- [ ] **Step 3: Satın alma & Kütüphane**
  - Oyun satın al → kütüphanede görünsün
  - Download başlat → progress bar → pause/resume
  - Oyun bilgileri doğru mu

- [ ] **Step 4: Sosyal**
  - Arkadaş ekle → bildirim gelsin
  - Bildirim paneli çalışıyor mu
  - Review yaz → görünsün

- [ ] **Step 5: Koleksiyonlar**
  - Yeni koleksiyon oluştur → oyun ekle → çıkar → sil

- [ ] **Step 6: Cüzdan & Ayarlar**
  - Para yükle → bakiye güncelle → bildirim gelsin
  - Ayarları değiştir → yeniden yükle → kayıtlı mı

- [ ] **Step 7: 2FA**
  - Etkinleştir → QR kod → Kod doğrula → Login'de 2FA adımı

---

### Task 22: DLC Endpoint & Temel UI (Zaman kalırsa)

**Files:**
- Modify: `server/src/services/game.service.ts` — getDLCs fonksiyonu
- Modify: `server/src/routes/games.ts` — GET /games/:slug/dlcs
- Modify: `src/pages/LibraryPage.tsx` — DLC tab'ını gerçek veriye bağla

- [ ] **Step 1: Backend DLC endpoint'i**

```typescript
// server/src/services/game.service.ts
export async function getGameDLCs(slug: string) {
  const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
  return prisma.game.findMany({
    where: { parentGameId: game.id, status: "PUBLISHED" },
    include: { publisher: true },
  });
}
```

- [ ] **Step 2: Route ekle**

```typescript
// server/src/routes/games.ts
app.get("/games/:slug/dlcs", async (request) => {
  const { slug } = request.params as { slug: string };
  const dlcs = await gameService.getGameDLCs(slug);
  return { data: dlcs };
});
```

- [ ] **Step 3: LibraryPage DLC tab'ını bağla**

- [ ] **Step 4: Commit**

```bash
git add server/src/services/game.service.ts server/src/routes/games.ts src/pages/LibraryPage.tsx
git commit -m "feat: add DLC endpoint and display in library page"
```

---

## Özet Zaman Çizelgesi

| Gün | Chunk | Task'lar | Tahmini Süre |
|-----|-------|----------|-------------|
| 1 | Chunk 1 | Task 1-5: Bug fix'ler + wallet validation + bildirim bağlama | ~5 saat |
| 2 | Chunk 2 | Task 6-8: Kategori sistemi + type güncellemesi + filtreleme | ~5 saat |
| 3 | Chunk 3 | Task 10-12: Koleksiyonlar sayfası + Library gerçek veri | ~6 saat |
| 4 | Chunk 4 | Task 13-15: Email servisi + 2FA tam implementasyon (+ 2FA login endpoint) | ~8 saat |
| 5 | Chunk 5 | Task 16-17: Achievement unlock + trigger + frontend | ~5 saat |
| 6 | Chunk 6 | Task 18-19: Ayarlar persistence + download kuyruğu | ~5 saat |
| 7 | Chunk 7 | Task 21-22: Uçtan uca test + DLC (bonus) | ~5 saat |

**Toplam: ~22 task, 7 gün, ~39 saat**

## Review Notları

Bu plan aşağıdaki review bulgularına göre güncellendi:
- Task 4: Payment callback bug → kod temizliği olarak yeniden sınıflandırıldı (runtime bug değil)
- Task 4.5: Wallet deposit validation Gün 1'e erkene alındı (güvenlik)
- Task 7.5: Game type güncellemesi Task 8'den önceye taşındı (TypeScript dependency)
- Task 7: listGames'de mevcut limit parametresi korundu
- Task 14: Eksik POST /auth/2fa/login endpoint'i eklendi
- Task 13: Email servisi development'ta otomatik Ethereal hesabı oluşturuyor
- Task 18: Preferences endpoint'ine Zod validation eklendi
- Task 16: Achievement trigger çağrısı library.service.ts'de explicit hale getirildi
- Task 5: Payment notification scope sorunu düzeltildi (transaction dışına taşındı)
