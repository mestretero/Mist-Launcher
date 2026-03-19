# Stealike Faz 0 (Demo/Yatırımcı MVP) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Tauri desktop app demo with installment payments, game library, student discounts, and referral codes — ready to show investors.

**Architecture:** Tauri 2.0 monorepo with React/TypeScript frontend, Rust native backend for system operations, and a Fastify API server with PostgreSQL. The desktop app communicates with the API server for auth, catalog, payments, and library. Rust handles downloads, game launching, and OS keyring.

**Tech Stack:** Tauri 2.0, React 18, TypeScript, Tailwind CSS, Zustand, Fastify, Prisma, PostgreSQL, iyzico sandbox, Zod

**Spec:** `docs/superpowers/specs/2026-03-19-stealike-platform-design.md`

---

## File Structure

```
stealike/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── download.rs
│       │   ├── launcher.rs
│       │   ├── auth.rs
│       │   └── files.rs
│       └── (no models.rs — types are colocated in command files)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── StorePage.tsx
│   │   ├── GameDetailPage.tsx
│   │   ├── LibraryPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── SettingsPage.tsx
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── GameCard.tsx
│   │   ├── InstallmentSelector.tsx
│   │   └── DownloadProgress.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── downloadStore.ts
│   └── lib/
│       ├── api.ts
│       └── types.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── games.ts
│   │   │   ├── library.ts
│   │   │   └── payments.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── game.service.ts
│   │   │   ├── library.service.ts
│   │   │   ├── payment.service.ts
│   │   │   └── pricing.service.ts
│   │   ├── plugins/
│   │   │   ├── auth.plugin.ts
│   │   │   └── iyzico.plugin.ts
│   │   ├── schemas/
│   │   │   ├── auth.schema.ts
│   │   │   ├── game.schema.ts
│   │   │   └── payment.schema.ts
│   │   └── lib/
│   │       ├── prisma.ts
│   │       ├── jwt.ts
│   │       └── errors.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   └── tests/
│       ├── auth.test.ts
│       ├── games.test.ts
│       ├── library.test.ts
│       ├── payments.test.ts
│       └── pricing.test.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── index.html
├── docker-compose.yml
└── .env.example
```

---

## Chunk 1: Project Scaffolding & Database

### Task 1: Initialize Tauri + React Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Create Tauri project**

```bash
cd e:/PROJELER/Stealike
npm create tauri-app@latest . -- --template react-ts --manager npm
```

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand @tanstack/react-router react-icons
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind**

In `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

In `src/main.tsx`, add at top:
```typescript
import "./index.css";
```

Create `src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Verify Tauri dev builds**

```bash
npm run tauri dev
```

Expected: Tauri window opens with React app.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html src/ src-tauri/ .gitignore
git commit -m "feat: initialize Tauri + React + Tailwind project"
```

### Task 2: Initialize Server Project

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`, `server/src/app.ts`

- [ ] **Step 1: Init server package**

```bash
mkdir -p server/src
cd server
npm init -y
npm install fastify @fastify/cors @fastify/rate-limit @fastify/helmet @prisma/client zod argon2 jsonwebtoken iyzipay
npm install -D typescript @types/node @types/jsonwebtoken tsx vitest prisma @faker-js/faker
npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext --outDir dist --rootDir src --strict --esModuleInterop
cd ..
```

- [ ] **Step 2: Create server entry**

`server/src/app.ts`:
```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
```

`server/src/index.ts`:
```typescript
import { buildApp } from "./app.js";

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3001, host: "0.0.0.0" });
};

start();
```

- [ ] **Step 3: Add server scripts to package.json**

In `server/package.json` add:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 4: Test server starts**

```bash
cd server && npm run dev
```

Verify: `curl http://localhost:3001/health` returns `{"status":"ok"}`

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat: initialize Fastify server with health endpoint"
```

### Task 3: Database Schema & Prisma Setup

**Files:**
- Create: `server/prisma/schema.prisma`, `server/src/lib/prisma.ts`

- [ ] **Step 1: Create Prisma schema**

`server/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GameStatus {
  DRAFT
  PUBLISHED
  DELISTED
}

