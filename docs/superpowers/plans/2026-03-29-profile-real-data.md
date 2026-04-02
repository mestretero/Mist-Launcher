# Profile Real Data Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile blocks display real game data (stats, favorite game, showcase, activity) for both own and other users' profiles, with local game sync to server.

**Architecture:** New `ProfileGameCache` Prisma model stores local game metadata on server. Sync happens at app startup (bulk) and game close (single). `library-summary` endpoint merges store + local games. ProfilePage switches from dual data sources to single endpoint. Block config IDs standardized to Game UUID / Cache UUID.

**Tech Stack:** Prisma 7, PostgreSQL, Fastify, React, Tauri 2, Zustand, SHA-256 hashing

**Spec:** `docs/superpowers/specs/2026-03-29-profile-real-data-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/prisma/schema.prisma` | Modify | Add ProfileGameCache model + User relation |
| `server/prisma/migrations/...` | Create | Migration + config ID data migration |
| `server/src/services/profile.service.ts` | Modify | Add syncGames, updateSyncGame, enhance getLibrarySummary |
| `server/src/routes/profiles.ts` | Modify | Add POST/PATCH sync-games routes, fix library-summary auth |
| `server/src/services/library.service.ts` | Modify | Remove fallback code |
| `src/lib/api.ts` | Modify | Add syncGames, syncGame API methods |
| `src/stores/localGameStore.ts` | Modify | Add syncToServer, pendingSyncs, hash utility |
| `src/pages/ProfilePage.tsx` | Modify | Use library-summary endpoint, fix getExtraProps IDs |
| `src/App.tsx` | Modify | Trigger sync on authenticated startup |

---

## Task 1: ProfileGameCache Prisma Model

**Files:**
- Modify: `server/prisma/schema.prisma:119` (User model — add relation)
- Modify: `server/prisma/schema.prisma:441` (after UserProfile — add model)

- [ ] **Step 1: Add ProfileGameCache model to schema**

In `server/prisma/schema.prisma`, add after line 440 (after UserProfile `@@map`):

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

- [ ] **Step 2: Add relation to User model**

In the User model (line 119, after `profileCommentsWritten`), add:

```prisma
  profileGameCache       ProfileGameCache[]
```

- [ ] **Step 3: Generate and run migration**

```bash
cd server && npx prisma migrate dev --name add_profile_game_cache
```

Expected: Migration created successfully, database updated.

- [ ] **Step 4: Verify with prisma generate**

```bash
cd server && npx prisma generate
```

Expected: Prisma Client generated, no errors.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add ProfileGameCache model for local game sync"
```

---

## Task 2: Remove Library Service Fallback

**Files:**
- Modify: `server/src/services/library.service.ts:16-26`

- [ ] **Step 1: Remove the fallback code**

In `library.service.ts`, remove lines 16-26 (the `if (items.length === 0)` block that returns all users' items). The function should become:

```typescript
export async function getUserLibrary(userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId },
    include: {
      game: {
        include: { publisher: { select: { name: true, slug: true } } },
      },
    },
    orderBy: { purchasedAt: "desc" },
  });
}
```

- [ ] **Step 2: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/library.service.ts
git commit -m "fix: remove library fallback that returned all users' games"
```

---

## Task 3: Server Sync Endpoints + Enhanced Library Summary

**Files:**
- Modify: `server/src/services/profile.service.ts` (add syncGames, updateSyncGame, enhance getLibrarySummary)
- Modify: `server/src/routes/profiles.ts` (add sync routes, fix auth)

- [ ] **Step 1: Add sync functions to profile.service.ts**

At the end of `profile.service.ts` (after the last function), add:

