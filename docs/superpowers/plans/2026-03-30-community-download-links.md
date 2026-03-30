# Community Download Links Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a community download links section to GameDetailPage where users share, vote on, and report download links with multiple mirrors.

**Architecture:** New Prisma models (CommunityLink, CommunityLinkMirror, CommunityLinkVote, CommunityLinkReport) + VoteType enum. New Fastify route file + service file following existing review pattern. New React component inserted between Reviews and Achievements sections. Admin infrastructure added to User model + JWT + auth plugin.

**Tech Stack:** Prisma (PostgreSQL), Fastify, React, TailwindCSS, react-i18next, Tauri shell.open

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `server/src/services/communityLink.service.ts` | All DB operations for community links (CRUD, vote, report) |
| `server/src/routes/communityLinks.ts` | HTTP endpoints for community links |
| `src/components/CommunityLinks.tsx` | Section component (link cards + header + empty state) |
| `src/components/CommunityLinkModal.tsx` | Modal form for creating new links |

### Modified Files
| File | What Changes |
|------|-------------|
| `server/prisma/schema.prisma` | Add VoteType enum, 4 new models, isAdmin on User, relation on Game |
| `server/src/lib/jwt.ts` | Add `isAdmin` to TokenPayload |
| `server/src/plugins/auth.plugin.ts` | Add `tryAuthenticate` and `adminGuard` decorators |
| `server/src/app.ts` | Register communityLink routes |
| `server/src/services/auth.service.ts` | Include isAdmin in `createTokens`, `getProfile`, login/register responses |
| `src/lib/types.ts` | Add CommunityLink, CommunityLinkMirror types, add `isAdmin` to User |
| `src/lib/api.ts` | Add communityLinks API methods |
| `src/pages/GameDetailPage.tsx` | Import and render CommunityLinks between reviews and achievements |
| `src/i18n/locales/tr.json` | Add communityLinks i18n keys |
| `src/i18n/locales/en.json` | Add communityLinks i18n keys |
| `src/i18n/locales/de.json` | Add communityLinks i18n keys |
| `src/i18n/locales/es.json` | Add communityLinks i18n keys |

---

## Chunk 1: Database & Backend Foundation

### Task 1: Prisma Schema — Add Admin Flag + New Models

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add VoteType enum after existing enums (after line ~83)**

```prisma
enum VoteType {
  UP
  DOWN

  @@map("vote_type")
}
```

- [ ] **Step 2: Add `isAdmin` field to User model (after `twoFactorEnabled` field, ~line 105)**

```prisma
  isAdmin             Boolean       @default(false) @map("is_admin")
```

- [ ] **Step 3: Add User relation fields (after `userThemes` line, ~line 129)**

```prisma
  communityLinks         CommunityLink[]
  communityLinkVotes     CommunityLinkVote[]
  communityLinkReports   CommunityLinkReport[]
```

- [ ] **Step 4: Add Game relation field (after `cartItems` line, ~line 179)**

```prisma
  communityLinks   CommunityLink[]
```

- [ ] **Step 5: Add all 4 new models at end of file**

```prisma
model CommunityLink {
  id            String    @id @default(uuid()) @db.Uuid
  gameId        String    @map("game_id") @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  title         String    @db.VarChar(100)
  description   String?   @db.VarChar(500)
  size          String?   @db.VarChar(20)
  crackInfo     String?   @map("crack_info") @db.VarChar(100)
  score         Int       @default(0)
  virusReports  Int       @default(0) @map("virus_reports")
  isHidden      Boolean   @default(false) @map("is_hidden")
  isAdminPost   Boolean   @default(false) @map("is_admin_post")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  game          Game      @relation(fields: [gameId], references: [id])
  user          User      @relation(fields: [userId], references: [id])
  mirrors       CommunityLinkMirror[]
  votes         CommunityLinkVote[]
  reports       CommunityLinkReport[]

  @@index([gameId, isHidden])
  @@index([gameId, score])
  @@map("community_links")
}

model CommunityLinkMirror {
  id              String        @id @default(uuid()) @db.Uuid
  communityLinkId String        @map("community_link_id") @db.Uuid
  sourceName      String        @map("source_name") @db.VarChar(50)
  url             String        @db.VarChar(500)
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)

  @@map("community_link_mirrors")
}

model CommunityLinkVote {
  id              String        @id @default(uuid()) @db.Uuid
  communityLinkId String        @map("community_link_id") @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  voteType        VoteType      @map("vote_type")
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id])

  @@unique([communityLinkId, userId])
  @@map("community_link_votes")
}

model CommunityLinkReport {
  id              String        @id @default(uuid()) @db.Uuid
  communityLinkId String        @map("community_link_id") @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id])

  @@unique([communityLinkId, userId])
  @@map("community_link_reports")
}
```