enum PaymentMethod {
  CREDIT_CARD
  PAPARA
  ININAL
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum ReferralOwnerType {
  CREATOR
  USER
}

model User {
  id                 String        @id @default(uuid()) @db.Uuid
  email              String        @unique
  username           String        @unique
  passwordHash       String        @map("password_hash")
  avatarUrl          String?       @map("avatar_url")
  isStudent          Boolean       @default(false) @map("is_student")
  studentVerifiedAt  DateTime?     @map("student_verified_at")
  referralCode       String        @unique @map("referral_code")
  referredBy         String?       @map("referred_by") @db.Uuid
  createdAt          DateTime      @default(now()) @map("created_at")
  updatedAt          DateTime      @updatedAt @map("updated_at")

  referrer           User?         @relation("UserReferrals", fields: [referredBy], references: [id])
  referees           User[]        @relation("UserReferrals")
  libraryItems       LibraryItem[]
  payments           Payment[]
  referral           Referral?

  @@map("users")
}

model Publisher {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  slug            String   @unique
  logoUrl         String?  @map("logo_url")
  contactEmail    String   @map("contact_email")
  commissionRate  Decimal  @default(0.80) @map("commission_rate") @db.Decimal(5, 4)
  isVerified      Boolean  @default(false) @map("is_verified")
  createdAt       DateTime @default(now()) @map("created_at")

  games           Game[]

  @@map("publishers")
}

model Game {
  id               String     @id @default(uuid()) @db.Uuid
  title            String
  slug             String     @unique
  description      String
  shortDescription String     @map("short_description")
  price            Decimal    @db.Decimal(10, 2)
  discountPercent  Int        @default(0) @map("discount_percent")
  coverImageUrl    String     @map("cover_image_url")
  screenshots      Json       @default("[]")
  publisherId      String     @map("publisher_id") @db.Uuid
  minRequirements  Json       @default("{}") @map("min_requirements")
  releaseDate      DateTime   @map("release_date")
  status           GameStatus @default(PUBLISHED)
  downloadUrl      String?    @map("download_url")
  downloadSize     BigInt?    @map("download_size")
  fileHash         String?    @map("file_hash")
  createdAt        DateTime   @default(now()) @map("created_at")

  publisher        Publisher     @relation(fields: [publisherId], references: [id])
  libraryItems     LibraryItem[]
  payments         Payment[]

  @@index([status, releaseDate])
  @@map("games")
}

model LibraryItem {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  gameId       String    @map("game_id") @db.Uuid
  purchasedAt  DateTime  @default(now()) @map("purchased_at")
  installPath  String?   @map("install_path")
  playTimeMins Int       @default(0) @map("play_time_mins")
  lastPlayedAt DateTime? @map("last_played_at")

  user         User      @relation(fields: [userId], references: [id])
  game         Game      @relation(fields: [gameId], references: [id])

  @@unique([userId, gameId])
  @@index([userId])
  @@map("library_items")
}

model Payment {
  id                     String        @id @default(uuid()) @db.Uuid
  userId                 String        @map("user_id") @db.Uuid
  gameId                 String        @map("game_id") @db.Uuid
  basePrice              Decimal       @map("base_price") @db.Decimal(10, 2)
  discountAmount         Decimal       @default(0) @map("discount_amount") @db.Decimal(10, 2)
  finalAmount            Decimal       @map("final_amount") @db.Decimal(10, 2)
  currency               String        @default("TRY")
  installmentCount       Int           @default(1) @map("installment_count")
  paymentMethod          PaymentMethod @map("payment_method")
  provider               String        @default("iyzico")
  providerTxId           String?       @unique @map("provider_tx_id")
  status                 PaymentStatus @default(PENDING)
  referralId             String?       @map("referral_id") @db.Uuid
  studentDiscountApplied Boolean       @default(false) @map("student_discount_applied")
  createdAt              DateTime      @default(now()) @map("created_at")

  user                   User          @relation(fields: [userId], references: [id])
  game                   Game          @relation(fields: [gameId], references: [id])
  referral               Referral?     @relation(fields: [referralId], references: [id])

  @@index([userId, status])
  @@index([providerTxId])
  @@map("payments")
}

model Referral {
  id                String            @id @default(uuid()) @db.Uuid
  code              String            @unique
  ownerId           String            @unique @map("owner_id") @db.Uuid
  ownerType         ReferralOwnerType @default(USER) @map("owner_type")
  discountPercent   Int               @default(5) @map("discount_percent")
  commissionPercent Int               @default(1) @map("commission_percent")
  totalUses         Int               @default(0) @map("total_uses")
  totalEarnings     Decimal           @default(0) @map("total_earnings") @db.Decimal(10, 2)
  isActive          Boolean           @default(true) @map("is_active")
  createdAt         DateTime          @default(now()) @map("created_at")

  owner             User              @relation(fields: [ownerId], references: [id])
  payments          Payment[]

  @@index([code])
  @@map("referrals")
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}
```

- [ ] **Step 2: Create Prisma client singleton**

`server/src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Create .env.example, .gitignore, docker-compose.yml**

Create `server/.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stealike?schema=public"
JWT_SECRET="dev-secret-change-in-production"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production"
IYZICO_API_KEY="sandbox-api-key"
IYZICO_SECRET_KEY="sandbox-secret-key"
IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
API_URL="http://localhost:3001"
```

Create `docker-compose.yml` at project root:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: stealike
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Add to project root `.gitignore`:
```
node_modules/
dist/
target/
.env
.superpowers/
```

```bash
cp server/.env.example server/.env
docker compose up -d
cd server && npx prisma migrate dev --name init
```

- [ ] **Step 4: Commit**

```bash
git add server/prisma/ server/src/lib/prisma.ts server/.env.example docker-compose.yml .gitignore
git commit -m "feat: add Prisma schema with all tables, docker-compose, env template"
```

### Task 4: Seed Database with Mock Games

**Files:**
- Create: `server/prisma/seed.ts`

- [ ] **Step 1: Write seed script**

`server/prisma/seed.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Publisher
  const publisher = await prisma.publisher.upsert({
    where: { slug: "demo-publisher" },
    update: {},
    create: {
      name: "Demo Publisher",
      slug: "demo-publisher",
      contactEmail: "demo@stealike.com",
      commissionRate: 0.80,
      isVerified: true,
    },
  });

  const games = [
    {
      title: "Galactic Odyssey",
      slug: "galactic-odyssey",
      description: "Uzay keşif ve macera oyunu. Galaksiler arası yolculuğa çık, yeni gezegenler keşfet ve uzaylı medeniyetlerle tanış.",
      shortDescription: "Epik uzay keşif macerası",
      price: 499.99,
      coverImageUrl: "https://picsum.photos/seed/game1/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game1s1/1920/1080",
        "https://picsum.photos/seed/game1s2/1920/1080",
        "https://picsum.photos/seed/game1s3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-8400", gpu: "GTX 1060", ram: "8 GB", storage: "50 GB" }),
      releaseDate: new Date("2025-06-15"),
      downloadSize: BigInt(25 * 1024 * 1024),
    },
    {
      title: "Shadow Realm",
      slug: "shadow-realm",
      description: "Karanlık fantezi dünyasında geçen aksiyon RPG. Güçlü büyüler öğren, efsanevi silahlar topla ve karanlık lordu yenilgiye uğrat.",
      shortDescription: "Karanlık fantezi aksiyon RPG",
      price: 349.99,
      coverImageUrl: "https://picsum.photos/seed/game2/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game2s1/1920/1080",
        "https://picsum.photos/seed/game2s2/1920/1080",
        "https://picsum.photos/seed/game2s3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-6600", gpu: "GTX 970", ram: "8 GB", storage: "35 GB" }),
      releaseDate: new Date("2025-03-22"),
      downloadSize: BigInt(18 * 1024 * 1024),
    },
    {
      title: "Speed Legends",
      slug: "speed-legends",
      description: "Adrenalin dolu yarış oyunu. 50'den fazla araç, 30+ pist ve online multiplayer ile yarışın keyfini çıkar.",
      shortDescription: "Arcade yarış deneyimi",
      price: 249.99,
      coverImageUrl: "https://picsum.photos/seed/game3/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game3s1/1920/1080",
        "https://picsum.photos/seed/game3s2/1920/1080",
        "https://picsum.photos/seed/game3s3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-8100", gpu: "GTX 750 Ti", ram: "4 GB", storage: "20 GB" }),
      releaseDate: new Date("2025-01-10"),
      downloadSize: BigInt(12 * 1024 * 1024),
    },
    {
      title: "Fortress Builder",
      slug: "fortress-builder",
      description: "Stratejik kale inşa ve savunma oyunu. Kendi kaleni tasarla, ordu kur ve düşman saldırılarına karşı savun.",
      shortDescription: "Kale inşa ve strateji",
      price: 179.99,
      coverImageUrl: "https://picsum.photos/seed/game4/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game4s1/1920/1080",
        "https://picsum.photos/seed/game4s2/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-6100", gpu: "GTX 660", ram: "4 GB", storage: "10 GB" }),
      releaseDate: new Date("2024-11-05"),
      downloadSize: BigInt(8 * 1024 * 1024),
    },
    {
      title: "Cyber Strike",
      slug: "cyber-strike",
      description: "Cyberpunk temalı FPS. Neon ışıklı sokaklarda, siber geliştirmeler ve gelişmiş silahlarla savaş.",
      shortDescription: "Cyberpunk FPS aksiyonu",
      price: 599.99,
      coverImageUrl: "https://picsum.photos/seed/game5/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game5s1/1920/1080",
        "https://picsum.photos/seed/game5s2/1920/1080",
        "https://picsum.photos/seed/game5s3/1920/1080",
        "https://picsum.photos/seed/game5s4/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i7-8700", gpu: "RTX 2060", ram: "16 GB", storage: "70 GB" }),
      releaseDate: new Date("2025-09-01"),
      downloadSize: BigInt(35 * 1024 * 1024),
    },
    {
      title: "Ocean Explorer",
      slug: "ocean-explorer",
      description: "Derin deniz keşif ve hayatta kalma oyunu. Okyanus derinliklerini keşfet, denizaltını güçlendir ve gizemli yaratıklarla karşılaş.",
      shortDescription: "Derin deniz macerası",
      price: 299.99,
      discountPercent: 20,
      coverImageUrl: "https://picsum.photos/seed/game6/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game6s1/1920/1080",
        "https://picsum.photos/seed/game6s2/1920/1080",
        "https://picsum.photos/seed/game6s3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-7500", gpu: "GTX 1050 Ti", ram: "8 GB", storage: "25 GB" }),
      releaseDate: new Date("2024-07-20"),
      downloadSize: BigInt(15 * 1024 * 1024),
    },
    {
      title: "Pixel Warriors",
      slug: "pixel-warriors",
      description: "Retro pixel art aksiyon platformer. 100+ bölüm, boss savaşları ve kooperatif mod ile klasik oyun keyfi.",
      shortDescription: "Retro aksiyon platformer",
      price: 89.99,
      coverImageUrl: "https://picsum.photos/seed/game7/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game7s1/1920/1080",
        "https://picsum.photos/seed/game7s2/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Any dual-core", gpu: "Integrated", ram: "2 GB", storage: "500 MB" }),
      releaseDate: new Date("2024-04-12"),
      downloadSize: BigInt(2 * 1024 * 1024),
    },
    {
      title: "Anadolu Efsaneleri",
      slug: "anadolu-efsaneleri",
      description: "Türk mitolojisinden ilham alan aksiyon macera oyunu. Anadolu'nun kadim topraklarında destansı bir yolculuğa çık.",
      shortDescription: "Türk mitolojisi aksiyon macera",
      price: 399.99,
      coverImageUrl: "https://picsum.photos/seed/game8/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/game8s1/1920/1080",
        "https://picsum.photos/seed/game8s2/1920/1080",
        "https://picsum.photos/seed/game8s3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-9400", gpu: "GTX 1660", ram: "12 GB", storage: "45 GB" }),
      releaseDate: new Date("2025-10-29"),
      downloadSize: BigInt(28 * 1024 * 1024),
    },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: {
        ...game,
        downloadUrl: `http://localhost:3001/public/downloads/${game.slug}.zip`,
        publisherId: publisher.id,
        status: "PUBLISHED",
      },
    });
  }

  console.log(`Seeded ${games.length} games`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Create demo download files**

```bash
mkdir -p server/public/downloads
# Create small placeholder zip files for each game
for slug in galactic-odyssey shadow-realm speed-legends fortress-builder cyber-strike ocean-explorer pixel-warriors anadolu-efsaneleri; do
  echo "Stealike Demo - $slug" > "/tmp/$slug.txt"
  cd /tmp && zip -j "e:/PROJELER/Stealike/server/public/downloads/$slug.zip" "$slug.txt" && cd -
done
```

Add static file serving to `server/src/app.ts`:
```typescript
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ... inside buildApp(), after other plugins:
await app.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
  prefix: "/public/",
});
```

Install: `cd server && npm install @fastify/static`

Update all seed game entries to include `downloadUrl: "http://localhost:3001/public/downloads/<slug>.zip"` (set in the seed script above for each game).

- [ ] **Step 3: Add seed config and run**

In `server/package.json`, add:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

```bash
cd server && npx prisma db seed
```

Expected: "Seeded 8 games"

- [ ] **Step 3: Commit**

```bash
git add server/prisma/seed.ts server/package.json
git commit -m "feat: add seed script with 8 mock games"
```

---

## Chunk 2: Auth System

### Task 5: JWT & Error Utilities

**Files:**
- Create: `server/src/lib/jwt.ts`, `server/src/lib/errors.ts`, `.env.example`

- [ ] **Step 1: Write JWT utility**

`server/src/lib/jwt.ts`:
```typescript
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}
```

- [ ] **Step 2: Write error helpers**

`server/src/lib/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(message = "Not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function conflict(message = "Conflict") {
  return new AppError(409, "CONFLICT", message);
}

export function badRequest(message = "Bad request") {
  return new AppError(400, "BAD_REQUEST", message);
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, "FORBIDDEN", message);
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/
git commit -m "feat: add JWT utilities and error helpers"
```

### Task 6: Auth Plugin (Middleware)

**Files:**
- Create: `server/src/plugins/auth.plugin.ts`

- [ ] **Step 1: Write auth plugin**

`server/src/plugins/auth.plugin.ts`:
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { verifyAccessToken, TokenPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    }
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
  });
}

export default fp(authPlugin);
```

- [ ] **Step 2: Install fastify-plugin**

```bash
cd server && npm install fastify-plugin
```

- [ ] **Step 3: Register in app.ts**

Update `server/src/app.ts` to import and register the plugin:
```typescript
import authPlugin from "./plugins/auth.plugin.js";
// ... after other plugins
await app.register(authPlugin);
```

- [ ] **Step 4: Commit**

```bash
git add server/src/plugins/auth.plugin.ts server/src/app.ts
git commit -m "feat: add JWT auth middleware plugin"
```

### Task 7: Auth Service & Routes

**Files:**
- Create: `server/src/services/auth.service.ts`, `server/src/schemas/auth.schema.ts`, `server/src/routes/auth.ts`
- Test: `server/tests/auth.test.ts`

- [ ] **Step 1: Write auth schema**

`server/src/schemas/auth.schema.ts`:
```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const verifyStudentSchema = z.object({
  studentEmail: z.string().email().refine(
    (email) => email.endsWith(".edu.tr"),
    { message: "Must be a .edu.tr email address" }
  ),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Write auth service**

`server/src/services/auth.service.ts`:
```typescript
import { hash, verify } from "argon2";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { conflict, unauthorized, badRequest, notFound } from "../lib/errors.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

function generateReferralCode(username: string): string {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${username.toUpperCase()}-${suffix}`;
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) throw conflict("Email or username already exists");

  const passwordHash = await hash(input.password);
  const referralCode = generateReferralCode(input.username);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      referralCode,
    },
  });

  // Create referral entry
  await prisma.referral.create({
    data: {
      code: referralCode,
      ownerId: user.id,
      ownerType: "USER",
      discountPercent: 5,
      commissionPercent: 1,
    },
  });

  const tokens = await createTokens(user.id, user.email);

  return {
    user: { id: user.id, email: user.email, username: user.username, referralCode },
    tokens,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized("Invalid credentials");

  const valid = await verify(user.passwordHash, input.password);
  if (!valid) throw unauthorized("Invalid credentials");

  const tokens = await createTokens(user.id, user.email);

  return {
    user: { id: user.id, email: user.email, username: user.username, isStudent: user.isStudent, referralCode: user.referralCode },
    tokens,
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");

  // Delete used token (rotation)
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  return createTokens(payload.userId, payload.email);
}

export async function verifyStudent(userId: string, studentEmail: string) {
  if (!studentEmail.endsWith(".edu.tr")) throw badRequest("Must be a .edu.tr email");

  await prisma.user.update({
    where: { id: userId },
    data: { isStudent: true, studentVerifiedAt: new Date() },
  });

  return { verified: true };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, isStudent: true, referralCode: true, createdAt: true },
  });
  if (!user) throw notFound("User not found");
  return user;
}