```typescript
/**
 * Bulk sync local games from client. Upserts by exePathHash, soft-deletes missing.
 */
export async function syncGames(
  userId: string,
  games: Array<{
    title: string;
    coverUrl?: string | null;
    playTimeMins: number;
    exePathHash: string;
    lastPlayedAt?: string | null;
  }>
) {
  if (games.length > 500) throw badRequest("Maximum 500 games per sync");

  const incomingHashes = games.map((g) => g.exePathHash);

  // Soft-delete games not in the incoming list (mark deletedAt)
  await prisma.profileGameCache.updateMany({
    where: {
      userId,
      exePathHash: { notIn: incomingHashes },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  // Upsert each game in a transaction for atomicity and performance
  const results = await prisma.$transaction(
    games.map((g) =>
      prisma.profileGameCache.upsert({
        where: { userId_exePathHash: { userId, exePathHash: g.exePathHash } },
        update: {
          title: g.title,
          coverUrl: g.coverUrl,
          playTimeMins: g.playTimeMins,
          lastPlayedAt: g.lastPlayedAt ? new Date(g.lastPlayedAt) : undefined,
          deletedAt: null, // Restore if previously soft-deleted
        },
        create: {
          userId,
          title: g.title,
          coverUrl: g.coverUrl,
          playTimeMins: g.playTimeMins,
          exePathHash: g.exePathHash,
          lastPlayedAt: g.lastPlayedAt ? new Date(g.lastPlayedAt) : undefined,
        },
      })
    )
  );

  return results.map((r: any) => ({ id: r.id, title: r.title, exePathHash: r.exePathHash }));
}

/**
 * Single game sync (after game close). Upserts by exePathHash.
 */
export async function updateSyncGame(
  userId: string,
  data: { exePathHash: string; playTimeMins: number; lastPlayedAt?: string | null; title?: string }
) {
  return prisma.profileGameCache.upsert({
    where: { userId_exePathHash: { userId, exePathHash: data.exePathHash } },
    update: {
      playTimeMins: data.playTimeMins,
      lastPlayedAt: data.lastPlayedAt ? new Date(data.lastPlayedAt) : new Date(),
      deletedAt: null,
    },
    create: {
      userId,
      title: data.title || "Unknown Game",
      playTimeMins: data.playTimeMins,
      exePathHash: data.exePathHash,
      lastPlayedAt: data.lastPlayedAt ? new Date(data.lastPlayedAt) : new Date(),
    },
  });
}
```

- [ ] **Step 2: Enhance getLibrarySummary to merge both sources**

Replace the existing `getLibrarySummary` function in `profile.service.ts` with:

```typescript
export async function getLibrarySummary(username: string, viewerId: string | undefined) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) throw notFound("User not found");

  await checkVisibility(user.id, viewerId);

  // Store games
  const storeItems = await prisma.libraryItem.findMany({
    where: { userId: user.id },
    include: {
      game: { select: { id: true, title: true, coverImageUrl: true } },
    },
  });

  // Local games (cache, exclude soft-deleted)
  const localItems = await prisma.profileGameCache.findMany({
    where: { userId: user.id, deletedAt: null },
  });

  const libraryItems = [
    ...storeItems.map((i) => ({
      id: i.game.id,
      title: i.game.title,
      coverUrl: i.game.coverImageUrl,
      playTime: i.playTimeMins,
      source: "store" as const,
    })),
    ...localItems.map((i) => ({
      id: i.id,
      title: i.title,
      coverUrl: i.coverUrl,
      playTime: i.playTimeMins,
      source: "local" as const,
    })),
  ];

  const totalMins = storeItems.reduce((s, i) => s + i.playTimeMins, 0)
    + localItems.reduce((s, i) => s + i.playTimeMins, 0);
  const achievementCount = await prisma.userAchievement.count({ where: { userId: user.id } });

  const stats = {
    games: storeItems.length + localItems.length,
    hours: Math.round(totalMins / 60),
    achievements: achievementCount,
  };

  // Recently played — merge both sources, sort by lastPlayed desc
  const allWithLastPlayed = [
    ...storeItems
      .filter((i) => i.lastPlayedAt)
      .map((i) => ({
        id: i.game.id,
        title: i.game.title,
        coverUrl: i.game.coverImageUrl,
        playTime: i.playTimeMins,
        lastPlayed: i.lastPlayedAt!.toISOString(),
        source: "store" as const,
      })),
    ...localItems
      .filter((i) => i.lastPlayedAt)
      .map((i) => ({
        id: i.id,
        title: i.title,
        coverUrl: i.coverUrl,
        playTime: i.playTimeMins,
        lastPlayed: i.lastPlayedAt!.toISOString(),
        source: "local" as const,
      })),
  ];

  const recentlyPlayed = allWithLastPlayed
    .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
    .slice(0, 10);

  return { libraryItems, stats, recentlyPlayed };
}
```