- [ ] **Step 6: Generate and run migration**

```bash
cd server
npx prisma migrate dev --name add_community_links
```

Expected: Migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add community links schema — CommunityLink, Mirror, Vote, Report models + isAdmin on User"
```

---

### Task 2: JWT & Auth Plugin — Admin Support

**Files:**
- Modify: `server/src/lib/jwt.ts:6-9`
- Modify: `server/src/plugins/auth.plugin.ts`
- Modify: `server/src/services/auth.service.ts` (where tokens are generated)

- [ ] **Step 1: Add `isAdmin` to TokenPayload in `server/src/lib/jwt.ts`**

Change lines 6-9 from:
```typescript
export interface TokenPayload {
  userId: string;
  email: string;
}
```
To:
```typescript
export interface TokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}
```

- [ ] **Step 2: Update `createTokens` and callers in `server/src/services/auth.service.ts`**

The `createTokens` function at line 223 currently accepts `(userId, email)`. Update it to accept and pass `isAdmin`:

Change line 223:
```typescript
export async function createTokens(userId: string, email: string, isAdmin = false) {
```

Change line 227:
```typescript
  const accessToken = signAccessToken({ userId, email, isAdmin });
  const refreshToken = signRefreshToken({ userId, email, isAdmin });
```

Update all 3 call sites:

- **Line 63** (registerUser): `const tokens = await createTokens(user.id, user.email, false);` (new users are never admin)
- **Line 106** (loginUser): `const tokens = await createTokens(user.id, user.email, user.isAdmin);` (must select `isAdmin` from the user query — it's already there since `findUnique` returns all fields)
- **Line 124** (refreshTokens): Need to fetch user to get `isAdmin`:

Change lines 116-124:
```typescript
export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true } });
  return createTokens(payload.userId, payload.email, user?.isAdmin ?? false);
}
```

Also update `getProfile` at line 138 to include `isAdmin` in the select:
```typescript
select: {
  id: true, email: true, username: true, isStudent: true, referralCode: true, createdAt: true,
  bio: true, avatarUrl: true, walletBalance: true, isEmailVerified: true, twoFactorEnabled: true,
  preferences: true, isAdmin: true,
},
```

And add `isAdmin` to login/register response objects (line 66 and 111):
- registerUser return: add `isAdmin: false` to user object
- loginUser return: add `isAdmin: user.isAdmin` to user object

- [ ] **Step 3: Add `tryAuthenticate` and `adminGuard` to auth plugin (`server/src/plugins/auth.plugin.ts`)**

Add to FastifyInstance declaration (after line 10):
```typescript
    tryAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
```

Add decorators after the existing `authenticate` decorator (after line 25):
```typescript
  app.decorate("tryAuthenticate", async function (request: FastifyRequest, _reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      // Silent fail — user stays undefined
    }
  });

  app.decorate("adminGuard", async function (request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    }
    try {
      request.user = verifyAccessToken(header.slice(7));
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
    if (!request.user.isAdmin) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    }
  });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/jwt.ts server/src/plugins/auth.plugin.ts server/src/services/auth.service.ts
git commit -m "feat: add isAdmin to JWT, tryAuthenticate and adminGuard to auth plugin"
```

---

### Task 3: Community Link Service

**Files:**
- Create: `server/src/services/communityLink.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { prisma } from "../lib/prisma.js";
import { notFound, badRequest, forbidden, conflict } from "../lib/errors.js";

const VOTE_HIDE_THRESHOLD = -5;
const VIRUS_HIDE_THRESHOLD = 3;
const MAX_LINKS_PER_USER_PER_GAME = 5;
const MAX_LINKS_PER_USER_PER_DAY = 20;

