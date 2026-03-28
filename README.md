# Stealike

Hybrid gaming platform — indie game store + local game library with scanning, built with Tauri.

## Gereksinimler

- **Node.js** 20+
- **Rust** (rustup ile)
- **Docker Desktop** (PostgreSQL icin)
- **pnpm** veya **npm**

## Baslangic

### 1. PostgreSQL'i baslat

```bash
docker compose up -d
```

Bu komut `localhost:5432`'de PostgreSQL calistirir. (Kullanici: `postgres`, Sifre: `postgres`, DB: `stealike`)

### 2. Server bagimliklarini yukle + migration

```bash
cd server
npm install
npx prisma migrate dev
npx prisma db seed    # (opsiyonel) demo veri ekler
```

### 3. Server'i baslat

```bash
cd server
npm run dev
```

Server `http://localhost:3001` adresinde calisir. Kontrol: `curl http://localhost:3001/health`

### 4. Frontend bagimliklarini yukle

```bash
# Proje kokunde
npm install
```

### 5. Uygulamayi baslat

```bash
npm run tauri dev
```

Bu komut hem Vite dev server (frontend) hem de Tauri penceresi (Rust backend) baslatir.

## Ortam Degiskenleri

### `server/.env`

Server icin gerekli. Ornek:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stealike
JWT_SECRET=herhangi-bir-secret
```

### `src-tauri/.env`

Oyun metadata API'si icin (IGDB). Opsiyonel — olmadan da calisir, sadece kapak resimleri gelmez.

```env
IGDB_CLIENT_ID=twitch_client_id
IGDB_CLIENT_SECRET=twitch_client_secret
```

IGDB key almak: https://api-docs.igdb.com/#getting-started (Twitch Developer hesabi gerekir)

## Hizli Baslatma (Her Sey Bir Arada)

```bash
# 1. Docker
docker compose up -d

# 2. Server (ayri terminal)
cd server && npm run dev

# 3. Uygulama (ayri terminal)
npm run tauri dev
```

## Proje Yapisi

```
stealike/
├── src/                  # React frontend
│   ├── pages/            # Sayfa componentleri
│   ├── components/       # UI componentleri
│   ├── stores/           # Zustand state yonetimi
│   ├── i18n/             # Coklu dil (TR/EN/DE/ES)
│   └── lib/              # API client, tipler
├── src-tauri/            # Tauri/Rust backend
│   └── src/commands/     # Tauri komutlari
│       └── scanner/      # Oyun tarama sistemi (SQLite)
├── server/               # Fastify API server
│   ├── src/routes/       # API route'lari
│   ├── src/services/     # Is mantigi
│   └── prisma/           # Veritabani sema + migration
└── docs/                 # Tasarim dokumanlar ve planlar
```

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Desktop Shell | Tauri 2 |
| Frontend | React 19, Zustand, Tailwind CSS 4 |
| Backend API | Fastify 5, Prisma 7, PostgreSQL |
| Local DB | SQLite (rusqlite) — oyun tarama, yerel kutuphane |
| i18n | react-i18next (TR/EN/DE/ES) |
| DnD | @dnd-kit |

## Ozellikler

- Oyun tarama (registry + disk + akilli filtreleme)
- Yerel oyun kutuphanesi (baslat, surukle-birak profil bloklari)
- Indie oyun magazasi (satin al, istek listesi, sepet)
- Arkadas sistemi + profil yorumlari
- Koleksiyonlar (hem store hem yerel oyunlar)
- Ozellestirilabilir profil (blok sistemi, gorunurluk, tema)
- 4 dil destegi