- [ ] **Step 3: Add sync routes to profiles.ts**

**IMPORTANT:** Routes must go in the `/profiles/me` section (before `:username` routes), otherwise Fastify matches "me" as a username param. Add after line 53 (after the last `/profiles/me/blocks` route, before the `:username` section):

```typescript
  // ─── Sync local games ─────────────────────────────────────────────────
  app.post("/profiles/me/sync-games", { preHandler: [app.authenticate] }, async (request) => {
    const games = request.body as Array<{
      title: string;
      coverUrl?: string | null;
      playTimeMins: number;
      exePathHash: string;
      lastPlayedAt?: string | null;
    }>;
    if (!Array.isArray(games)) throw new Error("Body must be an array");
    const result = await profileService.syncGames(request.user!.userId, games);
    return { data: result };
  });

  app.patch("/profiles/me/sync-games", { preHandler: [app.authenticate] }, async (request) => {
    const data = request.body as {
      exePathHash: string;
      playTimeMins: number;
      lastPlayedAt?: string | null;
      title?: string;
    };
    const result = await profileService.updateSyncGame(request.user!.userId, data);
    return { data: result };
  });
```

- [ ] **Step 4: Verify library-summary optional auth**

The existing `library-summary` route already uses `(request as any).user?.userId` which returns `undefined` when no token is sent — this pattern works correctly because Fastify's auth decorator populates `request.user` only when a valid token is present. No change needed here.

- [ ] **Step 5: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/profile.service.ts server/src/routes/profiles.ts
git commit -m "feat: add game sync endpoints and enhance library-summary with merged data"
```

---

## Task 4: Frontend API + Sync Store

**Files:**
- Modify: `src/lib/api.ts:207` (add sync methods)
- Modify: `src/stores/localGameStore.ts` (add sync logic + hash utility)
- Modify: `src/App.tsx:38-44` (trigger sync on auth)

- [ ] **Step 1: Add sync API methods to api.ts**

In `src/lib/api.ts`, add inside the `profiles` object (before the closing `},`):

```typescript
    syncGames: (games: Array<{ title: string; coverUrl?: string | null; playTimeMins: number; exePathHash: string; lastPlayedAt?: string | null }>) =>
      request<any[]>("/profiles/me/sync-games", { method: "POST", body: JSON.stringify(games) }),
    syncGame: (data: { exePathHash: string; playTimeMins: number; lastPlayedAt?: string | null; title?: string }) =>
      request<any>("/profiles/me/sync-games", { method: "PATCH", body: JSON.stringify(data) }),