export async function getLinksForGame(gameId: string, userId?: string, isAdmin = false) {
  const where: any = { gameId };
  if (!isAdmin) where.isHidden = false;

  const links = await prisma.communityLink.findMany({
    where,
    include: {
      user: { select: { username: true, avatarUrl: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      reports: userId ? { where: { userId }, select: { id: true } } : false,
    },
    orderBy: [{ isAdminPost: "desc" }, { score: "desc" }, { createdAt: "desc" }],
  });

  return links.map((link) => ({
    id: link.id,
    title: link.title,
    description: link.description,
    size: link.size,
    crackInfo: link.crackInfo,
    score: link.score,
    virusReports: link.virusReports,
    isAdminPost: link.isAdminPost,
    isHidden: link.isHidden,
    createdAt: link.createdAt,
    user: link.user,
    mirrors: link.mirrors,
    userVote: link.votes?.[0]?.voteType ?? null,
    hasReported: (link.reports?.length ?? 0) > 0,
  }));
}

export async function createLink(
  gameId: string,
  userId: string,
  isAdmin: boolean,
  data: {
    title: string;
    description?: string;
    size?: string;
    crackInfo?: string;
    mirrors: { sourceName: string; url: string }[];
  },
) {
  // Rate limit checks
  const userLinkCount = await prisma.communityLink.count({
    where: { gameId, userId },
  });
  if (userLinkCount >= MAX_LINKS_PER_USER_PER_GAME) {
    throw badRequest(`Maximum ${MAX_LINKS_PER_USER_PER_GAME} links per game`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyCount = await prisma.communityLink.count({
    where: { userId, createdAt: { gte: today } },
  });
  if (dailyCount >= MAX_LINKS_PER_USER_PER_DAY) {
    throw badRequest(`Maximum ${MAX_LINKS_PER_USER_PER_DAY} links per day`);
  }

  // Validate mirrors
  if (!data.mirrors.length) throw badRequest("At least one mirror required");
  for (const m of data.mirrors) {
    if (!m.url.startsWith("http://") && !m.url.startsWith("https://")) {
      throw badRequest("Mirror URL must start with http:// or https://");
    }
  }

  const link = await prisma.communityLink.create({
    data: {
      gameId,
      userId,
      title: data.title.slice(0, 100),
      description: data.description?.slice(0, 500) || null,
      size: data.size?.slice(0, 20) || null,
      crackInfo: data.crackInfo?.slice(0, 100) || null,
      isAdminPost: isAdmin,
      mirrors: {
        create: data.mirrors.map((m) => ({
          sourceName: m.sourceName.slice(0, 50),
          url: m.url.slice(0, 500),
        })),
      },
    },
    include: {
      user: { select: { username: true, avatarUrl: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
    },
  });

  return {
    ...link,
    userVote: null,
    hasReported: false,
  };
}

export async function vote(communityLinkId: string, userId: string, voteType: "UP" | "DOWN") {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const existing = await prisma.communityLinkVote.findUnique({
    where: { communityLinkId_userId: { communityLinkId, userId } },
  });

  return prisma.$transaction(async (tx) => {
    let scoreDelta = 0;
    let newUserVote: string | null = null;

    if (existing) {
      if (existing.voteType === voteType) {
        // Same vote — remove it
        await tx.communityLinkVote.delete({ where: { id: existing.id } });
        scoreDelta = voteType === "UP" ? -1 : 1;
        newUserVote = null;
      } else {
        // Different vote — switch
        await tx.communityLinkVote.update({ where: { id: existing.id }, data: { voteType } });
        scoreDelta = voteType === "UP" ? 2 : -2;
        newUserVote = voteType;
      }
    } else {
      // New vote
      await tx.communityLinkVote.create({ data: { communityLinkId, userId, voteType } });
      scoreDelta = voteType === "UP" ? 1 : -1;
      newUserVote = voteType;
    }

    const newScore = link.score + scoreDelta;
    const updated = await tx.communityLink.update({
      where: { id: communityLinkId },
      data: {
        score: { increment: scoreDelta },
        isHidden: newScore <= VOTE_HIDE_THRESHOLD,
      },
    });

    return { score: updated.score, userVote: newUserVote };
  });
}

export async function report(communityLinkId: string, userId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const existing = await prisma.communityLinkReport.findUnique({
    where: { communityLinkId_userId: { communityLinkId, userId } },
  });
  if (existing) throw conflict("Already reported");

  return prisma.$transaction(async (tx) => {
    await tx.communityLinkReport.create({ data: { communityLinkId, userId } });

    const newReportCount = link.virusReports + 1;
    const updated = await tx.communityLink.update({
      where: { id: communityLinkId },
      data: {
        virusReports: { increment: 1 },
        isHidden: newReportCount >= VIRUS_HIDE_THRESHOLD || link.isHidden,
      },
    });

    return { reported: true, virusReports: updated.virusReports };
  });
}

export async function deleteLink(communityLinkId: string, userId: string, isAdmin: boolean) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");
  if (link.userId !== userId && !isAdmin) throw forbidden("Not your link");

  await prisma.communityLink.delete({ where: { id: communityLinkId } });
}

export async function toggleHide(communityLinkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const updated = await prisma.communityLink.update({
    where: { id: communityLinkId },
    data: { isHidden: !link.isHidden },
  });

  return { isHidden: updated.isHidden };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/communityLink.service.ts
git commit -m "feat: add communityLink service — CRUD, vote, report, auto-hide logic"
```

---

### Task 4: Community Link Routes

**Files:**
- Create: `server/src/routes/communityLinks.ts`
- Modify: `server/src/app.ts:75-89` (add route registration)

- [ ] **Step 1: Create the routes file**

```typescript
import { FastifyInstance } from "fastify";
import * as communityLinkService from "../services/communityLink.service.js";

export default async function communityLinkRoutes(app: FastifyInstance) {
  // Public (with optional auth for userVote)
  app.get("/games/:slug/community-links", {
    preHandler: [app.tryAuthenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const { prisma } = await import("../lib/prisma.js");
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) return { data: { links: [] } };

      const isAdmin = request.user?.isAdmin ?? false;
      const links = await communityLinkService.getLinksForGame(game.id, request.user?.userId, isAdmin);
      return { data: { links } };
    },
  });

  // Auth required: create link
  app.post("/games/:slug/community-links", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { slug } = request.params as { slug: string };
      const body = request.body as {
        title: string;
        description?: string;
        size?: string;
        crackInfo?: string;
        mirrors: { sourceName: string; url: string }[];
      };

      const { badRequest } = await import("../lib/errors.js");
      if (!body.title || body.title.length < 3) throw badRequest("Title must be at least 3 characters");
      if (!body.mirrors?.length) throw badRequest("At least one mirror required");

      const { prisma } = await import("../lib/prisma.js");
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) throw new Error("Game not found");

      const link = await communityLinkService.createLink(
        game.id,
        request.user!.userId,
        request.user!.isAdmin,
        body,
      );
      return { data: link };
    },
  });

  // Auth required: vote
  app.post("/games/:slug/community-links/:linkId/vote", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const { voteType } = request.body as { voteType: "UP" | "DOWN" };

      if (!["UP", "DOWN"].includes(voteType)) {
        throw new Error("Invalid vote type");
      }

      const result = await communityLinkService.vote(linkId, request.user!.userId, voteType);
      return { data: result };
    },
  });

  // Auth required: report virus
  app.post("/games/:slug/community-links/:linkId/report", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const result = await communityLinkService.report(linkId, request.user!.userId);
      return { data: result };
    },
  });

  // Auth required: delete (owner or admin)
  app.delete("/games/:slug/community-links/:linkId", {
    preHandler: [app.authenticate],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      await communityLinkService.deleteLink(linkId, request.user!.userId, request.user!.isAdmin);
      return { data: { success: true } };
    },
  });

  // Admin only: toggle hide
  app.patch("/games/:slug/community-links/:linkId/toggle-hide", {
    preHandler: [app.adminGuard],
    handler: async (request) => {
      const { linkId } = request.params as { linkId: string };
      const result = await communityLinkService.toggleHide(linkId);
      return { data: result };
    },
  });
}
```

- [ ] **Step 2: Register routes in `server/src/app.ts`**

Add import at top (with other route imports):
```typescript
import communityLinkRoutes from "./routes/communityLinks.js";
```

Add registration after line 89 (after `adminRoutes`):
```typescript
  await app.register(communityLinkRoutes);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/communityLinks.ts server/src/app.ts
