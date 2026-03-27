# Profile Block System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customizable profile pages with drag-and-drop block system, visibility controls, comment wall, and other-user profile viewing.

**Architecture:** Server-first — profile layout, blocks, and comments in Postgres via Prisma. Frontend renders blocks dynamically with edit mode using @dnd-kit. 4-language i18n support.

**Tech Stack:** Prisma 7, Fastify 5, React 19, Zustand, @dnd-kit/core + @dnd-kit/sortable, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-28-profile-block-system-design.md`

---

## Chunk 1: Database + Backend API

### Task 1: Prisma Schema — Add Profile Models

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to schema.prisma**

Add after the existing `FriendshipStatus` enum:

```prisma
enum ProfileVisibility {
  PUBLIC
  FRIENDS
  PRIVATE

  @@map("profile_visibility")
}

enum ProfileBlockType {
  GAME_SHOWCASE
  FAVORITE_GAME
  ACHIEVEMENTS
  ACTIVITY
  TEXT
  SCREENSHOTS
  SOCIAL_LINKS
  STATS
  COMMENT_WALL

  @@map("profile_block_type")
}
```

Add new models:

```prisma
model UserProfile {
  id            String             @id @default(uuid()) @db.Uuid
  userId        String             @unique @map("user_id") @db.Uuid
  user          User               @relation(fields: [userId], references: [id])
  visibility    ProfileVisibility  @default(PUBLIC)
  allowComments Boolean            @default(true) @map("allow_comments")
  bannerTheme   String             @default("default") @map("banner_theme")
  customStatus  String?            @map("custom_status")
  blocks        ProfileBlock[]
  comments      ProfileComment[]
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  @@map("user_profiles")
}

model ProfileBlock {
  id        String           @id @default(uuid()) @db.Uuid
  profileId String           @map("profile_id") @db.Uuid
  profile   UserProfile      @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type      ProfileBlockType
  position  Int
  config    Json             @default("{}")
  visible   Boolean          @default(true)
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")

  @@index([profileId, position])
  @@map("profile_blocks")
}

model ProfileComment {
  id            String      @id @default(uuid()) @db.Uuid
  profileId     String      @map("profile_id") @db.Uuid
  profile       UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  authorId      String      @map("author_id") @db.Uuid
  author        User        @relation("ProfileCommentsWritten", fields: [authorId], references: [id])
  content       String      @db.VarChar(1000)
  createdAt     DateTime    @default(now()) @map("created_at")
  deletedAt     DateTime?   @map("deleted_at")

  @@index([profileId, createdAt])
  @@map("profile_comments")
}
```

Add relations to existing User model (inside the User model block):

```prisma
  profile               UserProfile?
  profileCommentsWritten ProfileComment[]  @relation("ProfileCommentsWritten")
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_profile_block_system
```

- [ ] **Step 3: Commit**

```bash
git add server/prisma/
git commit -m "feat: add UserProfile, ProfileBlock, ProfileComment models with enums"
```

---

### Task 2: Profile Service

**Files:**
- Create: `server/src/services/profile.service.ts`

- [ ] **Step 1: Write profile.service.ts**

```typescript
import { prisma } from "../lib/prisma.js";
import { notFound, forbidden } from "../lib/errors.js";
import { ProfileVisibility, ProfileBlockType, FriendshipStatus } from "@prisma/client";

const DEFAULT_BLOCKS = [
  { type: ProfileBlockType.STATS, position: 0, config: { show: ["games", "hours"] } },
  { type: ProfileBlockType.ACTIVITY, position: 1, config: { count: 5 } },
  { type: ProfileBlockType.COMMENT_WALL, position: 2, config: {} },
];

const MAX_BLOCKS = 20;

/** Get or create a user's profile */
export async function getOrCreateProfile(userId: string) {
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      user: { select: { id: true, username: true, email: true, avatarUrl: true, bio: true, isStudent: true, createdAt: true } },
    },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId,
        blocks: { create: DEFAULT_BLOCKS },
      },
      include: {
        blocks: { orderBy: { position: "asc" } },
        user: { select: { id: true, username: true, email: true, avatarUrl: true, bio: true, isStudent: true, createdAt: true } },
      },
    });
  }

  return profile;
}