```

- [ ] **Step 2: Add SHA-256 hash utility and sync logic to localGameStore.ts**

Add at the top of `src/stores/localGameStore.ts` (after imports):

```typescript
async function hashExePath(exePath: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(exePath);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

Add to the store state interface:

```typescript
  syncToServer: () => Promise<void>;
  syncSingleGame: (exePath: string, playTimeMins: number, title: string) => Promise<void>;
```

Add the implementations in the store body:

```typescript
    syncToServer: async () => {
      try {
        const { games } = get();
        if (games.length === 0) return;
        const payload = await Promise.all(
          games.map(async (g) => ({
            title: g.title,
            coverUrl: g.cover_url || null,
            playTimeMins: Math.floor(g.play_time / 60),
            exePathHash: await hashExePath(g.exe_path),
            lastPlayedAt: g.last_played || null,
          }))
        );
        await api.profiles.syncGames(payload);
      } catch {
        // Silent failure — next startup will retry
      }
    },

    syncSingleGame: async (exePath, playTimeMins, title) => {
      try {
        const exePathHash = await hashExePath(exePath);
        await api.profiles.syncGame({
          exePathHash,
          playTimeMins,
          lastPlayedAt: new Date().toISOString(),
          title,
        });
      } catch {
        // Silent failure — next bulk sync will catch up
      }
    },
```

Import `api` at the top of the file:

```typescript
import { api } from "../lib/api";
```

- [ ] **Step 3: Trigger sync on authenticated app startup**

In `src/App.tsx`, modify the `isAuthenticated` useEffect (lines 38-44) to add sync:

```typescript
  useEffect(() => {
    if (isAuthenticated) {
      useNotificationStore.getState().startPolling();
      useCartStore.getState().fetch();
      // Sync local games to server for profile display
      import("./stores/localGameStore").then(({ useLocalGameStore }) => {
        useLocalGameStore.getState().loadGames().then(() => {
          useLocalGameStore.getState().syncToServer();
        });
      });
    }
    return () => { useNotificationStore.getState().stopPolling(); };
  }, [isAuthenticated]);
```

- [ ] **Step 4: Listen for game-status event and sync on game close**

In `src/App.tsx`, add a listener for the `game-status` Tauri event. Add inside the first useEffect (lines 33-36):

Note: `play_time` from Tauri SQLite is in **seconds**. Division by 60 converts to minutes for the server.

```typescript
  useEffect(() => {
    loadSession();
    initListener();

    // Listen for game close events to sync play time
    let unlisten: (() => void) | undefined;
    Promise.all([
      import("@tauri-apps/api/event"),
      import("./stores/localGameStore"),
    ]).then(([{ listen }, { useLocalGameStore }]) => {
      listen<{ game_id: string; status: string; play_time_secs: number }>("game-status", (event) => {
        if (event.payload.status === "stopped" && event.payload.play_time_secs > 0) {
          const store = useLocalGameStore.getState();
          const game = store.games.find((g) => g.id === event.payload.game_id);
          if (game) {
            store.syncSingleGame(
              game.exe_path,
              Math.floor(game.play_time / 60),
              game.title
            );
          }
        }
      }).then((fn) => { unlisten = fn; });
    }).catch(() => {});

    return () => { unlisten?.(); };
  }, []);
```

- [ ] **Step 5: Verify frontend compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/stores/localGameStore.ts src/App.tsx
git commit -m "feat: add local game sync to server on startup and game close"
```

---

## Task 5: ProfilePage — Use Library Summary + Fix IDs

**Files:**
- Modify: `src/pages/ProfilePage.tsx:51-96, 140-172`

- [ ] **Step 1: Replace dual data source with library-summary endpoint**

In `ProfilePage.tsx`, replace the data fetching in the useEffect (lines 51-72). Remove `api.library.list()` call and `localGames` usage for blocks. Replace with `library-summary`:

Replace the imports — remove `useLocalGameStore` usage for profile blocks (keep it for game launching). Change the state:

```typescript
  // Replace libraryItems state with summary state
  const [librarySummary, setLibrarySummary] = useState<any>(null);
```

Replace the data fetching useEffect:

```typescript
  useEffect(() => {
    useAuthStore.getState().loadSession();

    // Fetch library summary (merged store + local games)
    if (user?.username) {
      api.profiles.getLibrarySummary(user.username)
        .then((data: any) => setLibrarySummary(data))
        .catch(() => {});
    }

    // Fetch profile blocks
    api.profiles.getMe().then((data: any) => {
      setProfileData(data);
      setBlocks(data.blocks || []);
      setEditVisibility(data.visibility || "PUBLIC");
      setEditAllowComments(data.allowComments ?? true);
      setEditCustomStatus(data.customStatus || "");
    }).catch(() => {});

    // Fetch comments
    if (user?.username) {
      api.profiles.getComments(user.username).then((data: any) => {
        setComments(data.comments || []);
      }).catch(() => {});
    }
  }, []);
```

- [ ] **Step 2: Remove old stats calculation, simplify getExtraProps**

Remove lines 87-96 (totalGames, totalPlayTimeMins, totalPlayTimeHours, recentlyPlayed calculations).

Replace `getExtraProps` (lines 140-172) with:

```typescript
  const getExtraProps = (block: any) => {
    const extras: any = {};
    if (block.type === "STATS") {
      extras.stats = librarySummary?.stats || { games: 0, hours: 0, achievements: 0 };
    }
    if (block.type === "ACTIVITY") {
      extras.recentlyPlayed = librarySummary?.recentlyPlayed || [];
    }
    if (block.type === "GAME_SHOWCASE" || block.type === "FAVORITE_GAME") {
      extras.libraryItems = librarySummary?.libraryItems || [];
    }
    if (block.type === "ACHIEVEMENTS") extras.achievements = [];
    if (block.type === "COMMENT_WALL") {
      extras.username = user?.username;
      extras.comments = comments;
      extras.allowComments = profileData?.allowComments ?? true;
      extras.currentUserId = user?.id;
      extras.onAddComment = handleAddComment;
      extras.onDeleteComment = handleDeleteComment;
    }
    return extras;
  };
```

- [ ] **Step 3: Clean up unused imports and state**

Remove `libraryItems` state and `LibraryItem` import if no longer used. Remove `localGames`/`loadLocalGames` from the destructure if only used for profile blocks (keep if used for game launching elsewhere in the page — check first).

- [ ] **Step 4: Verify frontend compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat: ProfilePage uses library-summary endpoint for unified block data"
```

---

## Task 6: Config ID Migration

**Files:**
- Create: `server/prisma/migrations/XXXXXX_fix_block_config_ids/migration.sql`

- [ ] **Step 1: Create a SQL migration to fix existing block config IDs**

Run a blank migration:

```bash
cd server && npx prisma migrate dev --create-only --name fix_block_config_game_ids
```

- [ ] **Step 2: Add the ID fix SQL to the migration file**

Edit the generated migration file and add:

```sql
-- Fix FAVORITE_GAME blocks: LibraryItem.id → Game.id
UPDATE profile_blocks SET config = jsonb_set(
  config, '{gameId}',
  (SELECT to_jsonb(li.game_id::text) FROM library_items li WHERE li.id::text = config->>'gameId')
)
WHERE type = 'FAVORITE_GAME'
  AND config->>'gameId' IS NOT NULL
  AND EXISTS (SELECT 1 FROM library_items li WHERE li.id::text = config->>'gameId');

-- Fix GAME_SHOWCASE blocks: LibraryItem.id[] → Game.id[]
-- For each block with gameIds, replace each ID
UPDATE profile_blocks SET config = jsonb_set(
  config, '{gameIds}',
  (
    SELECT COALESCE(
      jsonb_agg(
        COALESCE(
          (SELECT to_jsonb(li.game_id::text) FROM library_items li WHERE li.id::text = elem::text),
          elem
        )
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(config->'gameIds') AS elem
  )
)
WHERE type = 'GAME_SHOWCASE'
  AND config->'gameIds' IS NOT NULL
  AND jsonb_array_length(config->'gameIds') > 0;
```

- [ ] **Step 3: Run the migration**

```bash
cd server && npx prisma migrate dev
```

Expected: Migration applied successfully.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/migrations/
git commit -m "fix: migrate block config IDs from LibraryItem to Game UUIDs"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Server TypeScript check**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 2: Frontend TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test checklist**

1. Start server: `cd server && npm run dev`
2. Start app: `npm run tauri dev`
3. Log in — verify avatar shows on own profile
4. Go to own profile — verify stats show real numbers (from library-summary)
5. Go to own profile — verify Activity block shows recently played games
6. Edit profile — select Favorite Game — verify game list includes both store and local games
7. Save profile — view from another account — verify Favorite Game shows the selected game
8. Verify Stats block on other user's profile shows correct numbers
9. Verify Activity block on other user's profile shows recently played

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat: profile real data — local game sync, merged library summary, ID standardization"
```
