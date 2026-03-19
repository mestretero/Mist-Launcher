# Stealike — Oyun Dağıtım Platformu Tasarım Dokümanı

## Vizyon

Türkiye'deki oyuncuların oyunlara erişimini kolaylaştıran, taksitli ödeme seçeneği sunan ve Türk oyuncu topluluğunu bir araya getiren bir masaüstü oyun dağıtım platformu.

## Problem

- Türkiye'de oyun fiyatları yüksek, oyuncular satın almada zorlanıyor
- Mevcut platformlarda (Steam, Epic) taksit seçeneği yok
- Papara, ininal gibi yerli ödeme yöntemleri desteklenmiyor
- Türk oyuncu topluluğuna özel bir platform yok

## Çözüm

Stealike: Taksitli ödeme, öğrenci indirimi ve içerik üretici entegrasyonu ile Türk oyunculara özel bir oyun dağıtım platformu.

## Hedef Kitle

- **Birincil:** Türk oyuncular (tüketiciler)
- **İkincil:** Oyun geliştiricileri ve yayıncılar (küçükten büyüğe)
- **Üçüncül:** Türk oyun içerik üreticileri (YouTube, Twitch)

## Temel Farklılaştırıcılar

1. **Taksitli ödeme + alternatif ödeme yöntemleri** — Kredi kartı taksit (2-12 ay), Papara, ininal
2. **İçerik üretici referans sistemi** — Organik büyüme motoru, pazarlama bütçesi gerektirmez
3. **Öğrenci indirimi** — ~8M potansiyel kullanıcı, .edu.tr doğrulama ile %10 indirim

---

## Fazlama Stratejisi

### Faz 0 — Demo / Yatırımcı MVP

Yatırımcıya gösterilecek çalışır durumda minimum ürün.

**Kapsam:**
- Çalışan masaüstü uygulama (Tauri) — profesyonel görünüm
- Taksitli ödeme akışı — iyzico test modu ile gerçek taksit seçim ekranı
- Kütüphane deneyimi — satın al → kütüphaneye ekle → indir → oyna akışı
- Öğrenci indirimi (.edu.tr doğrulama) + referans kodu sistemi
- 5-10 mock oyun ile dolu katalog