async function createTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });

  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}
```

- [ ] **Step 3: Write auth routes**

`server/src/routes/auth.ts`:
```typescript
import { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, refreshSchema, verifyStudentSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";
import { AppError } from "../lib/errors.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerUser(body);
    return reply.status(201).send({ data: result });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body);
    return reply.send({ data: result });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refreshTokens(body.refreshToken);
    return reply.send({ data: { tokens } });
  });

  app.post("/auth/verify-student", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const body = verifyStudentSchema.parse(request.body);
      const result = await authService.verifyStudent(request.user!.userId, body.studentEmail);
      return reply.send({ data: result });
    },
  });

  app.get("/auth/me", {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const user = await authService.getProfile(request.user!.userId);
      return reply.send({ data: user });
    },
  });
}
```

- [ ] **Step 4: Register routes and add global error handler in app.ts**

Update `server/src/app.ts`:
```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join } from "path";
import { fileURLToPath } from "url";
import authPlugin from "./plugins/auth.plugin.js";
import authRoutes from "./routes/auth.js";
import { AppError } from "./lib/errors.js";
import { ZodError } from "zod";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/public/",
  });
  await app.register(authPlugin);

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: error.errors[0]?.message || "Invalid input" },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);

  return app;
}
```

- [ ] **Step 5: Write auth tests**

`server/tests/auth.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: "test" } } });
  await prisma.$disconnect();
  await app.close();
});

describe("POST /auth/register", () => {
  it("creates a new user and returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@test.com", username: "testuser", password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.user.email).toBe("test@test.com");
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();
  });

  it("returns 409 for duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@test.com", username: "testuser2", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("POST /auth/login", () => {
  it("returns tokens for valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /auth/verify-student", () => {
  it("verifies student with .edu.tr email", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    const token = JSON.parse(login.body).data.tokens.accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-student",
      headers: { authorization: `Bearer ${token}` },
      payload: { studentEmail: "student@university.edu.tr" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.verified).toBe(true);
  });

  it("rejects non-.edu.tr email", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@test.com", password: "password123" },
    });
    const token = JSON.parse(login.body).data.tokens.accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-student",
      headers: { authorization: `Bearer ${token}` },
      payload: { studentEmail: "student@gmail.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd server && npm test -- --run
```

Expected: All 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/ server/tests/
git commit -m "feat: add auth system with register, login, refresh, student verify"
```

---

## Chunk 3: Game Catalog & Library API

### Task 8: Games Service & Routes

**Files:**
- Create: `server/src/services/game.service.ts`, `server/src/schemas/game.schema.ts`, `server/src/routes/games.ts`
- Test: `server/tests/games.test.ts`

- [ ] **Step 1: Write game schema**

`server/src/schemas/game.schema.ts`:
```typescript
import { z } from "zod";

export const gameListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(["PUBLISHED", "DRAFT", "DELISTED"]).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(100),
});
```

- [ ] **Step 2: Write game service**

`server/src/services/game.service.ts`:
```typescript
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

export async function listGames(page: number, limit: number) {
  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where: { status: "PUBLISHED" },
      include: { publisher: { select: { name: true, slug: true } } },
      orderBy: { releaseDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { games, total, page };
}

export async function getGameBySlug(slug: string) {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { publisher: { select: { name: true, slug: true } } },
  });
  if (!game || game.status !== "PUBLISHED") throw notFound("Game not found");
  return game;
}

export async function getFeaturedGames() {
  return prisma.game.findMany({
    where: { status: "PUBLISHED" },
    include: { publisher: { select: { name: true, slug: true } } },
    orderBy: { releaseDate: "desc" },
    take: 6,
  });
}

export async function searchGames(query: string) {
  const games = await prisma.game.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { shortDescription: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { publisher: { select: { name: true, slug: true } } },
    take: 20,
  });
  return { games, total: games.length };
}
```

- [ ] **Step 3: Write game routes**

`server/src/routes/games.ts`:
```typescript
import { FastifyInstance } from "fastify";
import { gameListSchema, searchSchema } from "../schemas/game.schema.js";
import * as gameService from "../services/game.service.js";

export default async function gameRoutes(app: FastifyInstance) {
  app.get("/games", async (request, reply) => {
    const { page, limit } = gameListSchema.parse(request.query);
    const result = await gameService.listGames(page, limit);
    return reply.send({ data: result.games, meta: { total: result.total, page: result.page } });
  });

  app.get("/games/featured", async (request, reply) => {
    const games = await gameService.getFeaturedGames();
    return reply.send({ data: games });
  });

  app.get("/games/search", async (request, reply) => {
    const { q } = searchSchema.parse(request.query);
    const result = await gameService.searchGames(q);
    return reply.send({ data: result.games, meta: { total: result.total } });
  });

  app.get("/games/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const game = await gameService.getGameBySlug(slug);
    return reply.send({ data: game });
  });
}
```

- [ ] **Step 4: Register routes in app.ts**

Add to `server/src/app.ts`:
```typescript
import gameRoutes from "./routes/games.js";
// ... after authRoutes
await app.register(gameRoutes);
```

- [ ] **Step 5: Write games tests**

`server/tests/games.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

describe("GET /games", () => {
  it("returns paginated game list", async () => {
    const res = await app.inject({ method: "GET", url: "/games" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta.total).toBeGreaterThan(0);
  });
});

describe("GET /games/featured", () => {
  it("returns featured games", async () => {
    const res = await app.inject({ method: "GET", url: "/games/featured" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeLessThanOrEqual(6);
  });
});

describe("GET /games/:slug", () => {
  it("returns game by slug", async () => {
    const res = await app.inject({ method: "GET", url: "/games/galactic-odyssey" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.title).toBe("Galactic Odyssey");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.inject({ method: "GET", url: "/games/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /games/search", () => {
  it("searches by title", async () => {
    const res = await app.inject({ method: "GET", url: "/games/search?q=shadow" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd server && npm test -- --run
```

- [ ] **Step 7: Commit**

```bash
git add server/src/services/game.service.ts server/src/schemas/game.schema.ts server/src/routes/games.ts server/tests/games.test.ts server/src/app.ts
git commit -m "feat: add game catalog API with list, detail, featured, search"
```

### Task 9: Library Service & Routes

**Files:**
- Create: `server/src/services/library.service.ts`, `server/src/routes/library.ts`
- Test: `server/tests/library.test.ts`

- [ ] **Step 1: Write library service**

`server/src/services/library.service.ts`:
```typescript
import { prisma } from "../lib/prisma.js";
import { notFound, forbidden } from "../lib/errors.js";

export async function getUserLibrary(userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId },
    include: {
      game: {
        include: { publisher: { select: { name: true } } },
      },
    },
    orderBy: { purchasedAt: "desc" },
  });
}

export async function updatePlayTime(userId: string, itemId: string, playTimeMins: number) {
  const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Library item not found");
  if (item.userId !== userId) throw forbidden("Not your library item");

  return prisma.libraryItem.update({
    where: { id: itemId },
    data: { playTimeMins, lastPlayedAt: new Date() },
  });
}

export async function getDownloadUrl(userId: string, itemId: string) {
  const item = await prisma.libraryItem.findUnique({
    where: { id: itemId },
    include: { game: true },
  });
  if (!item) throw notFound("Library item not found");
  if (item.userId !== userId) throw forbidden("Not your library item");

  // For demo: return direct URL. In production: S3 pre-signed URL
  const url = item.game.downloadUrl || `https://demo.stealike.com/downloads/${item.game.slug}.zip`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  return { url, expires_at: expiresAt.toISOString() };
}
```

- [ ] **Step 2: Write library routes**

`server/src/routes/library.ts`:
```typescript
import { FastifyInstance } from "fastify";
import * as libraryService from "../services/library.service.js";

export default async function libraryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/library", async (request) => {
    const items = await libraryService.getUserLibrary(request.user!.userId);
    return { data: items };
  });

  app.patch("/library/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { playTimeMins } = request.body as { playTimeMins: number };
    const item = await libraryService.updatePlayTime(request.user!.userId, id, playTimeMins);
    return { data: item };
  });

  app.get("/library/:id/download", async (request) => {
    const { id } = request.params as { id: string };
    const result = await libraryService.getDownloadUrl(request.user!.userId, id);
    return { data: result };
  });
}
```

- [ ] **Step 3: Register in app.ts**

Add to `server/src/app.ts`:
```typescript
import libraryRoutes from "./routes/library.js";
// ... after gameRoutes
await app.register(libraryRoutes);
```

- [ ] **Step 4: Write library tests**

`server/tests/library.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;
let userId: string;
let gameId: string;
let libraryItemId: string;