git commit -m "feat: add community links API routes — GET, POST, vote, report, delete, toggle-hide"
```

---

## Chunk 2: Frontend — Types, API, i18n

### Task 5: Frontend Types

**Files:**
- Modify: `src/lib/types.ts` (add after line 132)

- [ ] **Step 1: Add `isAdmin` to User interface (after `twoFactorEnabled` field)**

```typescript
  isAdmin: boolean;
```

- [ ] **Step 2: Add CommunityLink types at end of file**

```typescript
export interface CommunityLinkMirror {
  id: string;
  sourceName: string;
  url: string;
}

export interface CommunityLink {
  id: string;
  title: string;
  description?: string;
  size?: string;
  crackInfo?: string;
  score: number;
  virusReports: number;
  isAdminPost: boolean;
  isHidden: boolean;
  createdAt: string;
  user: { username: string; avatarUrl?: string };
  mirrors: CommunityLinkMirror[];
  userVote: "UP" | "DOWN" | null;
  hasReported: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add isAdmin to User, add CommunityLink and CommunityLinkMirror types"
```

---

### Task 6: API Client Methods

**Files:**
- Modify: `src/lib/api.ts` (add after reviews section, ~line 163)

- [ ] **Step 1: Add communityLinks API methods**

After the `reviews` block (line 163), add:

```typescript
  communityLinks: {
    list: (slug: string) => request<{ links: any[] }>(`/games/${slug}/community-links`),
    create: (slug: string, data: { title: string; description?: string; size?: string; crackInfo?: string; mirrors: { sourceName: string; url: string }[] }) =>
      request<any>(`/games/${slug}/community-links`, { method: "POST", body: JSON.stringify(data) }),
    vote: (slug: string, linkId: string, voteType: "UP" | "DOWN") =>
      request<{ score: number; userVote: string | null }>(`/games/${slug}/community-links/${linkId}/vote`, { method: "POST", body: JSON.stringify({ voteType }) }),
    report: (slug: string, linkId: string) =>
      request<{ reported: boolean; virusReports: number }>(`/games/${slug}/community-links/${linkId}/report`, { method: "POST" }),
    delete: (slug: string, linkId: string) =>
      request<void>(`/games/${slug}/community-links/${linkId}`, { method: "DELETE" }),
    toggleHide: (slug: string, linkId: string) =>
      request<{ isHidden: boolean }>(`/games/${slug}/community-links/${linkId}/toggle-hide`, { method: "PATCH" }),
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add communityLinks API client methods"
```

---

### Task 7: i18n — All 4 Languages

**Files:**
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`

- [ ] **Step 1: Add Turkish keys to `tr.json`**

Add inside the `gameDetail` object:

```json
"communityLinks": {
  "title": "Topluluk İndirme Linkleri",
  "count": "{{count}} link",
  "share": "Link Paylaş",
  "empty": "Henüz indirme linki paylaşılmamış",
  "emptyAction": "İlk linki sen paylaş!",
  "download": "İndir",
  "admin": "ADMIN",
  "hidden": "Gizli",
  "loginRequired": "Link paylaşmak için giriş yapın",
  "deleteConfirm": "Bu linki silmek istediğinize emin misiniz?",
  "rateLimitError": "Link paylaşma limitine ulaştınız",
  "today": "Bugün",
  "modal": {
    "title": "Yeni İndirme Linki Paylaş",
    "linkTitle": "Başlık",
    "crackInfo": "Versiyon / Crack Bilgisi",
    "size": "Boyut",
    "description": "Açıklama",
    "mirrors": "İndirme Linkleri",
    "addMirror": "+ Mirror Link Ekle",
    "sourceName": "ör. Fitgirl",
    "sourceUrl": "https://...",
    "submit": "Paylaş",
    "cancel": "İptal"
  },
  "vote": {
    "report": "Virüs Bildir",
    "reported": "Bildirildi",
    "reportConfirm": "Bu linki virüs olarak bildirmek istediğinize emin misiniz?"
  }
}
```

- [ ] **Step 2: Add English keys to `en.json`**

```json
"communityLinks": {
  "title": "Community Download Links",
  "count": "{{count}} links",
  "share": "Share Link",
  "empty": "No download links shared yet",
  "emptyAction": "Be the first to share a link!",
  "download": "Download",
  "admin": "ADMIN",
  "hidden": "Hidden",
  "loginRequired": "Log in to share links",
  "deleteConfirm": "Are you sure you want to delete this link?",
  "rateLimitError": "You have reached the link sharing limit",
  "today": "Today",
  "modal": {
    "title": "Share New Download Link",
    "linkTitle": "Title",
    "crackInfo": "Version / Crack Info",
    "size": "Size",
    "description": "Description",
    "mirrors": "Download Links",
    "addMirror": "+ Add Mirror Link",
    "sourceName": "e.g. Fitgirl",
    "sourceUrl": "https://...",
    "submit": "Share",
    "cancel": "Cancel"
  },
  "vote": {
    "report": "Report Virus",
    "reported": "Reported",
    "reportConfirm": "Are you sure you want to report this link as a virus?"
  }
}
```

- [ ] **Step 3: Add German keys to `de.json`**

```json
"communityLinks": {
  "title": "Community Download-Links",
  "count": "{{count}} Links",
  "share": "Link teilen",
  "empty": "Noch keine Download-Links geteilt",
  "emptyAction": "Sei der Erste, der einen Link teilt!",
  "download": "Herunterladen",
  "admin": "ADMIN",
  "hidden": "Versteckt",
  "loginRequired": "Zum Teilen von Links einloggen",
  "deleteConfirm": "Möchten Sie diesen Link wirklich löschen?",
  "rateLimitError": "Sie haben das Link-Sharing-Limit erreicht",
  "today": "Heute",
  "modal": {
    "title": "Neuen Download-Link teilen",
    "linkTitle": "Titel",
    "crackInfo": "Version / Crack-Info",
    "size": "Größe",
    "description": "Beschreibung",
    "mirrors": "Download-Links",
    "addMirror": "+ Mirror-Link hinzufügen",
    "sourceName": "z.B. Fitgirl",
    "sourceUrl": "https://...",
    "submit": "Teilen",
    "cancel": "Abbrechen"
  },
  "vote": {
    "report": "Virus melden",
    "reported": "Gemeldet",
    "reportConfirm": "Möchten Sie diesen Link wirklich als Virus melden?"
  }
}
```

- [ ] **Step 4: Add Spanish keys to `es.json`**

```json
"communityLinks": {
  "title": "Enlaces de Descarga de la Comunidad",
  "count": "{{count}} enlaces",
  "share": "Compartir Enlace",
  "empty": "Aún no se han compartido enlaces de descarga",
  "emptyAction": "¡Sé el primero en compartir un enlace!",
  "download": "Descargar",
  "admin": "ADMIN",
  "hidden": "Oculto",
  "loginRequired": "Inicia sesión para compartir enlaces",
  "deleteConfirm": "¿Estás seguro de que quieres eliminar este enlace?",
  "rateLimitError": "Has alcanzado el límite de enlaces compartidos",
  "today": "Hoy",
  "modal": {
    "title": "Compartir Nuevo Enlace de Descarga",
    "linkTitle": "Título",
    "crackInfo": "Versión / Info de Crack",
    "size": "Tamaño",
    "description": "Descripción",
    "mirrors": "Enlaces de Descarga",
    "addMirror": "+ Agregar Enlace Mirror",
    "sourceName": "ej. Fitgirl",
    "sourceUrl": "https://...",
    "submit": "Compartir",
    "cancel": "Cancelar"
  },
  "vote": {
    "report": "Reportar Virus",
    "reported": "Reportado",
    "reportConfirm": "¿Estás seguro de que quieres reportar este enlace como virus?"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/tr.json src/i18n/locales/en.json src/i18n/locales/de.json src/i18n/locales/es.json
git commit -m "feat: add community links i18n keys — TR, EN, DE, ES"
```

---

## Chunk 3: Frontend — UI Components

### Task 8: CommunityLinkModal Component

**Files:**
- Create: `src/components/CommunityLinkModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Mirror {
  sourceName: string;
  url: string;
}

interface CommunityLinkModalProps {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    size?: string;
    crackInfo?: string;
    mirrors: Mirror[];
  }) => Promise<void>;
}

export function CommunityLinkModal({ onClose, onSubmit }: CommunityLinkModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [crackInfo, setCrackInfo] = useState("");
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [mirrors, setMirrors] = useState<Mirror[]>([{ sourceName: "", url: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addMirror = () => setMirrors([...mirrors, { sourceName: "", url: "" }]);

  const removeMirror = (index: number) => {
    if (mirrors.length <= 1) return;
    setMirrors(mirrors.filter((_, i) => i !== index));
  };

  const updateMirror = (index: number, field: keyof Mirror, value: string) => {
    const updated = [...mirrors];
    updated[index] = { ...updated[index], [field]: value };
    setMirrors(updated);
  };

  const handleSubmit = async () => {
    setError("");
    if (title.length < 3) { setError(t("gameDetail.communityLinks.modal.linkTitle") + " min 3"); return; }
    const validMirrors = mirrors.filter((m) => m.sourceName && m.url);
    if (!validMirrors.length) { setError(t("gameDetail.communityLinks.modal.mirrors") + " required"); return; }
    for (const m of validMirrors) {
      if (!m.url.startsWith("http://") && !m.url.startsWith("https://")) {
        setError("URL must start with http:// or https://"); return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        title,
        description: description || undefined,
        size: size || undefined,
        crackInfo: crackInfo || undefined,
        mirrors: validMirrors,
      });
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#12151a] border border-[#2a2d35] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-bold text-lg">{t("gameDetail.communityLinks.modal.title")}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
        </div>

        {/* Title */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.linkTitle")} *</label>
          <input
            className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
            placeholder="ör. GTA V - Full Repack v1.68"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Crack Info + Size row */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.crackInfo")}</label>
            <input
              className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
              placeholder="ör. EMPRESS v1.68"
              value={crackInfo}
              onChange={(e) => setCrackInfo(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="w-28">
            <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.size")}</label>
            <input
              className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
              placeholder="47.2 GB"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-1 block">{t("gameDetail.communityLinks.modal.description")}</label>
          <textarea
            className="w-full bg-[#0a0c10] border border-[#2a2d35] rounded-md px-3 py-2 text-white text-sm focus:border-[#1a9fff] outline-none resize-none"
            placeholder={t("gameDetail.communityLinks.modal.description") + "..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Mirrors */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">{t("gameDetail.communityLinks.modal.mirrors")} *</label>
          {mirrors.map((mirror, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input
                className="w-32 bg-[#0a0c10] border border-[#2a2d35] rounded-md px-2 py-2 text-[#1a9fff] text-sm focus:border-[#1a9fff] outline-none"
                placeholder={t("gameDetail.communityLinks.modal.sourceName")}
                value={mirror.sourceName}
                onChange={(e) => updateMirror(i, "sourceName", e.target.value)}
                maxLength={50}
              />
              <input
                className="flex-1 bg-[#0a0c10] border border-[#2a2d35] rounded-md px-2 py-2 text-white text-sm focus:border-[#1a9fff] outline-none"
                placeholder={t("gameDetail.communityLinks.modal.sourceUrl")}
                value={mirror.url}
                onChange={(e) => updateMirror(i, "url", e.target.value)}
                maxLength={500}
              />
              {mirrors.length > 1 && (
                <button onClick={() => removeMirror(i)} className="text-red-500 hover:text-red-400 text-lg min-w-[20px]">
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addMirror} className="text-[#1a9fff] text-sm hover:underline mt-1">
            {t("gameDetail.communityLinks.modal.addMirror")}
          </button>
        </div>

        {/* Error */}
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm">
            {t("gameDetail.communityLinks.modal.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-6 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "..." : t("gameDetail.communityLinks.modal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CommunityLinkModal.tsx
git commit -m "feat: add CommunityLinkModal component — form with dynamic mirror fields"
```

---

### Task 9: CommunityLinks Section Component

**Files:**
- Create: `src/components/CommunityLinks.tsx`

- [ ] **Step 1: Create the section component**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-shell";
import { api, API_URL } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { CommunityLinkModal } from "./CommunityLinkModal";
import type { CommunityLink } from "../lib/types";

interface CommunityLinksProps {
  slug: string;
  onNavigateToUser?: (username: string) => void;
}

export function CommunityLinks({ slug, onNavigateToUser }: CommunityLinksProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [links, setLinks] = useState<CommunityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.communityLinks.list(slug);
      setLinks(res.links);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleCreate = async (data: any) => {
    await api.communityLinks.create(slug, data);
    setShowModal(false);
    fetchLinks();
  };

  const handleVote = async (linkId: string, voteType: "UP" | "DOWN") => {
    if (!user) return;
    try {
      const res = await api.communityLinks.vote(slug, linkId, voteType);
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, score: res.score, userVote: res.userVote as "UP" | "DOWN" | null } : l)),
      );
    } catch {}
  };

  const handleReport = async (linkId: string) => {
    if (!user) return;
    if (!confirm(t("gameDetail.communityLinks.vote.reportConfirm"))) return;
    try {
      const res = await api.communityLinks.report(slug, linkId);
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, virusReports: res.virusReports, hasReported: true } : l)),
      );
    } catch {}
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm(t("gameDetail.communityLinks.deleteConfirm"))) return;
    try {
      await api.communityLinks.delete(slug, linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {}
  };

  const handleOpenUrl = async (url: string) => {
    try { await open(url); } catch { window.open(url, "_blank"); }
  };

  const formatDate = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("gameDetail.communityLinks.today");
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}mo`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4">{t("gameDetail.communityLinks.title")}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#12151a] border border-[#1e2128] rounded-lg p-4 mb-3 animate-pulse">
            <div className="h-5 bg-[#1a1d23] rounded w-1/3 mb-3" />
            <div className="h-4 bg-[#1a1d23] rounded w-2/3 mb-2" />
            <div className="h-4 bg-[#1a1d23] rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">{t("gameDetail.communityLinks.title")}</h2>
          {links.length > 0 && (
            <span className="text-xs text-gray-400 bg-[#1a1d23] px-2 py-1 rounded">
              {t("gameDetail.communityLinks.count", { count: links.length })}
            </span>
          )}
        </div>
        {user && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {t("gameDetail.communityLinks.share")}
          </button>
        )}
      </div>

      {/* Empty state */}
      {links.length === 0 && (
        <div className="text-center py-12 bg-[#12151a] border border-[#1e2128] rounded-lg">
          <p className="text-gray-400 mb-2">{t("gameDetail.communityLinks.empty")}</p>
          {user ? (
            <button onClick={() => setShowModal(true)} className="text-[#1a9fff] hover:underline text-sm">
              {t("gameDetail.communityLinks.emptyAction")}
            </button>
          ) : (
            <p className="text-gray-500 text-sm">{t("gameDetail.communityLinks.loginRequired")}</p>
          )}
        </div>
      )}

      {/* Link cards */}
      {links.map((link) => (
        <div
          key={link.id}
          className={`relative bg-[#12151a] rounded-lg p-4 mb-3 ${
            link.isAdminPost
              ? "border-2 border-[#d4a843]"
              : "border border-[#1e2128]"
          } ${link.isHidden ? "opacity-50" : ""}`}
        >
          {/* Admin badge */}
          {link.isAdminPost && (
            <div className="absolute -top-px right-4 bg-[#d4a843] text-[#0a0c10] text-[10px] font-bold px-3 py-0.5 rounded-b-md tracking-wider">
              {t("gameDetail.communityLinks.admin")}
            </div>
          )}

          {/* Hidden badge */}
          {link.isHidden && (
            <div className="absolute top-2 left-2 bg-red-900/50 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded">
              {t("gameDetail.communityLinks.hidden")}
            </div>
          )}

          {/* Top row: title + vote */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-white font-semibold text-[15px] truncate">{link.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                {link.size && (
                  <span className="bg-[#1a9fff22] text-[#1a9fff] px-2 py-0.5 rounded text-[11px]">{link.size}</span>
                )}
                {link.crackInfo && (
                  <span className="bg-[#1a9fff11] text-[#1a9fff99] px-2 py-0.5 rounded text-[11px]">{link.crackInfo}</span>
                )}
                <span>•</span>
                <button
                  onClick={() => onNavigateToUser?.(link.user.username)}
                  className={`hover:underline ${link.isAdminPost ? "text-[#d4a843]" : "text-[#1a9fff]"}`}
                >
                  {link.user.username}
                </button>
                <span>•</span>
                <span>{formatDate(link.createdAt)}</span>
              </div>
            </div>

            {/* Vote widget */}
            <div className="flex items-center gap-2 bg-[#1a1d23] rounded-lg px-3 py-1.5 shrink-0">
              <button
                onClick={() => handleVote(link.id, "UP")}
                className={`text-sm transition-colors ${link.userVote === "UP" ? "text-[#1a9fff]" : "text-gray-500 hover:text-[#1a9fff]"}`}
                disabled={!user}
              >
                ▲
              </button>
              <span className="text-white font-bold text-sm min-w-[20px] text-center">{link.score}</span>
              <button
                onClick={() => handleVote(link.id, "DOWN")}
                className={`text-sm transition-colors ${link.userVote === "DOWN" ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
                disabled={!user}
              >
                ▼
              </button>
            </div>
          </div>

          {/* Description */}
          {link.description && (
            <p className="text-gray-400 text-sm mb-3 leading-relaxed">{link.description}</p>
          )}

          {/* Mirror buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {link.mirrors.map((mirror) => (
              <button
                key={mirror.id}
                onClick={() => handleOpenUrl(mirror.url)}
                className="bg-[#1a1d23] hover:bg-[#252830] border border-[#2a2d35] text-[#1a9fff] px-3 py-1.5 rounded-md text-sm transition-colors"
              >
                {mirror.sourceName}
              </button>
            ))}
          </div>

          {/* Footer: report + delete + download */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {user && !link.hasReported && (
                <button
                  onClick={() => handleReport(link.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  ⚠️ {t("gameDetail.communityLinks.vote.report")}
                </button>
              )}
              {link.hasReported && (
                <span className="text-gray-600 text-xs">⚠️ {t("gameDetail.communityLinks.vote.reported")}</span>
              )}
              {user && (user.username === link.user.username || user.isAdmin) && (
                <button
                  onClick={() => handleDelete(link.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  🗑️
                </button>
              )}
            </div>
            <button
              onClick={() => handleOpenUrl(link.mirrors[0]?.url)}
              className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors"
            >
              ⬇ {t("gameDetail.communityLinks.download")}
            </button>
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && <CommunityLinkModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CommunityLinks.tsx
git commit -m "feat: add CommunityLinks section component — cards, voting, reporting, mirror buttons"
```

---

### Task 10: Integrate into GameDetailPage

**Files:**
- Modify: `src/pages/GameDetailPage.tsx`

- [ ] **Step 1: Add import at top of file (with other imports, ~line 11)**

```typescript
import { CommunityLinks } from "../components/CommunityLinks";
```

- [ ] **Step 2: Insert CommunityLinks section between Reviews and Achievements**

After the reviews section closing `</div>` (~line 333) and before the achievements section (~line 335), add:

```tsx
{/* Community Download Links */}
<CommunityLinks slug={slug} onNavigateToUser={(username) => onNavigate("user-profile", username)} />
```

Note: `slug` and `onNavigate` are already available as props/variables in GameDetailPage. Verify the exact prop names by reading the component's props interface.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/GameDetailPage.tsx
git commit -m "feat: integrate CommunityLinks section into GameDetailPage between reviews and achievements"
```

---

## Chunk 4: Manual Testing & Polish

### Task 11: End-to-End Verification

- [ ] **Step 1: Start the server and app**

```bash
cd server && npm run dev
# In another terminal:
npm run tauri dev
```

- [ ] **Step 2: Test the flow manually**

1. Navigate to any game detail page
2. Verify the "Community Download Links" section appears between Reviews and Achievements
3. Verify empty state shows when no links exist
4. Log in and click "Link Paylaş" — verify modal opens
5. Fill in title, crack info, size, add 2 mirrors → submit
6. Verify new link card appears with correct data
7. Test upvote/downvote (click, toggle, switch)
8. Test virus report (confirm dialog, "Bildirildi" state)
9. Test mirror button clicks (should open external browser)
10. Test "İndir" button (opens first mirror)
11. Verify admin cards show gold border (set a user's `is_admin = true` in DB manually to test)

- [ ] **Step 3: Test i18n by switching language in settings**

Verify all 4 languages render correctly for the community links section.

- [ ] **Step 4: Run TypeScript check and build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: polish community links section after manual testing"
```