**Kapsam dışı (Faz 1'e kalır):**
- Gerçek oyun kataloğu ve yayıncı anlaşmaları
- Geliştirici portalı
- Gerçek ödeme işleme (sandbox yeterli)
- Büyük dosya indirme altyapısı (küçük demo dosyalar yeterli)
- İçerik üretici başvuru/onay süreci

### Faz 1 — Tam MVP

- Gerçek ödeme işleme (iyzico/PayTR production)
- Gerçek oyun kataloğu (yayıncı anlaşmaları ile)
- Geliştirici/yayıncı portalı
- İçerik üretici tam dashboard + komisyon çekim
- HWID takibi, cihaz limiti, offline grace period
- KVKK tam uyumluluk

### Faz 2 — Büyüme

- Web sitesi (Next.js) — mağaza vitrini + satın alma
- Sosyal özellikler (arkadaş listesi, incelemeler, puanlama)
- "Made in Türkiye" özel vitrini
- Türk indie geliştiricilere düşük komisyon (%10)

### Faz 3 — Ekosistem

- Abonelik sistemi (Game Pass benzeri, yayıncı anlaşmaları ile)
- İnternet kafe entegrasyonu (toplu lisans)
- Topluluk özellikleri (forumlar, başarımlar, gruplar)
- Uluslararası açılım (Stripe/PayPal, çoklu dil)

---

## Tech Stack

### Masaüstü Uygulama
- **Framework:** Tauri 2.0 (Rust backend + WebView frontend)
- **Frontend:** React + TypeScript + Tailwind CSS
- **State yönetimi:** Zustand
- **IPC:** Tauri invoke/events sistemi

### Sunucu API
- **Runtime:** Node.js
- **Framework:** Fastify
- **ORM:** Prisma
- **Validation:** Zod

### Veritabanı
- **Ana DB:** PostgreSQL
- **Cache/Session:** Redis

### Altyapı
- **Ödeme:** iyzico (başlangıç) → PayTR (alternatif) → Stripe/PayPal (uluslararası)
- **Dosya depolama:** S3 / MinIO (oyun dosyaları)
- **CDN:** CloudFlare
- **Arama:** Meilisearch
- **Hosting:** Vercel (web, Faz 2) + Hetzner/AWS (dosyalar, API)

### Neden Bu Stack?

- **Tauri:** Electron'a göre ~10x hafif (~15MB vs ~150MB RAM), Rust ile güçlü sistem erişimi (dosya indirme, oyun başlatma, OS keyring)
- **React:** Faz 2'de web'e geçişte bileşenler paylaşılır
- **Fastify:** Express'ten ~2x hızlı, schema-based validation, TypeScript desteği
- **Prisma:** Type-safe DB erişimi, otomatik migration, SQL injection koruması
- **PostgreSQL:** ACID uyumlu, JSON desteği, ölçeklenebilir

---

## Masaüstü Uygulama Mimarisi

### Katmanlı Yapı

```
┌─────────────────────────────────────────────┐
│  UI Katmanı — React + TypeScript + Tailwind │
│  Mağaza | Kütüphane | Oyun Detay | Profil   │
│  Ödeme/Taksit | İndirme | Referans          │
├─────────────────────────────────────────────┤
│  Tauri IPC Bridge (invoke / events)          │
├─────────────────────────────────────────────┤
│  Rust Backend — Tauri Commands               │
│  Download Manager | Game Launcher            │
│  File Manager | Auth & Session               │
│  Auto Updater                                │
├─────────────────────────────────────────────┤
│  System Tray — arka plan, bildirimler        │
└─────────────────────────────────────────────┘
```

### Rust Backend — Tauri IPC Komutları

Her modül `#[tauri::command]` fonksiyonları olarak expose edilir. React tarafı `invoke("komut_adı", { args })` ile çağırır.

**Download Manager:**
- `download_game(game_id, url, dest_path)` → indirmeyi başlat, download_id döner
- `pause_download(download_id)` → indirmeyi duraklat
- `resume_download(download_id)` → indirmeyi devam ettir
- `cancel_download(download_id)` → indirmeyi iptal et
- Event: `download-progress { download_id, percent, speed_bps, eta_secs }` → React'e gerçek zamanlı ilerleme

**Game Launcher:**
- `launch_game(game_id, exe_path)` → oyunu başlat, process_id döner
- `stop_game(game_id)` → oyunu kapat
- Event: `game-status { game_id, status: "running"|"stopped", play_time_secs }` → oyun durumu

**File Manager:**
- `get_disk_space(path)` → `{ free_bytes, total_bytes }`
- `verify_game_files(game_id, path, expected_hash)` → SHA-256 hash doğrulama
- `uninstall_game(game_id, path)` → oyun dosyalarını sil

**Auth & Session:**
- `store_token(key, value)` → OS Keyring'e kaydet
- `get_token(key)` → OS Keyring'den oku
- `delete_token(key)` → OS Keyring'den sil

**Auto Updater (Faz 0'da basit):**
- Tauri 2.0 built-in updater plugin kullanılır
- Update check: uygulama açılışında ve her 4 saatte

### Proje Yapısı

```
stealike/
├── src-tauri/                  ← Rust backend
│   └── src/
│       ├── commands/           ← Tauri IPC komutları
│       │   ├── download.rs
│       │   ├── launcher.rs
│       │   ├── auth.rs
│       │   └── files.rs
│       ├── services/           ← İş mantığı
│       ├── models/             ← Veri yapıları
│       └── main.rs
├── src/                        ← React frontend
│   ├── pages/                  ← Store, Library, GameDetail, Settings
│   ├── components/             ← Paylaşılan UI bileşenleri
│   ├── hooks/                  ← Tauri bridge hooks
│   ├── stores/                 ← Zustand state yönetimi
│   └── lib/                    ← API client, utils
└── server/                     ← Backend API (Fastify)
    ├── routes/                 ← API endpoint'leri
    ├── services/               ← İş mantığı
    ├── prisma/                 ← DB schema & migrations
    └── plugins/                ← iyzico, auth, vb.
```

---

## Backend API Tasarımı

### İstek Akışı

```
Tauri App → Auth Middleware (JWT + Rate Limit) → API Routes → Services → Prisma → PostgreSQL
```

### API Endpoint'leri (Demo Kapsamı)

Tüm endpoint'ler JSON döner. Başarı: `{ data: ... }`, hata: `{ error: { code: string, message: string } }`.
Auth gerektiren endpoint'ler `Authorization: Bearer <token>` header'ı bekler, geçersiz/eksik token'da `401` döner.

**Auth (4 endpoint):**
- `POST /auth/register` — kayıt → 201 `{ data: { user, tokens } }` | 409 email/username çakışması
- `POST /auth/login` — giriş → 200 `{ data: { user, tokens } }` | 401 geçersiz credentials
- `POST /auth/refresh` — token yenileme → 200 `{ data: { tokens } }` | 401 geçersiz refresh token
- `POST /auth/verify-student` — öğrenci doğrulama (🔒 auth) → 200 `{ data: { verified } }` | 400 geçersiz email

**Games (4 endpoint):**
- `GET /games` — liste + filtreleme → 200 `{ data: Game[], meta: { total, page } }`
- `GET /games/:slug` — oyun detay → 200 `{ data: Game }` | 404
- `GET /games/featured` — vitrin oyunları → 200 `{ data: Game[] }`
- `GET /games/search?q=` — arama → 200 `{ data: Game[], meta: { total } }`

**Library (3 endpoint):**
- `GET /library` (🔒 auth) — kullanıcının oyunları → 200 `{ data: LibraryItem[] }`
- `PATCH /library/:id` (🔒 auth) — oyun süresi güncelle → 200 | 404
- `GET /library/:id/download` (🔒 auth) — signed indirme URL'i → 200 `{ data: { url, expires_at } }` | 403 lisans yok

**Payments (4 endpoint):**
- `POST /payments/init` (🔒 auth) — ödeme başlat → 200 `{ data: { payment_id, three_d_html } }` | 400
- `POST /payments/callback` — iyzico webhook (HMAC doğrulama, idempotent: provider_tx_id ile duplicate kontrol) → 200
- `GET /payments/installments` (🔒 auth) — taksit seçenekleri sorgula (BIN bazlı) → 200 `{ data: InstallmentOption[] }`
- `GET /payments/history` (🔒 auth) — ödeme geçmişi → 200 `{ data: Payment[] }`

---

## Veritabanı Şeması

### Ana Tablolar

**User:**
- id (UUID PK), email (UNIQUE), username (UNIQUE), password_hash
- avatar_url, is_student (BOOL), student_verified_at
- referral_code (UNIQUE), referred_by (FK → User)
- created_at, updated_at

**Game:**
- id (UUID PK), title, slug (UNIQUE), description, short_description
- price (DECIMAL), discount_percent, cover_image_url, screenshots (JSON[])
- publisher_id (FK → Publisher), min_requirements (JSON)
- release_date, status (ENUM: draft/published/delisted), created_at

**LibraryItem:**
- id (UUID PK), user_id (FK → User), game_id (FK → Game)
- purchased_at, install_path (nullable), play_time_mins (INT), last_played_at
- UNIQUE(user_id, game_id)

**Payment:**
- id (UUID PK), user_id (FK → User), game_id (FK → Game)
- base_price (DECIMAL), discount_amount (DECIMAL), final_amount (DECIMAL)
- currency (TRY), installment_count (INT)
- payment_method (ENUM: credit_card/papara/ininal)
- provider (iyzico/paytr), provider_tx_id (UNIQUE — idempotency key)
- status (ENUM: pending/success/failed/refunded)
- referral_id (FK → Referral, nullable), student_discount_applied (BOOL)
- created_at

**Referral:**
- id (UUID PK), code (UNIQUE), owner_id (FK → User)
- owner_type (ENUM: creator/user)
- discount_percent (INT), commission_percent (INT)
- total_uses (INT), total_earnings (DECIMAL)
- is_active (BOOL), created_at

**Publisher:**
- id (UUID PK), name, slug (UNIQUE), logo_url
- contact_email, commission_rate (DECIMAL), is_verified (BOOL)
- created_at

### İlişkiler

- User 1 ←→ N LibraryItem
- User 1 ←→ N Payment
- Game 1 ←→ N LibraryItem
- Game N ←→ 1 Publisher
- User 1 ←→ 1 Referral
- Payment.referral_id → Referral.id (FK, kullanılan referans kodu)

### İndeksler

- Game: status, release_date (vitrin sorgulama)
- LibraryItem: user_id (kütüphane listeleme)
- Payment: user_id, status, provider_tx_id (geçmiş + idempotency)
- Referral: code (referans kodu arama)

---

## Ödeme Sistemi

### Desteklenen Yöntemler

1. **Kredi kartı** — iyzico üzerinden, taksit destekli (2/3/6/9/12 ay)
2. **Papara** — ön ödemeli kart / cüzdan
3. **ininal** — ön ödemeli kart

### Taksitli Satın Alma Akışı

1. Kullanıcı "Satın Al" tıklar → indirimler hesaplanır (öğrenci + referans)
2. Ödeme yöntemi seçimi (kredi kartı / Papara / ininal)
3. Kredi kartı seçildiyse → BIN (ilk 6 hane) ile taksit seçenekleri sorgulanır
4. 3D Secure doğrulama → Tauri WebView içinde banka sayfası açılır
5. Başarılı → LibraryItem oluştur, referans komisyonu yaz, kullanıcıyı kütüphaneye yönlendir

### Teknik Akış

```
Tauri App: "Satın Al" → POST /payments/init { gameId, referralCode? }
    ↓
Server: Fiyat hesapla (indirimler uygula) → iyzico API: CreatePayment
    ↓
iyzico: 3D Secure HTML döner → Tauri WebView'da gösterilir
    ↓
Kullanıcı: SMS kodu girer → iyzico ödeme işler
    ↓
iyzico: POST /payments/callback { status, txId } → HMAC imza doğrula
    ↓
Server: Payment kaydı + LibraryItem + Referral komisyon → "Başarılı!" bildirimi
```

### Fiyatlandırma Mantığı

- Baz fiyat (TL cinsinden, yayıncı tarafından belirlenir)
- Öğrenci indirimi: -%10 (doğrulanmış hesaplar)
- Referans kodu: -%5
- Taksit farkı: banka komisyonuna göre değişir (müşteriye yansıtılır)
- İndirimler çakışabilir, toplam max %15

**İndirim maliyetini kim karşılar:** İndirimler toplam satış fiyatını düşürür. Gelir dağılımı (yayıncı %80, platform %17, içerik üretici %3) indirim sonrası fiyat (final_amount) üzerinden hesaplanır. Yani indirim maliyeti tüm taraflara oransal olarak dağılır.

**Ödeme geçidi komisyonu:** iyzico işlem başı komisyon alır (~%2.49 + taksit farkı). Bu komisyon, Stealike'ın %17 payından düşülür. Yayıncı payı etkilenmez.

### 3D Secure Akışı (Tauri İçinde)

Tauri app içinde 3D Secure akışı:
1. Server, iyzico API'den 3D Secure HTML'ini alır
2. Tauri, ayrı bir WebView penceresi açar ve bu HTML'i render eder
3. Kullanıcı banka sayfasında SMS doğrulama yapar
4. iyzico, callback URL'e yönlendirir → Tauri bu URL'i `navigation` event ile yakalar
5. WebView kapatılır, sonuç ana pencereye bildirilir

### Webhook İdempotency

iyzico webhook'ları birden fazla kez gönderilebilir. Koruma:
- `provider_tx_id` UNIQUE constraint ile duplicate insert engellenir
- Callback handler: önce `provider_tx_id` ile mevcut Payment kaydı kontrol edilir
- Zaten işlenmiş → 200 döner, tekrar işlem yapılmaz
- İşlenmemiş → Payment + LibraryItem + Referral komisyon yazılır (tek transaction)

### Güvenlik

- Kart bilgisi asla sunucuda tutulmaz — iyzico tokenize eder
- Tüm işlemler 3D Secure zorunlu
- HMAC imza doğrulama (webhook güvenliği)
- Rate limiting: IP başına 5 ödeme denemesi/saat
- Fraud kontrolü: iyzico tarafında

---

## Güvenlik & Lisans Yönetimi

### Lisans Sistemi

**Faz 0 (Demo):**
1. **Satın alma:** Ödeme başarılı → LibraryItem oluşturulur
2. **İndirme:** Auth token ile `GET /library/:id/download` → S3 pre-signed URL üretilir (15dk TTL, user_id + game_id + IP signed). URL süresi dolursa yeni URL istenir. İndirme sırasında süre dolarsa mevcut bağlantı kesilmez (S3 davranışı).
3. **Oyun başlatma:** LibraryItem mevcudiyeti kontrol edilir, oyun başlatılır

**Faz 1 (ek özellikler):**
- Periyodik online lisans doğrulama (her 4 saatte)
- Offline grace period: 72 saat
- Eşzamanlı cihaz limiti: max 3 kurulu, 1 aktif oyun
- HWID takibi

### Kimlik Doğrulama (Faz 0)

- JWT + Refresh Token çifti
- Access token: 15dk ömür, Refresh token: 30 gün (tek kullanım, rotation)
- Şifre hash: Argon2id
- Token depolama: OS Keyring (Windows Credential Manager / macOS Keychain)

### Kimlik Doğrulama (Faz 1 ek)

- Cihaz bazlı oturum yönetimi
- Şüpheli giriş → email bildirimi

### Korsan Koruması (Faz 0)

- İndirme URL'leri signed + süreli (15dk, S3 pre-signed)
- Dosya bütünlüğü: SHA-256 hash doğrulama (indirme sonrası)

### Korsan Koruması (Faz 1 ek)

- Eşzamanlı cihaz limiti: max 3 kurulu, 1 aktif oyun
- HWID (Hardware ID) takibi
- Hesap paylaşımı tespit algoritması

### API Güvenliği

- HTTPS zorunlu (TLS 1.3)
- Rate limiting (IP + kullanıcı bazlı)
- Input validation: Zod şema doğrulama
- SQL injection koruması: Prisma ORM
- Helmet.js güvenlik başlıkları

### Veri Güvenliği

- Kart bilgisi saklanmaz (iyzico tokenization)
- Token depolama: OS Keyring (Windows Credential Manager / macOS Keychain)
- KVKK uyumlu veri saklama (Faz 1'de tam uyumluluk)
- Hassas loglar maskelenir

---

## Farklılaştırıcılar

### 1. Öğrenci İndirimi

**Doğrulama akışı:**
1. Kullanıcı profil ayarlarından başvuru yapar
2. .edu.tr email adresiyle doğrulama (Demo), belge yükleme (Faz 1)
3. Doğrulandı → %10 indirim aktif, 1 yıl geçerli

### 2. Referans Sistemi — İki Katmanlı

**Normal kullanıcı:**
- Otomatik referans kodu: `KULLANICI-XXXX`
- Alıcı: %5 indirim
- Referans sahibi: %1 cüzdan kredisi (sonraki alışverişte kullanılır)

**İçerik üretici:**
- Küratörlü başvuru süreci (min. 1.000 takipçi)
- Özel referans kodu: `ELRAENN` (isme özel)
- Alıcı: %5 indirim
- İçerik üretici: %3 nakit komisyon
- Komisyon birikimi → minimum ₺500 → banka havalesi
- Dashboard: satış sayısı, kazanç, oyun bazlı detay

### 3. Gelir Dağılımı

Örnek: ₺500 baz fiyatlı oyun, öğrenci + referans kodu ile:

| Kalem | Tutar |
|-------|-------|
| Müşteri öder | ₺425 (-%10 öğrenci, -%5 referans) |
| Yayıncı payı (%80) | ₺340 |
| Stealike komisyonu (%17) | ₺72,25 |
| İçerik üretici komisyonu (%3) | ₺12,75 |

Platform komisyonu (%17): Steam'in %30'undan düşük, Epic'in %12'sine yakın. İçerik üretici komisyonu platform payından karşılanır, yayıncı payını etkilemez.

---

## Demo (Faz 0) Kapsamı Özet

### Dahil

- Tauri masaüstü uygulama (Windows + macOS)
- Kullanıcı kayıt/giriş (JWT auth)
- Mock oyun kataloğu (5-10 oyun)
- Mağaza vitrini, arama, filtreleme
- Oyun detay sayfası
- Taksitli satın alma (iyzico sandbox)
- Kütüphane sistemi
- İndirme + oyun başlatma (demo dosyalarla)
- Öğrenci indirimi (.edu.tr doğrulama)
- Referans kodu sistemi (kullanıcı referansı)
- Basit referans istatistik sayfası

### Mock Oyun Verisi (Demo)

5-10 oyun, DB seed script'i ile yüklenir. Her oyun:
- Gerçek oyun isimleri ve görselleri (lisanslama sorunu yok — sadece demo amaçlı, yayınlanmayacak)
- Gerçekçi TL fiyatları (₺100-₺1500 arası)
- Ekran görüntüleri (3-5 adet, URL olarak)
- Kısa/uzun açıklama, minimum sistem gereksinimleri
- İndirme dosyası: küçük placeholder (10-50MB zip)

### Hariç (Faz 1+)

- Gerçek ödeme işleme
- Geliştirici/yayıncı portalı
- İçerik üretici başvuru/onay süreci
- Tam dashboard + analitik
- Komisyon çekim sistemi
- HWID takibi, cihaz limiti
- Offline grace period
- KVKK tam uyumluluk
- Web sitesi
- Sosyal özellikler