beforeAll(async () => {
  app = await buildApp();

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: "libtest@example.com",
      username: "libtest",
      passwordHash: "fakehash",
      referralCode: "LIBTEST01",
    },
  });
  userId = user.id;
  token = signAccessToken({ userId: user.id, email: user.email });

  // Create test publisher + game
  const publisher = await prisma.publisher.create({
    data: { name: "Test Pub", slug: "test-pub", contactEmail: "pub@test.com" },
  });
  const game = await prisma.game.create({
    data: {
      title: "Library Test Game",
      slug: "library-test-game",
      description: "A test game",
      shortDescription: "A test game",
      price: 100,
      coverImageUrl: "https://example.com/cover.jpg",
      releaseDate: new Date(),
      publisherId: publisher.id,
    },
  });
  gameId = game.id;

  // Create library item (simulating a purchase)
  const item = await prisma.libraryItem.create({
    data: { userId: user.id, gameId: game.id },
  });
  libraryItemId = item.id;
});

afterAll(async () => {
  await prisma.libraryItem.deleteMany({ where: { userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.publisher.deleteMany({});
  await app.close();
});

describe("Library API", () => {
  it("GET /library — returns user library", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/library",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].game.title).toBe("Library Test Game");
  });

  it("GET /library — 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/library" });
    expect(res.statusCode).toBe(401);
  });

  it("PATCH /library/:id — updates play time", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/library/${libraryItemId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { playTimeMins: 120 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.playTimeMins).toBe(120);
    expect(res.json().data.lastPlayedAt).toBeTruthy();
  });

  it("GET /library/:id/download — returns signed URL", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/library/${libraryItemId}/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.url).toContain("library-test-game");
    expect(res.json().data.expires_at).toBeTruthy();
  });

  it("GET /library/:id/download — 404 for invalid item", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/library/00000000-0000-0000-0000-000000000000/download",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 5: Run library tests**

Run: `cd server && npx vitest run tests/library.test.ts`
Expected: 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add server/tests/library.test.ts server/src/services/library.service.ts server/src/routes/library.ts server/src/app.ts
git commit -m "feat: add library API with list, play time update, download URL"
```

---

## Chunk 4: Payment System

### Task 10: Pricing Service

**Files:**
- Create: `server/src/services/pricing.service.ts`
- Test: `server/tests/pricing.test.ts`

- [ ] **Step 1: Write pricing test**

`server/tests/pricing.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculatePrice } from "../src/services/pricing.service.js";

describe("calculatePrice", () => {
  it("returns base price with no discounts", () => {
    const result = calculatePrice(500, { isStudent: false, referralDiscount: 0, gameDiscount: 0 });
    expect(result.finalAmount).toBe(500);
    expect(result.discountAmount).toBe(0);
  });

  it("applies student discount", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 0, gameDiscount: 0 });
    expect(result.finalAmount).toBe(450);
    expect(result.studentDiscountApplied).toBe(true);
  });

  it("applies referral discount", () => {
    const result = calculatePrice(500, { isStudent: false, referralDiscount: 5, gameDiscount: 0 });
    expect(result.finalAmount).toBe(475);
  });

  it("stacks student + referral (max 15%)", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 5, gameDiscount: 0 });
    expect(result.finalAmount).toBe(425);
    expect(result.discountAmount).toBe(75);
  });

  it("caps total discount at 15%", () => {
    const result = calculatePrice(500, { isStudent: true, referralDiscount: 5, gameDiscount: 10 });
    expect(result.finalAmount).toBe(425); // 15% max
  });

  it("applies game discount alone", () => {
    const result = calculatePrice(300, { isStudent: false, referralDiscount: 0, gameDiscount: 20 });
    expect(result.finalAmount).toBe(240);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
cd server && npx vitest run tests/pricing.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write pricing service**

`server/src/services/pricing.service.ts`:
```typescript
interface PriceInput {
  isStudent: boolean;
  referralDiscount: number; // percent
  gameDiscount: number; // percent
}

interface PriceResult {
  basePrice: number;
  discountAmount: number;
  finalAmount: number;
  studentDiscountApplied: boolean;
  discountBreakdown: {
    student: number;
    referral: number;
    game: number;
    totalPercent: number;
  };
}

const MAX_DISCOUNT_PERCENT = 15;
const STUDENT_DISCOUNT_PERCENT = 10;

export function calculatePrice(basePrice: number, input: PriceInput): PriceResult {
  let totalPercent = 0;
  const breakdown = { student: 0, referral: 0, game: 0, totalPercent: 0 };

  // Game discount first
  if (input.gameDiscount > 0) {
    breakdown.game = input.gameDiscount;
    totalPercent += input.gameDiscount;
  }

  // Student discount
  let studentApplied = false;
  if (input.isStudent) {
    const studentPercent = Math.min(STUDENT_DISCOUNT_PERCENT, MAX_DISCOUNT_PERCENT - totalPercent);
    if (studentPercent > 0) {
      breakdown.student = studentPercent;
      totalPercent += studentPercent;
      studentApplied = true;
    }
  }

  // Referral discount
  if (input.referralDiscount > 0) {
    const referralPercent = Math.min(input.referralDiscount, MAX_DISCOUNT_PERCENT - totalPercent);
    if (referralPercent > 0) {
      breakdown.referral = referralPercent;
      totalPercent += referralPercent;
    }
  }

  // Cap
  totalPercent = Math.min(totalPercent, MAX_DISCOUNT_PERCENT);
  breakdown.totalPercent = totalPercent;

  const discountAmount = Math.round((basePrice * totalPercent) / 100 * 100) / 100;
  const finalAmount = Math.round((basePrice - discountAmount) * 100) / 100;

  return {
    basePrice,
    discountAmount,
    finalAmount,
    studentDiscountApplied: studentApplied,
    discountBreakdown: breakdown,
  };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd server && npx vitest run tests/pricing.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/pricing.service.ts server/tests/pricing.test.ts
git commit -m "feat: add pricing service with student/referral/game discount stacking"
```

### Task 11: Payment Service & Routes

**Files:**
- Create: `server/src/services/payment.service.ts`, `server/src/schemas/payment.schema.ts`, `server/src/routes/payments.ts`, `server/src/plugins/iyzico.plugin.ts`
- Test: `server/tests/payments.test.ts`

- [ ] **Step 1: Write iyzico plugin (sandbox wrapper)**

`server/src/plugins/iyzico.plugin.ts`:
```typescript
import Iyzipay from "iyzipay";

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY || "sandbox-api-key",
  secretKey: process.env.IYZICO_SECRET_KEY || "sandbox-secret-key",
  uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
});

export function getInstallmentInfo(binNumber: string, price: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = { locale: "tr", binNumber, price };
    iyzipay.installmentInfo.retrieve(request, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function createPayment(paymentRequest: any): Promise<any> {
  return new Promise((resolve, reject) => {
    iyzipay.threedsInitialize.create(paymentRequest, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function handleCallback(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    iyzipay.threedsPayment.create({ locale: "tr", paymentId: token }, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
```

- [ ] **Step 2: Write payment schema**

`server/src/schemas/payment.schema.ts`:
```typescript
import { z } from "zod";

export const paymentInitSchema = z.object({
  gameId: z.string().uuid(),
  referralCode: z.string().optional(),
  paymentMethod: z.enum(["CREDIT_CARD", "PAPARA", "ININAL"]).default("CREDIT_CARD"),
  cardNumber: z.string().optional(),
  cardHolderName: z.string().optional(),
  expireMonth: z.string().optional(),
  expireYear: z.string().optional(),
  cvc: z.string().optional(),
  installmentCount: z.number().int().min(1).max(12).default(1),
});

export const installmentQuerySchema = z.object({
  binNumber: z.string().length(6),
  price: z.string(),
});
```

- [ ] **Step 3: Write payment service**

`server/src/services/payment.service.ts`:
```typescript
import { prisma } from "../lib/prisma.js";
import { notFound, badRequest, conflict } from "../lib/errors.js";
import { calculatePrice } from "./pricing.service.js";
import * as iyzico from "../plugins/iyzico.plugin.js";
import { randomUUID } from "crypto";

export async function initPayment(userId: string, input: {
  gameId: string;
  referralCode?: string;
  paymentMethod: string;
  installmentCount: number;
  cardNumber?: string;
  cardHolderName?: string;
  expireMonth?: string;
  expireYear?: string;
  cvc?: string;
}) {
  const game = await prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game) throw notFound("Game not found");

  // Check if already owned
  const existing = await prisma.libraryItem.findUnique({
    where: { userId_gameId: { userId, gameId: input.gameId } },
  });
  if (existing) throw conflict("Game already in library");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found");

  // Resolve referral
  let referral = null;
  let referralDiscount = 0;
  if (input.referralCode) {
    referral = await prisma.referral.findUnique({ where: { code: input.referralCode } });
    if (referral && referral.isActive && referral.ownerId !== userId) {
      referralDiscount = referral.discountPercent;
    }
  }

  // Calculate price
  const pricing = calculatePrice(Number(game.price), {
    isStudent: user.isStudent,
    referralDiscount,
    gameDiscount: game.discountPercent,
  });

  // Create pending payment
  const payment = await prisma.payment.create({
    data: {
      userId,
      gameId: input.gameId,
      basePrice: game.price,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
      installmentCount: input.installmentCount,
      paymentMethod: input.paymentMethod as any,
      referralId: referral?.id,
      studentDiscountApplied: pricing.studentDiscountApplied,
    },
  });

  // For demo/sandbox: create iyzico 3D Secure request
  if (input.paymentMethod === "CREDIT_CARD" && input.cardNumber) {
    const conversationId = payment.id;
    const request = {
      locale: "tr",
      conversationId,
      price: pricing.finalAmount.toString(),
      paidPrice: pricing.finalAmount.toString(),
      currency: "TRY",
      installment: input.installmentCount.toString(),
      paymentChannel: "WEB",
      paymentGroup: "PRODUCT",
      callbackUrl: `${process.env.API_URL || "http://localhost:3001"}/payments/callback`,
      paymentCard: {
        cardHolderName: input.cardHolderName,
        cardNumber: input.cardNumber,
        expireMonth: input.expireMonth,
        expireYear: input.expireYear,
        cvc: input.cvc,
      },
      buyer: {
        id: userId,
        name: user.username,
        surname: "User",
        email: user.email,
        identityNumber: "11111111111",
        registrationAddress: "Istanbul",
        city: "Istanbul",
        country: "Turkey",
        ip: "127.0.0.1",
      },
      shippingAddress: {
        contactName: user.username,
        city: "Istanbul",
        country: "Turkey",
        address: "Istanbul",
      },
      billingAddress: {
        contactName: user.username,
        city: "Istanbul",
        country: "Turkey",
        address: "Istanbul",
      },
      basketItems: [
        {
          id: game.id,
          name: game.title,
          category1: "Game",
          itemType: "VIRTUAL",
          price: pricing.finalAmount.toString(),
        },
      ],
    };

    try {
      const result = await iyzico.createPayment(request);
      return { payment_id: payment.id, three_d_html: result.threeDSHtmlContent || null };
    } catch {
      return { payment_id: payment.id, three_d_html: null };
    }
  }

  return { payment_id: payment.id, three_d_html: null };
}

export async function handleCallback(paymentToken: string) {
  // Idempotency: check if already processed
  const existing = await prisma.payment.findUnique({ where: { providerTxId: paymentToken } });
  if (existing && existing.status === "SUCCESS") return { already_processed: true };

  let result;
  try {
    result = await iyzico.handleCallback(paymentToken);
  } catch {
    return { success: false };
  }

  if (result.status !== "success") return { success: false };

  const conversationId = result.conversationId;

  // Transaction: update payment + create library item + update referral
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: conversationId },
      data: { status: "SUCCESS", providerTxId: paymentToken },
    });

    await tx.libraryItem.create({
      data: { userId: payment.userId, gameId: payment.gameId },
    });

    if (payment.referralId) {
      const commissionRate = 0.01; // 1% for users, looked up in practice
      const commission = Number(payment.finalAmount) * commissionRate;
      await tx.referral.update({
        where: { id: payment.referralId },
        data: {
          totalUses: { increment: 1 },
          totalEarnings: { increment: commission },
        },
      });
    }
  });

  return { success: true };
}

export async function getInstallments(binNumber: string, price: string) {
  try {
    return await iyzico.getInstallmentInfo(binNumber, price);
  } catch {
    return { installmentDetails: [] };
  }
}

export async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    include: { game: { select: { title: true, coverImageUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 4: Write payment routes**

`server/src/routes/payments.ts`:
```typescript
import { FastifyInstance } from "fastify";
import { paymentInitSchema, installmentQuerySchema } from "../schemas/payment.schema.js";
import * as paymentService from "../services/payment.service.js";

export default async function paymentRoutes(app: FastifyInstance) {
  app.post("/payments/init", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const body = paymentInitSchema.parse(request.body);
      const result = await paymentService.initPayment(request.user!.userId, body);
      return { data: result };
    },
  });

  app.post("/payments/callback", async (request) => {
    const { paymentId } = request.body as { paymentId: string };
    const result = await paymentService.handleCallback(paymentId);
    return { data: result };
  });

  app.get("/payments/installments", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { binNumber, price } = installmentQuerySchema.parse(request.query);
      const result = await paymentService.getInstallments(binNumber, price);
      return { data: result };
    },
  });

  app.get("/payments/history", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const payments = await paymentService.getPaymentHistory(request.user!.userId);
      return { data: payments };
    },
  });
}
```

- [ ] **Step 5: Register in app.ts**

Add to `server/src/app.ts`:
```typescript
import paymentRoutes from "./routes/payments.js";
await app.register(paymentRoutes);
```

- [ ] **Step 6: Write payment tests**

`server/tests/payments.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { FastifyInstance } from "fastify";