/** Check if viewer can see profile. Returns null if allowed, or restriction reason. */
async function checkVisibility(profileUserId: string, viewerId?: string): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({ where: { userId: profileUserId } });
  if (!profile) return null; // will be auto-created

  // Check blocking (mutual)
  if (viewerId && viewerId !== profileUserId) {
    const blocked = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: profileUserId },
          { senderId: profileUserId, receiverId: viewerId },
        ],
        status: FriendshipStatus.BLOCKED,
      },
    });
    if (blocked) return "blocked";
  }

  if (profile.visibility === ProfileVisibility.PUBLIC) return null;

  if (!viewerId) return profile.visibility === ProfileVisibility.FRIENDS ? "friends_only" : "private";

  if (viewerId === profileUserId) return null;

  if (profile.visibility === ProfileVisibility.PRIVATE) return "private";

  // FRIENDS — check accepted friendship
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: viewerId, receiverId: profileUserId },
        { senderId: profileUserId, receiverId: viewerId },
      ],
      status: FriendshipStatus.ACCEPTED,
    },
  });

  return friendship ? null : "friends_only";
}

/** View a profile by username */
export async function getProfileByUsername(username: string, viewerId?: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw notFound("User not found");

  const restriction = await checkVisibility(user.id, viewerId);
  if (restriction === "blocked") throw notFound("User not found");
  if (restriction) return { restricted: restriction, username: user.username };

  const profile = await getOrCreateProfile(user.id);
  const comments = await prisma.profileComment.findMany({
    where: { profileId: profile.id, deletedAt: null },
    include: { author: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { profile, comments };
}

/** Update own profile settings */
export async function updateProfile(userId: string, data: {
  visibility?: ProfileVisibility;
  allowComments?: boolean;
  bannerTheme?: string;
  customStatus?: string;
}) {
  const profile = await getOrCreateProfile(userId);
  return prisma.userProfile.update({
    where: { id: profile.id },
    data,
  });
}

/** Replace all blocks atomically */
export async function saveBlocks(userId: string, blocks: {
  id?: string;
  type: ProfileBlockType;
  position: number;
  config: any;
  visible: boolean;
}[]) {
  if (blocks.length > MAX_BLOCKS) throw forbidden(`Maximum ${MAX_BLOCKS} blocks allowed`);

  const profile = await getOrCreateProfile(userId);

  // Delete all existing, then create new ones (simplest atomic approach)
  await prisma.$transaction([
    prisma.profileBlock.deleteMany({ where: { profileId: profile.id } }),
    ...blocks.map((b, i) =>
      prisma.profileBlock.create({
        data: {
          profileId: profile.id,
          type: b.type,
          position: i,
          config: b.config || {},
          visible: b.visible ?? true,
        },
      })
    ),
  ]);

  return prisma.profileBlock.findMany({
    where: { profileId: profile.id },
    orderBy: { position: "asc" },
  });
}

/** Add a single block */
export async function addBlock(userId: string, type: ProfileBlockType, config: any = {}) {
  const profile = await getOrCreateProfile(userId);
  const count = await prisma.profileBlock.count({ where: { profileId: profile.id } });
  if (count >= MAX_BLOCKS) throw forbidden(`Maximum ${MAX_BLOCKS} blocks allowed`);

  return prisma.profileBlock.create({
    data: {
      profileId: profile.id,
      type,
      position: count,
      config,
    },
  });
}

/** Delete a block */
export async function deleteBlock(userId: string, blockId: string) {
  const profile = await getOrCreateProfile(userId);
  const block = await prisma.profileBlock.findUnique({ where: { id: blockId } });
  if (!block || block.profileId !== profile.id) throw notFound("Block not found");
  return prisma.profileBlock.delete({ where: { id: blockId } });
}

/** Add a comment */
export async function addComment(profileUsername: string, authorId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 1000) throw forbidden("Comment must be 1-1000 characters");

  const user = await prisma.user.findUnique({ where: { username: profileUsername } });
  if (!user) throw notFound("User not found");

  const restriction = await checkVisibility(user.id, authorId);
  if (restriction) throw forbidden("Cannot comment on this profile");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.allowComments) throw forbidden("Comments are disabled for this profile");

  return prisma.profileComment.create({
    data: { profileId: profile.id, authorId, content: trimmed },
    include: { author: { select: { id: true, username: true, avatarUrl: true } } },
  });
}

/** Delete a comment (profile owner or comment author) */
export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.profileComment.findUnique({
    where: { id: commentId },
    include: { profile: true },
  });
  if (!comment) throw notFound("Comment not found");
  if (comment.authorId !== userId && comment.profile.userId !== userId) {
    throw forbidden("Not authorized to delete this comment");
  }

  return prisma.profileComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

/** Get paginated comments */
export async function getComments(profileUsername: string, viewerId: string | undefined, page: number, limit: number) {
  const user = await prisma.user.findUnique({ where: { username: profileUsername } });
  if (!user) throw notFound("User not found");

  const restriction = await checkVisibility(user.id, viewerId);
  if (restriction) throw forbidden("Cannot view this profile");

  const profile = await getOrCreateProfile(user.id);
  const [comments, total] = await Promise.all([
    prisma.profileComment.findMany({
      where: { profileId: profile.id, deletedAt: null },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.profileComment.count({ where: { profileId: profile.id, deletedAt: null } }),
  ]);

  return { comments, total };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/profile.service.ts
git commit -m "feat: add profile service with visibility, blocks CRUD, comments"
```

---

### Task 3: Profile Routes

**Files:**
- Create: `server/src/routes/profiles.ts`
- Modify: `server/src/app.ts` (register route)

- [ ] **Step 1: Write profiles.ts**

```typescript
import { FastifyInstance } from "fastify";
import * as profileService from "../services/profile.service.js";

export default async function profileRoutes(app: FastifyInstance) {
  // Public: view profile (auth optional)
  app.get("/profiles/:username", async (request) => {
    const { username } = request.params as { username: string };
    const viewerId = request.user?.userId;
    const result = await profileService.getProfileByUsername(username, viewerId);
    return { data: result };
  });

  // Auth required for rest
  app.register(async (authed) => {
    authed.addHook("preHandler", app.authenticate);

    // Get own profile
    authed.get("/profiles/me", async (request) => {
      const profile = await profileService.getOrCreateProfile(request.user!.userId);
      return { data: profile };
    });

    // Update own profile settings
    authed.patch("/profiles/me", async (request) => {
      const data = request.body as { visibility?: string; allowComments?: boolean; bannerTheme?: string; customStatus?: string };
      const result = await profileService.updateProfile(request.user!.userId, data as any);
      return { data: result };
    });

    // Save all blocks (PUT = replace)
    authed.put("/profiles/me/blocks", async (request) => {
      const blocks = request.body as any[];
      const result = await profileService.saveBlocks(request.user!.userId, blocks);
      return { data: result };
    });

    // Add single block
    authed.post("/profiles/me/blocks", async (request) => {
      const { type, config } = request.body as { type: string; config?: any };
      const result = await profileService.addBlock(request.user!.userId, type as any, config);
      return { data: result };
    });

    // Delete block
    authed.delete("/profiles/me/blocks/:id", async (request) => {
      const { id } = request.params as { id: string };
      await profileService.deleteBlock(request.user!.userId, id);
      return { data: { success: true } };
    });

    // Get comments (paginated)
    authed.get("/profiles/:username/comments", async (request) => {
      const { username } = request.params as { username: string };
      const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string };
      const result = await profileService.getComments(username, request.user?.userId, parseInt(page), parseInt(limit));
      return { data: result };
    });

    // Add comment
    authed.post("/profiles/:username/comments", async (request) => {
      const { username } = request.params as { username: string };
      const { content } = request.body as { content: string };
      const result = await profileService.addComment(username, request.user!.userId, content);
      return { data: result };
    });

    // Delete comment
    authed.delete("/profiles/:username/comments/:id", async (request) => {
      const { username, id } = request.params as { username: string; id: string };
      await profileService.deleteComment(request.user!.userId, id);
      return { data: { success: true } };
    });
  });
}
```

- [ ] **Step 2: Register route in app.ts**

Add import and registration in `server/src/app.ts`:

```typescript
import profileRoutes from "./routes/profiles.js";
// ... in the route registration section:
await app.register(profileRoutes);
```

- [ ] **Step 3: Verify server starts**

```bash
cd server && npm run dev
```
Expected: Server starts without errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/profiles.ts server/src/app.ts
git commit -m "feat: add profile routes (view, blocks CRUD, comments)"
```

---

## Chunk 2: Frontend — Block Components + Profile Store

### Task 4: Install Dependencies + API Client

**Files:**
- Modify: `package.json` (npm install)
- Modify: `src/lib/api.ts` (add profile endpoints)

- [ ] **Step 1: Install @dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Add profile API endpoints to api.ts**

Add a `profiles` namespace to the api object in `src/lib/api.ts`:

```typescript
profiles: {
  get: (username: string) =>
    request<any>(`/profiles/${username}`),
  getMe: () =>
    request<any>("/profiles/me"),
  updateMe: (data: { visibility?: string; allowComments?: boolean; bannerTheme?: string; customStatus?: string }) =>
    request<any>("/profiles/me", { method: "PATCH", body: JSON.stringify(data) }),
  saveBlocks: (blocks: any[]) =>
    request<any>("/profiles/me/blocks", { method: "PUT", body: JSON.stringify(blocks) }),
  addBlock: (type: string, config?: any) =>
    request<any>("/profiles/me/blocks", { method: "POST", body: JSON.stringify({ type, config }) }),
  deleteBlock: (id: string) =>
    request<any>(`/profiles/me/blocks/${id}`, { method: "DELETE" }),
  getComments: (username: string, page = 1) =>
    request<any>(`/profiles/${username}/comments?page=${page}&limit=20`),
  addComment: (username: string, content: string) =>
    request<any>(`/profiles/${username}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteComment: (username: string, commentId: string) =>
    request<any>(`/profiles/${username}/comments/${commentId}`, { method: "DELETE" }),
},
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/api.ts
git commit -m "feat: add @dnd-kit deps and profile API client endpoints"
```

---

### Task 5: i18n — Add Profile Block Translations

**Files:**
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`

- [ ] **Step 1: Add `profile.blocks` namespace to all 4 locale files**

Add this to `tr.json` under the `profile` key:

```json
"blocks": {
  "gameShowcase": "Oyun Vitrini",
  "gameShowcaseDesc": "1-4 oyun secip sergile",
  "favoriteGame": "Favori Oyun",
  "favoriteGameDesc": "Tek bir oyunu buyuk banner olarak goster",
  "achievements": "Basarimlar",
  "achievementsDesc": "En son veya en nadir basarimlarin",
  "activity": "Son Aktivite",
  "activityDesc": "Son oynama timeline'i",
  "text": "Metin Blogu",
  "textDesc": "Serbest yazi alani",
  "screenshots": "Ekran Goruntuleri",
  "screenshotsDesc": "Oyun icinden gorseller",
  "socialLinks": "Sosyal Linkler",
  "socialLinksDesc": "Discord, YouTube, Twitch vb.",
  "stats": "Istatistikler",
  "statsDesc": "Oyun sayisi, oynama suresi vb.",
  "commentWall": "Yorum Duvari",
  "commentWallDesc": "Ziyaretciler yorum birakabilir",
  "addBlock": "Blok Ekle",
  "editProfile": "Profili Duzenle",
  "saveChanges": "Degisiklikleri Kaydet",
  "cancelEdit": "Vazgec",
  "visibility": "Profil Gorunurlugu",
  "visibilityPublic": "Herkese Acik",
  "visibilityFriends": "Sadece Arkadaslar",
  "visibilityPrivate": "Gizli",
  "allowComments": "Yorumlara Izin Ver",
  "restrictedFriends": "Bu profil sadece arkadaslara acik.",
  "restrictedPrivate": "Bu profil gizli.",
  "addFriend": "Arkadas Ekle",
  "writeComment": "Bir yorum yaz...",
  "sendComment": "Gonder",
  "deleteComment": "Sil",
  "noComments": "Henuz yorum yok. Ilk yorumu sen yap!",
  "commentsDisabled": "Bu profil icin yorumlar kapali.",
  "blockHidden": "Bu blok gizli",
  "confirmDelete": "Bu blogu silmek istediginize emin misiniz?",
  "maxBlocks": "Maksimum 20 blok eklenebilir"
}
```

Add equivalent keys to en.json, de.json, es.json with proper translations.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add profile block i18n translations (TR/EN/DE/ES)"
```

---

### Task 6: Block Components

**Files:**
- Create: `src/components/profile/blocks/TextBlock.tsx`
- Create: `src/components/profile/blocks/StatsBlock.tsx`
- Create: `src/components/profile/blocks/ActivityBlock.tsx`
- Create: `src/components/profile/blocks/GameShowcaseBlock.tsx`
- Create: `src/components/profile/blocks/FavoriteGameBlock.tsx`
- Create: `src/components/profile/blocks/SocialLinksBlock.tsx`
- Create: `src/components/profile/blocks/ScreenshotsBlock.tsx`
- Create: `src/components/profile/blocks/AchievementsBlock.tsx`
- Create: `src/components/profile/blocks/CommentWallBlock.tsx`
- Create: `src/components/profile/BlockRenderer.tsx`

- [ ] **Step 1: Create block components directory**

```bash
mkdir -p src/components/profile/blocks
```

- [ ] **Step 2: Write each block component**

Each block receives `{ config, isEditing, onConfigChange }` props. In view mode they render content. In edit mode they show config controls.

Example — **TextBlock.tsx**:

```tsx
import { useTranslation } from "react-i18next";

interface Props {
  config: { title?: string; content?: string };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
}

export function TextBlock({ config, isEditing, onConfigChange }: Props) {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="space-y-2">
        <input
          type="text" placeholder={t("profile.blocks.text")}
          value={config.title || ""} onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
          className="w-full px-3 py-2 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50"
          maxLength={100}
        />
        <textarea
          placeholder="..." value={config.content || ""}
          onChange={(e) => onConfigChange({ ...config, content: e.target.value })}
          className="w-full px-3 py-2 bg-[#0a0c10]/60 border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#1a9fff]/50 resize-none"
          rows={4} maxLength={2000}
        />
      </div>
    );
  }

  return (
    <div>
      {config.title && <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">{config.title}</h3>}
      <p className="text-sm text-[#8f98a0] leading-relaxed whitespace-pre-wrap">{config.content || ""}</p>
    </div>
  );
}
```

Follow same pattern for each block. For data-driven blocks (GameShowcase, FavoriteGame, Achievements, Activity), they fetch data from the API or receive it as props from the parent.

**CommentWallBlock.tsx** is special — it shows comments list + add form. Receives `username`, `allowComments`, `comments[]`, `onAddComment`, `onDeleteComment` as props.

- [ ] **Step 3: Write BlockRenderer.tsx**

```tsx
import { TextBlock } from "./blocks/TextBlock";
import { StatsBlock } from "./blocks/StatsBlock";
import { ActivityBlock } from "./blocks/ActivityBlock";
import { GameShowcaseBlock } from "./blocks/GameShowcaseBlock";
import { FavoriteGameBlock } from "./blocks/FavoriteGameBlock";
import { SocialLinksBlock } from "./blocks/SocialLinksBlock";
import { ScreenshotsBlock } from "./blocks/ScreenshotsBlock";
import { AchievementsBlock } from "./blocks/AchievementsBlock";
import { CommentWallBlock } from "./blocks/CommentWallBlock";

const BLOCK_MAP: Record<string, React.ComponentType<any>> = {
  TEXT: TextBlock,
  STATS: StatsBlock,
  ACTIVITY: ActivityBlock,
  GAME_SHOWCASE: GameShowcaseBlock,
  FAVORITE_GAME: FavoriteGameBlock,
  SOCIAL_LINKS: SocialLinksBlock,
  SCREENSHOTS: ScreenshotsBlock,
  ACHIEVEMENTS: AchievementsBlock,
  COMMENT_WALL: CommentWallBlock,
};

interface Props {
  block: { id: string; type: string; config: any; visible: boolean };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  extraProps?: Record<string, any>;
}

export function BlockRenderer({ block, isEditing, onConfigChange, extraProps = {} }: Props) {
  const Component = BLOCK_MAP[block.type];
  if (!Component) return null;
  if (!block.visible && !isEditing) return null;

  return <Component config={block.config} isEditing={isEditing} onConfigChange={onConfigChange} {...extraProps} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/
git commit -m "feat: add 9 profile block components + BlockRenderer"
```

---

## Chunk 3: Profile Pages + Edit Mode + Wiring

### Task 7: ProfileHeader Component

**Files:**
- Create: `src/components/profile/ProfileHeader.tsx`

- [ ] **Step 1: Write ProfileHeader.tsx**

Shows: banner, avatar, username, customStatus, bio, visibility badge, student badge. In edit mode shows banner theme selector.

Receives: `{ user, profile, isEditing, isOwnProfile, onNavigate }` props.

Uses existing THEMES array for banner backgrounds.

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx
git commit -m "feat: add ProfileHeader component with banner and identity"
```

---

### Task 8: EditToolbar + BlockWrapper + BlockAddMenu

**Files:**
- Create: `src/components/profile/EditToolbar.tsx`
- Create: `src/components/profile/BlockWrapper.tsx`
- Create: `src/components/profile/BlockAddMenu.tsx`

- [ ] **Step 1: Write EditToolbar.tsx**

Top bar in edit mode: visibility dropdown, allowComments toggle, Save/Cancel buttons.

- [ ] **Step 2: Write BlockWrapper.tsx**

Wraps each block in edit mode with: drag handle (left), eye toggle, gear (config), trash icon. Uses `@dnd-kit/sortable` `useSortable` hook.

- [ ] **Step 3: Write BlockAddMenu.tsx**

"Blok Ekle" button that opens a dropdown listing all block types with icon + name + description. Uses i18n keys from `profile.blocks.*`.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/EditToolbar.tsx src/components/profile/BlockWrapper.tsx src/components/profile/BlockAddMenu.tsx
git commit -m "feat: add edit toolbar, block wrapper with DnD, block add menu"
```

---

### Task 9: Rewrite ProfilePage (Own Profile)

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Rewrite ProfilePage**

Complete rewrite using new components:
- Fetches profile via `api.profiles.getMe()`
- View mode: `ProfileHeader` + blocks via `BlockRenderer`
- Edit mode: `EditToolbar` + `DndContext/SortableContext` wrapping blocks in `BlockWrapper` + `BlockAddMenu`
- On save: `api.profiles.saveBlocks()` + `api.profiles.updateMe()`
- Passes `onNavigate` with `(page: string, slug?: string)` signature

- [ ] **Step 2: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat: rewrite ProfilePage with block system and edit mode"
```

---

### Task 10: UserProfilePage (Other User's Profile)

**Files:**
- Create: `src/pages/UserProfilePage.tsx`

- [ ] **Step 1: Write UserProfilePage**

- Fetches `api.profiles.get(username)`
- If `restricted`, shows message + action button
- If visible, renders `ProfileHeader` (no edit) + blocks via `BlockRenderer`
- CommentWallBlock receives comment data and handlers

- [ ] **Step 2: Commit**

```bash
git add src/pages/UserProfilePage.tsx
git commit -m "feat: add UserProfilePage for viewing other users' profiles"
```

---

### Task 11: Wiring — Routes + FriendsPage Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/FriendsPage.tsx`

- [ ] **Step 1: Add user-profile route to App.tsx**

```tsx
import UserProfilePage from "./pages/UserProfilePage";
// In the route section:
{page === "user-profile" && gameSlug && <UserProfilePage username={gameSlug} onNavigate={navigate} />}
```

- [ ] **Step 2: Update FriendsPage to accept and use onNavigate**

Add `onNavigate` prop to FriendsPage. Pass it from App.tsx:
```tsx
{page === "friends" && <FriendsPage onNavigate={navigate} />}
```

In FriendsPage, make friend names clickable:
```tsx
<button onClick={() => onNavigate("user-profile", friend.username)}>
  {friend.username}
</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/FriendsPage.tsx src/pages/UserProfilePage.tsx
git commit -m "feat: wire user-profile route and friend navigation"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Start server**

```bash
cd server && npm run dev
```

- [ ] **Step 2: Build frontend**

```bash
npm run build
```

- [ ] **Step 3: Run Tauri dev**

```bash
npm run tauri dev
```

- [ ] **Step 4: Manual test**

1. Go to own profile → should see block-based layout
2. Click "Edit Profile" → edit mode with DnD
3. Add a text block, reorder, save
4. Go to Friends → click a friend → see their profile
5. Leave a comment on friend's profile
6. Change visibility to "Friends Only" → verify restriction

- [ ] **Step 5: Final commit**

```bash
git add src/ server/
git commit -m "feat: complete profile block system with DnD, comments, and visibility"
```