// Mock iyzico to avoid hitting real API in tests
vi.mock("../src/plugins/iyzico.plugin.js", () => ({
  getInstallmentInfo: vi.fn().mockResolvedValue({
    installmentDetails: [
      {
        binNumber: "454360",
        installmentPrices: [
          { installmentNumber: 1, totalPrice: "100.00" },
          { installmentNumber: 3, totalPrice: "103.00" },
          { installmentNumber: 6, totalPrice: "106.00" },
        ],
      },
    ],
  }),
  createPayment: vi.fn().mockResolvedValue({
    status: "success",
    threeDSHtmlContent: "<html>3D Secure Mock</html>",
  }),
  handleCallback: vi.fn().mockResolvedValue({
    status: "success",
    conversationId: "will-be-set",
    paymentId: "mock-provider-tx",
  }),
}));

let app: FastifyInstance;
let token: string;
let userId: string;
let gameId: string;

beforeAll(async () => {
  app = await buildApp();

  const user = await prisma.user.create({
    data: {
      email: "paytest@example.com",
      username: "paytest",
      passwordHash: "fakehash",
      referralCode: "PAYTEST01",
    },
  });
  userId = user.id;
  token = signAccessToken({ userId: user.id, email: user.email });

  const publisher = await prisma.publisher.create({
    data: { name: "Pay Pub", slug: "pay-pub", contactEmail: "pay@test.com" },
  });
  const game = await prisma.game.create({
    data: {
      title: "Payment Test Game",
      slug: "payment-test-game",
      description: "A test game for payment",
      shortDescription: "Payment test",
      price: 200,
      coverImageUrl: "https://example.com/cover.jpg",
      releaseDate: new Date(),
      publisherId: publisher.id,
    },
  });
  gameId = game.id;
});

afterAll(async () => {
  await prisma.libraryItem.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.publisher.deleteMany({});
  await app.close();
});

describe("Payment API", () => {
  it("GET /payments/installments — returns installment options", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/payments/installments?binNumber=454360&price=200",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.installmentDetails).toBeDefined();
    expect(body.data.installmentDetails[0].installmentPrices).toHaveLength(3);
  });

  it("POST /payments/init — creates payment and returns 3D HTML", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        gameId,
        paymentMethod: "CREDIT_CARD",
        installmentCount: 1,
        cardNumber: "4543600299100712",
        cardHolderName: "Test User",
        expireMonth: "12",
        expireYear: "2030",
        cvc: "123",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.payment_id).toBeTruthy();
    expect(body.data.three_d_html).toContain("3D Secure");
  });

  it("POST /payments/init — 401 without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      payload: { gameId, paymentMethod: "CREDIT_CARD", installmentCount: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /payments/history — returns empty for new user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/payments/history",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // May have 1 payment from init test (PENDING status)
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("POST /payments/init — 409 if game already owned", async () => {
    // First, add game to library directly
    await prisma.libraryItem.create({
      data: { userId, gameId },
    });

    const res = await app.inject({
      method: "POST",
      url: "/payments/init",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        gameId,
        paymentMethod: "CREDIT_CARD",
        installmentCount: 1,
        cardNumber: "4543600299100712",
        cardHolderName: "Test User",
        expireMonth: "12",
        expireYear: "2030",
        cvc: "123",
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
```

- [ ] **Step 7: Run payment tests**

Run: `cd server && npx vitest run tests/payments.test.ts`
Expected: 5 tests pass

- [ ] **Step 8: Commit**

```bash
git add server/tests/payments.test.ts server/src/services/payment.service.ts server/src/schemas/payment.schema.ts server/src/routes/payments.ts server/src/plugins/iyzico.plugin.ts server/src/app.ts
git commit -m "feat: add payment system with iyzico 3D Secure, installments, webhook"
```

---

## Chunk 5: Tauri Rust Commands

### Task 12: Rust Download Manager

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/download.rs`

- [ ] **Step 1: Add Rust dependencies**

In `src-tauri/Cargo.toml` add under `[dependencies]`:
```toml
reqwest = { version = "0.12", features = ["stream"] }
tokio = { version = "1", features = ["full"] }
sha2 = "0.10"
hex = "0.4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
keyring = "3"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Write download commands**

`src-tauri/src/commands/mod.rs`:
```rust
pub mod download;
pub mod launcher;
pub mod auth;
pub mod files;
```

`src-tauri/src/commands/download.rs`:
```rust
use reqwest::Client;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    download_id: String,
    percent: f64,
    speed_bps: u64,
    eta_secs: u64,
}

#[tauri::command]
pub async fn download_game(
    app: AppHandle,
    game_id: String,
    url: String,
    dest_path: String,
) -> Result<String, String> {
    let download_id = Uuid::new_v4().to_string();
    let download_id_clone = download_id.clone();

    tokio::spawn(async move {
        if let Err(e) = do_download(&app, &download_id_clone, &url, &dest_path).await {
            eprintln!("Download error: {}", e);
        }
    });

    Ok(download_id)
}

async fn do_download(
    app: &AppHandle,
    download_id: &str,
    url: &str,
    dest_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let response = client.get(url).send().await?;
    let total_size = response.content_length().unwrap_or(0);

    let path = PathBuf::from(dest_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::fs::File::create(&path).await?;
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 { (downloaded as f64 / elapsed) as u64 } else { 0 };
        let percent = if total_size > 0 { (downloaded as f64 / total_size as f64) * 100.0 } else { 0.0 };
        let remaining = if speed > 0 { (total_size - downloaded) / speed } else { 0 };

        let _ = app.emit("download-progress", DownloadProgress {
            download_id: download_id.to_string(),
            percent,
            speed_bps: speed,
            eta_secs: remaining,
        });
    }

    file.flush().await?;
    Ok(())
}

#[tauri::command]
pub async fn pause_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub — pause/resume requires tracking download handles in a global map.
    // Demo files are small (10-50MB), so pause/resume is not critical for investor demo.
    // Full implementation deferred to Faz 1.
    Ok(())
}

#[tauri::command]
pub async fn resume_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub — see pause_download
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(_download_id: String) -> Result<(), String> {
    // Faz 0: stub
    Ok(())
}
```

- [ ] **Step 3: Add futures-util dependency**

In `src-tauri/Cargo.toml`:
```toml
futures-util = "0.3"
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Rust download manager with progress events"
```

### Task 13: Rust Game Launcher & File Manager

**Files:**
- Create: `src-tauri/src/commands/launcher.rs`, `src-tauri/src/commands/files.rs`, `src-tauri/src/commands/auth.rs`

- [ ] **Step 1: Write launcher commands**

`src-tauri/src/commands/launcher.rs`:
```rust
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
struct GameStatus {
    game_id: String,
    status: String,
    play_time_secs: u64,
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    game_id: String,
    exe_path: String,
) -> Result<u32, String> {
    let child = Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Failed to launch: {}", e))?;

    let pid = child.id();
    let app_clone = app.clone();
    let game_id_clone = game_id.clone();

    // Track process in background
    tokio::spawn(async move {
        let start = std::time::Instant::now();
        let _ = app_clone.emit("game-status", GameStatus {
            game_id: game_id_clone.clone(),
            status: "running".to_string(),
            play_time_secs: 0,
        });

        // Poll every 5 seconds
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            let elapsed = start.elapsed().as_secs();

            // Check if process still running (simplified)
            #[cfg(target_os = "windows")]
            let running = {
                let output = Command::new("tasklist")
                    .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                    .output();
                output.map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string())).unwrap_or(false)
            };

            #[cfg(not(target_os = "windows"))]
            let running = {
                let output = Command::new("kill").args(["-0", &pid.to_string()]).output();
                output.map(|o| o.status.success()).unwrap_or(false)
            };

            if !running {
                let _ = app_clone.emit("game-status", GameStatus {
                    game_id: game_id_clone.clone(),
                    status: "stopped".to_string(),
                    play_time_secs: elapsed,
                });
                break;
            }
        }
    });

    Ok(pid)
}

#[tauri::command]
pub async fn stop_game(game_id: String) -> Result<(), String> {
    // For demo: user closes game manually
    Ok(())
}
```

- [ ] **Step 2: Write file manager commands**

`src-tauri/src/commands/files.rs`:
```rust
use sha2::{Sha256, Digest};
use std::path::Path;

#[derive(serde::Serialize)]
pub struct DiskSpace {
    free_bytes: u64,
    total_bytes: u64,
}

#[tauri::command]
pub async fn get_disk_space(path: String) -> Result<DiskSpace, String> {
    // Simplified: return available space for the drive
    let metadata = fs2::available_space(&path).map_err(|e| e.to_string())?;
    let total = fs2::total_space(&path).map_err(|e| e.to_string())?;
    Ok(DiskSpace { free_bytes: metadata, total_bytes: total })
}

#[tauri::command]
pub async fn verify_game_files(
    _game_id: String,
    path: String,
    expected_hash: String,
) -> Result<bool, String> {
    let data = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hex::encode(hasher.finalize());
    Ok(result == expected_hash)
}

#[tauri::command]
pub async fn uninstall_game(_game_id: String, path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        tokio::fs::remove_dir_all(p).await.map_err(|e| e.to_string())?;
    } else if p.is_file() {
        tokio::fs::remove_file(p).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

- [ ] **Step 3: Write auth/keyring commands**

`src-tauri/src/commands/auth.rs`:
```rust
use keyring::Entry;

const SERVICE_NAME: &str = "stealike";

#[tauri::command]
pub async fn store_token(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_token(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn delete_token(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
```

- [ ] **Step 4: Add fs2 dependency and register all commands in lib.rs**

In `src-tauri/Cargo.toml` add:
```toml
fs2 = "0.4"
```

Update `src-tauri/src/lib.rs`:
```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::download::download_game,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::cancel_download,
            commands::launcher::launch_game,
            commands::launcher::stop_game,
            commands::files::get_disk_space,
            commands::files::verify_game_files,
            commands::files::uninstall_game,
            commands::auth::store_token,
            commands::auth::get_token,
            commands::auth::delete_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Verify Rust compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Rust commands for launcher, file manager, OS keyring"
```

---

## Chunk 6: React Frontend

### Task 14: Shared Types, API Client & Stores

**Files:**
- Create: `src/lib/types.ts`, `src/lib/api.ts`, `src/stores/authStore.ts`, `src/stores/libraryStore.ts`, `src/stores/downloadStore.ts`

- [ ] **Step 1: Write shared types**

`src/lib/types.ts`:
```typescript
export interface User {
  id: string;
  email: string;
  username: string;
  isStudent: boolean;
  referralCode: string;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: string;
  discountPercent: number;
  coverImageUrl: string;
  screenshots: string[];
  releaseDate: string;
  downloadUrl?: string;
  downloadSize?: number;
  fileHash?: string;
  minRequirements: Record<string, string>;
  publisher: { name: string; slug: string };
}

export interface LibraryItem {
  id: string;
  gameId: string;
  purchasedAt: string;
  installPath: string | null;
  playTimeMins: number;
  lastPlayedAt: string | null;
  game: Game;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
```

- [ ] **Step 2: Write API client**

`src/lib/api.ts`:
```typescript
import { invoke } from "@tauri-apps/api/core";

const API_URL = "http://localhost:3001";

async function getAccessToken(): Promise<string | null> {
  try {
    return await invoke<string | null>("get_token", { key: "access_token" });
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json();

  if (!res.ok) throw new Error(body.error?.message || "Request failed");
  return body.data;
}

export const api = {
  auth: {
    register: (data: { email: string; username: string; password: string }) =>
      request<{ user: any; tokens: any }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ user: any; tokens: any }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    refresh: (refreshToken: string) =>
      request<{ tokens: any }>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
    verifyStudent: (studentEmail: string) =>
      request<{ verified: boolean }>("/auth/verify-student", { method: "POST", body: JSON.stringify({ studentEmail }) }),
    me: () => request<{ id: string; email: string; username: string; isStudent: boolean; referralCode: string }>("/auth/me"),
  },
  games: {
    list: (page = 1) => request<any[]>(`/games?page=${page}`),
    featured: () => request<any[]>("/games/featured"),
    getBySlug: (slug: string) => request<any>(`/games/${slug}`),
    search: (q: string) => request<any[]>(`/games/search?q=${encodeURIComponent(q)}`),
  },
  library: {
    list: () => request<any[]>("/library"),
    download: (id: string) => request<{ url: string; expires_at: string }>(`/library/${id}/download`),
    updatePlayTime: (id: string, playTimeMins: number) =>
      request<any>(`/library/${id}`, { method: "PATCH", body: JSON.stringify({ playTimeMins }) }),
  },
  payments: {
    init: (data: any) => request<any>("/payments/init", { method: "POST", body: JSON.stringify(data) }),
    installments: (binNumber: string, price: string) =>
      request<any>(`/payments/installments?binNumber=${binNumber}&price=${price}`),
    history: () => request<any[]>("/payments/history"),
  },
};
```

- [ ] **Step 3: Write auth store**

`src/stores/authStore.ts`:
```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import type { User, Tokens } from "../lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { user, tokens } = await api.auth.login({ email, password });
    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    set({ user, isAuthenticated: true });
  },

  register: async (email, username, password) => {
    const { user, tokens } = await api.auth.register({ email, username, password });
    await invoke("store_token", { key: "access_token", value: tokens.accessToken });
    await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await invoke("delete_token", { key: "access_token" });
    await invoke("delete_token", { key: "refresh_token" });
    set({ user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const token = await invoke<string | null>("get_token", { key: "access_token" });
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Token exists — fetch full user profile from server
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token expired, try refresh
      try {
        const refreshToken = await invoke<string | null>("get_token", { key: "refresh_token" });
        if (refreshToken) {
          const { tokens } = await api.auth.refresh(refreshToken);
          await invoke("store_token", { key: "access_token", value: tokens.accessToken });
          await invoke("store_token", { key: "refresh_token", value: tokens.refreshToken });
          const user = await api.auth.me();
          set({ user, isAuthenticated: true, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch {
        await invoke("delete_token", { key: "access_token" });
        await invoke("delete_token", { key: "refresh_token" });
        set({ isLoading: false });
      }
    }
  },
}));
```

- [ ] **Step 4: Write download store**

`src/stores/downloadStore.ts`:
```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DownloadInfo {
  downloadId: string;
  gameId: string;
  percent: number;
  speedBps: number;
  etaSecs: number;
}

interface DownloadState {
  downloads: Record<string, DownloadInfo>;
  startDownload: (gameId: string, url: string, destPath: string) => Promise<string>;
  initListener: () => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: {},

  startDownload: async (gameId, url, destPath) => {
    const downloadId = await invoke<string>("download_game", {
      gameId, url, destPath,
    });
    set((state) => ({
      downloads: {
        ...state.downloads,
        [gameId]: { downloadId, gameId, percent: 0, speedBps: 0, etaSecs: 0 },
      },
    }));
    return downloadId;
  },

  initListener: async () => {
    await listen<any>("download-progress", (event) => {
      const { download_id, percent, speed_bps, eta_secs } = event.payload;
      set((state) => {
        const entry = Object.values(state.downloads).find((d) => d.downloadId === download_id);
        if (!entry) return state;
        return {
          downloads: {
            ...state.downloads,
            [entry.gameId]: { ...entry, percent, speedBps: speed_bps, etaSecs: eta_secs },
          },
        };
      });
    });
  },
}));
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ src/stores/
git commit -m "feat: add shared types, API client, auth and download stores"
```

### Task 15: Layout & Navigation Components

**Files:**
- Create: `src/components/Layout.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx`

- [ ] **Step 1: Write Sidebar**

`src/components/Sidebar.tsx`:
```tsx
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const navItems = [
    { id: "store", label: "Mağaza", icon: "🏪" },
    { id: "library", label: "Kütüphane", icon: "📚" },
    { id: "settings", label: "Ayarlar", icon: "⚙️" },
  ];

  return (
    <div className="w-56 bg-gray-900 h-screen flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-indigo-400">Stealike</h1>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentPage === item.id
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {user && (
        <div className="p-3 border-t border-gray-800">
          <div className="text-sm text-gray-300 mb-1">{user.username}</div>
          <div className="text-xs text-gray-500 mb-2">{user.email}</div>
          <button
            onClick={logout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write Layout**

`src/components/Layout.tsx`:
```tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Write main App with routing**

`src/App.tsx`:
```tsx
import { useState, useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { useDownloadStore } from "./stores/downloadStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { StorePage } from "./pages/StorePage";
import { LibraryPage } from "./pages/LibraryPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const { initListener } = useDownloadStore();
  const [page, setPage] = useState("store");
  const [gameSlug, setGameSlug] = useState<string | null>(null);
  const [authPage, setAuthPage] = useState<"login" | "register">("login");

  useEffect(() => {
    loadSession();
    initListener();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authPage === "register") {
      return <RegisterPage onSwitch={() => setAuthPage("login")} />;
    }
    return <LoginPage onSwitch={() => setAuthPage("register")} />;
  }

  const navigate = (p: string, slug?: string) => {
    setPage(p);
    if (slug) setGameSlug(slug);
  };

  return (
    <Layout currentPage={page} onNavigate={(p) => navigate(p)}>
      {page === "store" && <StorePage onGameClick={(slug) => navigate("game", slug)} />}
      {page === "game" && gameSlug && (
        <GameDetailPage slug={gameSlug} onBack={() => navigate("store")} />
      )}
      {page === "library" && <LibraryPage />}
      {page === "settings" && <SettingsPage />}
    </Layout>
  );
}

export default App;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/App.tsx
git commit -m "feat: add layout, sidebar, and page routing"
```

### Task 16: Store, Game Detail, Library, Login, Register, Settings Pages

These are the main UI pages. Each is a separate file. Due to plan length, I'll provide the key pages with essential structure — the implementing agent should use Tailwind for a dark gaming-themed UI consistent with the sidebar style.

**Files:**
- Create: `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`, `src/pages/StorePage.tsx`, `src/pages/GameDetailPage.tsx`, `src/pages/LibraryPage.tsx`, `src/pages/SettingsPage.tsx`
- Create: `src/components/GameCard.tsx`, `src/components/SearchBar.tsx`, `src/components/DownloadProgress.tsx`, `src/components/InstallmentSelector.tsx`

- [ ] **Step 1: Write LoginPage**

`src/pages/LoginPage.tsx`:
```tsx
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

export function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <h1 className="text-2xl font-bold text-indigo-400 mb-1">Stealike</h1>
        <p className="text-gray-500 text-sm mb-6">Hesabına giriş yap</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password" placeholder="Şifre" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Hesabın yok mu?{" "}
          <button onClick={onSwitch} className="text-indigo-400 hover:underline">Kayıt ol</button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write RegisterPage**

`src/pages/RegisterPage.tsx`:
```tsx
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (err: any) {
      setError(err.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <h1 className="text-2xl font-bold text-indigo-400 mb-1">Stealike</h1>
        <p className="text-gray-500 text-sm mb-6">Yeni hesap oluştur</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" placeholder="Kullanıcı adı" value={username}
            onChange={(e) => setUsername(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password" placeholder="Şifre (min 8 karakter)" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Zaten hesabın var mı?{" "}
          <button onClick={onSwitch} className="text-indigo-400 hover:underline">Giriş yap</button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write GameCard component**

`src/components/GameCard.tsx`:
```tsx
import type { Game } from "../lib/types";

interface GameCardProps {
  game: Game;
  onClick: () => void;
}

export function GameCard({ game, onClick }: GameCardProps) {
  const price = parseFloat(game.price);
  const discountedPrice = game.discountPercent > 0
    ? price * (1 - game.discountPercent / 100)
    : price;

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-indigo-500 transition-colors cursor-pointer group"
    >
      <img
        src={game.coverImageUrl} alt={game.title}
        className="w-full h-48 object-cover group-hover:opacity-90 transition-opacity"
      />
      <div className="p-3">
        <h3 className="font-medium text-sm text-white truncate">{game.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{game.publisher.name}</p>
        <div className="mt-2 flex items-center gap-2">
          {game.discountPercent > 0 && (
            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
              -%{game.discountPercent}
            </span>
          )}
          {game.discountPercent > 0 && (
            <span className="text-xs text-gray-500 line-through">₺{price.toFixed(2)}</span>
          )}
          <span className="text-sm font-bold text-white">₺{discountedPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write StorePage**

`src/pages/StorePage.tsx`:
```tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GameCard } from "../components/GameCard";
import type { Game } from "../lib/types";

interface StorePageProps {
  onGameClick: (slug: string) => void;
}

export function StorePage({ onGameClick }: StorePageProps) {
  const [featured, setFeatured] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);

  useEffect(() => {
    api.games.featured().then(setFeatured);
    api.games.list().then(setAllGames);
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length > 1) {
      const results = await api.games.search(q);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  const displayGames = searchResults ?? allGames;

  return (
    <div className="p-6">
      <div className="mb-6">
        <input
          type="text" placeholder="Oyun ara..."
          value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {!searchResults && featured.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">Öne Çıkanlar</h2>
          <div className="grid grid-cols-3 gap-4">
            {featured.slice(0, 3).map((game) => (
              <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-4">
          {searchResults ? `"${searchQuery}" için sonuçlar` : "Tüm Oyunlar"}
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {displayGames.map((game) => (
            <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

> **Note:** GameDetailPage, LibraryPage, and SettingsPage are implemented with full code in Tasks 17, 18, and 19 respectively. Skip to Step 8 after completing StorePage.

- [ ] **Step 5: Verify full app builds**

```bash
npm run tauri dev
```

Expected: App opens, shows login page, can navigate after login.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add all React pages — store, game detail, library, auth, settings"
```

---

## Chunk 7: Integration & Polish

### Task 17: GameDetailPage with Payment Flow

**Files:**
- Create full: `src/pages/GameDetailPage.tsx`, `src/components/InstallmentSelector.tsx`

The GameDetailPage should:
1. Fetch game by slug via `api.games.getBySlug(slug)`
2. Display: cover image, screenshots carousel, title, description, publisher, system requirements
3. Show price with discounts (student badge if applicable, referral code input)
4. "Satın Al" button → opens payment modal with installment selection
5. On success → navigate to library

The InstallmentSelector component:
1. Takes card BIN (first 6 digits) and queries `api.payments.installments()`
2. Shows table of installment options (1, 3, 6, 9, 12 taksit with monthly amounts)
3. User selects an option

- [ ] **Step 1: Write GameDetailPage**

`src/pages/GameDetailPage.tsx`:
```tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { InstallmentSelector } from "../components/InstallmentSelector";
import type { Game } from "../lib/types";

interface Props {
  slug: string;
  onBack: () => void;
}

export function GameDetailPage({ slug, onBack }: Props) {
  const { user } = useAuthStore();
  const [game, setGame] = useState<Game | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.games.getBySlug(slug).then(setGame);
  }, [slug]);

  if (!game) return <div className="p-6 text-gray-400">Yükleniyor...</div>;

  const basePrice = parseFloat(game.price);
  const gameDiscount = game.discountPercent;
  const studentDiscount = user?.isStudent ? 10 : 0;
  const referralDiscount = referralCode ? 5 : 0;
  const totalDiscount = Math.min(gameDiscount + studentDiscount + referralDiscount, 15);
  const finalPrice = basePrice * (1 - totalDiscount / 100);

  const handleBuy = async (installmentCount: number, cardData?: any) => {
    setError("");
    try {
      const result = await api.payments.init({
        gameId: game.id,
        referralCode: referralCode || undefined,
        paymentMethod: "CREDIT_CARD",
        installmentCount,
        ...cardData,
      });

      if (result.three_d_html) {
        // For demo: show 3D Secure in a new window or handle inline
        // In production, this opens in Tauri WebView
        const win = window.open("", "_blank", "width=500,height=600");
        if (win) {
          win.document.write(atob(result.three_d_html));
        }
      }

      setPaymentSuccess(true);
    } catch (err: any) {
      setError(err.message || "Ödeme başarısız");
    }
  };

  const screenshots = typeof game.screenshots === "string"
    ? JSON.parse(game.screenshots) : game.screenshots;
  const requirements = typeof game.minRequirements === "string"
    ? JSON.parse(game.minRequirements) : game.minRequirements;

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white mb-4">
        ← Mağazaya Dön
      </button>

      <div className="flex gap-6">
        <div className="flex-1">
          <img src={game.coverImageUrl} alt={game.title} className="w-full rounded-xl mb-4" />

          {screenshots?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mb-4">
              {screenshots.map((url: string, i: number) => (
                <img key={i} src={url} className="h-20 rounded-lg object-cover" />
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold mb-1">{game.title}</h1>
          <p className="text-sm text-gray-400 mb-4">{game.publisher.name}</p>
          <p className="text-gray-300 text-sm leading-relaxed">{game.description}</p>

          {requirements && Object.keys(requirements).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-400 mb-2">Minimum Sistem Gereksinimleri</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(requirements).map(([key, val]) => (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500 uppercase">{key}:</span>{" "}
                    <span className="text-gray-300">{val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-72 shrink-0">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sticky top-6">
            <div className="mb-3">
              {totalDiscount > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                    -%{totalDiscount}
                  </span>
                  <span className="text-sm text-gray-500 line-through">₺{basePrice.toFixed(2)}</span>
                </div>
              )}
              <div className="text-2xl font-bold">₺{finalPrice.toFixed(2)}</div>
            </div>

            {user?.isStudent && (
              <div className="text-xs text-green-400 mb-2">🎓 Öğrenci indirimi aktif (-%10)</div>
            )}

            <div className="mb-3">
              <input
                type="text" placeholder="Referans kodu (opsiyonel)"
                value={referralCode} onChange={(e) => setReferralCode(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              {referralCode && <div className="text-xs text-green-400 mt-1">-%5 referans indirimi</div>}
            </div>

            {paymentSuccess ? (
              <div className="text-center py-3">
                <div className="text-green-400 font-bold mb-1">✓ Satın alındı!</div>
                <p className="text-xs text-gray-400">Kütüphanene eklendi</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowPayment(!showPayment)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm"
                >
                  Satın Al
                </button>
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              </>
            )}

            {showPayment && !paymentSuccess && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <InstallmentSelector
                  price={finalPrice.toFixed(2)}
                  onConfirm={handleBuy}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write InstallmentSelector**

`src/components/InstallmentSelector.tsx`:
```tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Props {
  price: string;
  onConfirm: (installmentCount: number, cardData?: any) => void;
}

export function InstallmentSelector({ price, onConfirm }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState(1);
  const [loading, setLoading] = useState(false);

  // Query installments when BIN (first 6 digits) changes
  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, "").slice(0, 6);
    if (bin.length === 6) {
      api.payments.installments(bin, price).then((data) => {
        if (data?.installmentDetails?.[0]?.installmentPrices) {
          setInstallments(data.installmentDetails[0].installmentPrices);
        }
      });
    }
  }, [cardNumber, price]);

  const handleSubmit = () => {
    setLoading(true);
    onConfirm(selectedInstallment, {
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardHolderName: cardHolder,
      expireMonth: expMonth,
      expireYear: expYear,
      cvc,
    });
  };

  return (
    <div className="space-y-3">
      <input
        placeholder="Kart numarası" value={cardNumber}
        onChange={(e) => setCardNumber(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs"
      />
      <input
        placeholder="Kart üzerindeki isim" value={cardHolder}
        onChange={(e) => setCardHolder(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs"
      />
      <div className="flex gap-2">
        <input placeholder="AA" value={expMonth} onChange={(e) => setExpMonth(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
        <input placeholder="YYYY" value={expYear} onChange={(e) => setExpYear(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
        <input placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value)}
          className="w-1/3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
      </div>

      {installments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium">Taksit Seçenekleri</p>
          {installments.map((inst: any) => (
            <button
              key={inst.installmentNumber}
              onClick={() => setSelectedInstallment(inst.installmentNumber)}
              className={`w-full flex justify-between px-3 py-2 rounded-lg text-xs ${
                selectedInstallment === inst.installmentNumber
                  ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-750"
              }`}
            >
              <span>{inst.installmentNumber === 1 ? "Tek çekim" : `${inst.installmentNumber} taksit`}</span>
              <span>₺{parseFloat(inst.totalPrice).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit} disabled={loading || !cardNumber || !cardHolder}
        className="w-full py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium text-sm disabled:opacity-50"
      >
        {loading ? "İşleniyor..." : `₺${price} Öde`}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Test end-to-end: browse → select game → pay → appears in library**
- [ ] **Step 4: Commit**

```bash
git add src/pages/GameDetailPage.tsx src/components/InstallmentSelector.tsx
git commit -m "feat: add game detail page with payment flow and installment selector"
```

### Task 18: LibraryPage with Download & Launch

**Files:**
- Create full: `src/pages/LibraryPage.tsx`, `src/components/DownloadProgress.tsx`

The LibraryPage should:
1. Fetch library via `api.library.list()`
2. For each game: show cover, title, play time
3. "İndir" button → calls `api.library.download(id)` to get URL → calls Tauri `download_game`
4. Show download progress bar (from downloadStore events)
5. "Oyna" button (after download) → calls Tauri `launch_game`
6. Track play time via `game-status` events → PATCH `/library/:id`

- [ ] **Step 1: Write LibraryPage**

`src/pages/LibraryPage.tsx`:
```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import { useDownloadStore } from "../stores/downloadStore";
import { DownloadProgress } from "../components/DownloadProgress";
import type { LibraryItem } from "../lib/types";

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const { downloads, startDownload } = useDownloadStore();

  useEffect(() => {
    api.library.list().then(setItems);
  }, []);

  const handleDownload = async (item: LibraryItem) => {
    const { url } = await api.library.download(item.id);
    const destPath = `${await getDownloadDir()}/${item.game.slug}.zip`;
    await startDownload(item.gameId, url, destPath);
  };

  const handleLaunch = async (item: LibraryItem) => {
    // For demo: just show a message. Real launch needs installed exe path.
    try {
      await invoke("launch_game", {
        gameId: item.gameId,
        exePath: item.installPath || `C:/Games/Stealike/${item.game.slug}/game.exe`,
      });
    } catch (err) {
      console.error("Launch failed:", err);
    }
  };

  const formatPlayTime = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Kütüphanem</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">Henüz oyun yok. Mağazadan oyun satın al!</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const dl = downloads[item.gameId];
            const isDownloading = dl && dl.percent < 100;
            const isDownloaded = dl && dl.percent >= 100;

            return (
              <div key={item.id} className="flex items-center gap-4 bg-gray-900 rounded-xl border border-gray-800 p-3">
                <img src={item.game.coverImageUrl} alt={item.game.title}
                  className="w-24 h-14 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.game.title}</h3>
                  <p className="text-xs text-gray-500">
                    {item.playTimeMins > 0 ? formatPlayTime(item.playTimeMins) : "Henüz oynanmadı"}
                  </p>
                </div>

                {isDownloading ? (
                  <DownloadProgress percent={dl.percent} speedBps={dl.speedBps} etaSecs={dl.etaSecs} />
                ) : isDownloaded ? (
                  <button onClick={() => handleLaunch(item)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium">
                    Oyna
                  </button>
                ) : (
                  <button onClick={() => handleDownload(item)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
                    İndir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function getDownloadDir(): Promise<string> {
  // Use Tauri's app data dir or a default
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    return `${await appDataDir()}/downloads`;
  } catch {
    return "C:/Games/Stealike";
  }
}
```

- [ ] **Step 2: Write DownloadProgress**

`src/components/DownloadProgress.tsx`:
```tsx
interface Props {
  percent: number;
  speedBps: number;
  etaSecs: number;
}

export function DownloadProgress({ percent, speedBps, etaSecs }: Props) {
  const formatSpeed = (bps: number) => {
    if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
    if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${bps} B/s`;
  };

  return (
    <div className="w-40">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{percent.toFixed(0)}%</span>
        <span>{formatSpeed(speedBps)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test: download a demo file, verify progress bar**
- [ ] **Step 4: Commit**

```bash
git add src/pages/LibraryPage.tsx src/components/DownloadProgress.tsx
git commit -m "feat: add library page with download progress and game launch"
```

### Task 19: SettingsPage with Student Verification & Referral Stats

**Files:**
- Create full: `src/pages/SettingsPage.tsx`, `src/components/StudentBadge.tsx`, `src/components/ReferralBanner.tsx`

The SettingsPage should:
1. Profile section: username, email
2. Student verification: input .edu.tr email → call `api.auth.verifyStudent()` → show badge
3. Referral code: display user's code with copy button
4. Referral stats: (for demo, show basic stats from user data)

- [ ] **Step 1: Write SettingsPage**

`src/pages/SettingsPage.tsx`:
```tsx
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";

export function SettingsPage() {
  const { user } = useAuthStore();
  const [studentEmail, setStudentEmail] = useState("");
  const [studentStatus, setStudentStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [studentError, setStudentError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleVerifyStudent = async () => {
    setStudentStatus("loading");
    setStudentError("");
    try {
      await api.auth.verifyStudent(studentEmail);
      setStudentStatus("success");
    } catch (err: any) {
      setStudentError(err.message || "Doğrulama başarısız");
      setStudentStatus("error");
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Ayarlar</h1>

      {/* Profile */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">Profil</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Kullanıcı adı</span>
            <span>{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </section>

      {/* Student Discount */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">🎓 Öğrenci İndirimi</h2>
        {user?.isStudent || studentStatus === "success" ? (
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">✓ Öğrenci indirimi aktif</span>
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">-%10</span>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              .edu.tr uzantılı email adresinle doğrulama yaparak %10 öğrenci indirimi kazanabilirsin.
            </p>
            <div className="flex gap-2">
              <input
                type="email" placeholder="ogrenci@universite.edu.tr"
                value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <button onClick={handleVerifyStudent} disabled={studentStatus === "loading" || !studentEmail.endsWith(".edu.tr")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium disabled:opacity-50">
                {studentStatus === "loading" ? "..." : "Doğrula"}
              </button>
            </div>
            {studentError && <p className="text-red-400 text-xs mt-2">{studentError}</p>}
          </div>
        )}
      </section>

      {/* Referral Code */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">🔗 Referans Kodum</h2>
        <p className="text-xs text-gray-400 mb-3">
          Kodunu arkadaşlarınla paylaş. Onlar %5 indirim alsın, sen %1 cüzdan kredisi kazan.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-indigo-400 text-sm font-mono">
            {user?.referralCode || "—"}
          </code>
          <button onClick={copyReferralCode}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-xs">
            {copied ? "✓ Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Test student verification flow**

```
1. Go to Settings
2. Enter a .edu.tr email
3. Click Doğrula → should show success badge
4. Go back to store, buy a game → should see discounted price
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add settings page with student verification and referral code"
```

### Task 20: Final Polish & .env.example

- [ ] **Step 1: Create .env.example at root**

```bash
# .env.example — copy to server/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stealike?schema=public"
JWT_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-in-production"
IYZICO_API_KEY="sandbox-api-key"
IYZICO_SECRET_KEY="sandbox-secret-key"
IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
API_URL="http://localhost:3001"
```

- [ ] **Step 2: Add .gitignore entries**

```
node_modules/
dist/
target/
.env
.superpowers/
server/public/downloads/
```

- [ ] **Step 3: Verify full flow end-to-end**

1. `cd server && npm run dev` (API server)
2. `npm run tauri dev` (Desktop app)
3. Register new user
4. Browse store → click a game → see detail
5. Buy with iyzico sandbox card → see installment options
6. Game appears in library → download → launch
7. Go to settings → verify student → see discount on next purchase
8. Share referral code → register second user with code → verify discount

- [ ] **Step 4: Final commit**

```bash
git add .gitignore .env.example src/ src-tauri/ server/src/ server/tests/ server/prisma/ server/package.json server/tsconfig.json package.json tsconfig.json index.html tailwind.config.js postcss.config.js vite.config.ts docker-compose.yml
git commit -m "feat: complete Stealike Faz 0 demo — store, payments, library, downloads"
```
