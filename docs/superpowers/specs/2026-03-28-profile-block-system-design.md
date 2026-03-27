# Stealike: Customizable Profile with Block System

> **Status:** Approved
> **Date:** 2026-03-28
> **Scope:** Profile block system, profile visibility, comment wall, other-user profile viewing

---

## 1. Vision

Users can fully customize their profile page using a drag-and-drop block system. The top section (avatar, username, status) is always fixed. Below it, users add, remove, reorder, and configure content blocks. Other users can view profiles (respecting visibility settings) and leave comments if allowed.

All UI text is i18n-compatible (TR/EN/DE/ES).

---

## 2. Architecture

**Server-First:** Profile layout, blocks, and comments stored in Postgres. API serves profiles to any viewer with visibility checks.

```
┌─────────────────────────────────┐
│         React Frontend           │
│  ProfilePage (own) + edit mode   │
│  UserProfilePage (other users)   │
│  BlockRenderer + block components│
├─────────────────────────────────┤
│         Fastify API              │
│  /profiles/:username             │
│  /profiles/me/blocks             │
│  /profiles/:username/comments    │
├─────────────────────────────────┤
│         Postgres (Prisma)        │
│  user_profiles                   │
│  profile_blocks                  │
│  profile_comments                │
└─────────────────────────────────┘
```

---

## 3. Database Schema (Prisma)

Follows existing codebase conventions: `@db.Uuid` on UUID fields, `@@map()` for table names, `@map()` for snake_case columns.

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

model UserProfile {
  id            String             @id @default(uuid()) @db.Uuid
  userId        String             @unique @map("user_id") @db.Uuid
  user          User               @relation(fields: [userId], references: [id])
  visibility    ProfileVisibility  @default(PUBLIC)
  allowComments Boolean            @default(true) @map("allow_comments")
  bannerTheme   String             @default("default") @map("banner_theme")  // preset key: "default" | "cyber" | "nature" | "mech"
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
  content       String      @db.VarChar(1000)  // max 1000 chars
  createdAt     DateTime    @default(now()) @map("created_at")
  deletedAt     DateTime?   @map("deleted_at")

  @@index([profileId, createdAt])
  @@map("profile_comments")
}
```

**Note:** `bannerUrl` replaced with `bannerTheme` (preset key). Banner image upload is out of scope — frontend maps theme key to predefined background images.

**Note:** Comments are immutable once posted (no edit, only delete). Max 1000 characters, empty strings rejected by API validation.

**Note:** The `User` model needs two new relations: `profile UserProfile?` and `profileCommentsWritten ProfileComment[] @relation("ProfileCommentsWritten")`.

---

## 4. Block Types & Config

| Type | Config JSON | Description |
|------|------------|-------------|
| `game_showcase` | `{ gameIds: string[], layout: "grid" \| "list" }` | Display 1-4 games with covers and play time |
| `favorite_game` | `{ gameId: string }` | Single game as large banner |
| `achievements` | `{ display: "recent" \| "rarest", count: number }` | Show achievement cards |
| `activity` | `{ count: number }` | Recent play activity timeline |
| `text` | `{ title?: string, content: string }` | Free-form text block |
| `screenshots` | `{ images: [{ url: string, caption?: string }] }` | Screenshot gallery — URLs are pasted by user (external image links). No upload mechanism in Phase 1. |
| `social_links` | `{ links: [{ platform: string, url: string }] }` | Discord, YouTube, Twitch, X, etc. |
| `stats` | `{ show: string[] }` | Custom stat cards (games, hours, achievements) |
| `comment_wall` | `{}` | Comment section — controlled by allowComments |

**Supported social platforms:** discord, youtube, twitch, twitter, instagram, github, reddit, steam, epic

**Validation constraints:**
- Max **20 blocks** per profile
- `game_showcase`: 1-4 gameIds
- `text`: content max 2000 chars, title max 100 chars
- `screenshots`: max 6 images, URL must start with `https://`
- `social_links`: max 10 links, URL validated per platform pattern
- `achievements`: count max 10
- `activity`: count max 10

---

## 5. API Endpoints

### 5.1 Profile Viewing

```
GET /profiles/:username
```

**Response:** `{ profile: UserProfile, blocks: ProfileBlock[], comments: ProfileComment[] }`

**Visibility logic (server-side):**
- `PUBLIC` → return full profile to anyone (except blocked users — see below)
- `FRIENDS` → check if `request.user` has friendship with status `ACCEPTED` with profile owner. If yes, return full. If no, return `{ restricted: "friends_only" }`. Blocked users get 404.

**Blocking is mutual:** If either user has a `BLOCKED` friendship record with the other (regardless of sender/receiver direction), both users get 404 when trying to view each other's profile. Query: `WHERE ((senderId = A AND receiverId = B) OR (senderId = B AND receiverId = A)) AND status = 'BLOCKED'`.
- `PRIVATE` → only `request.user.id === profile.userId` returns full. Others get `{ restricted: "private" }`
- Unauthenticated requests: only see `PUBLIC` profiles

### 5.2 Profile Management

```
PATCH /profiles/me
Body: { visibility?, allowComments?, bannerTheme?, customStatus? }
```

**Auto-create:** If user has no `UserProfile` row, create one with defaults on first PATCH or when profile is first viewed.

### 5.3 Block CRUD

```
GET /profiles/me/blocks
→ ProfileBlock[]

PUT /profiles/me/blocks
Body: [{ id?, type, position, config, visible }]
→ Replaces all blocks atomically (for drag-and-drop save)

POST /profiles/me/blocks
Body: { type, config? }
→ Creates new block at last position

DELETE /profiles/me/blocks/:id
```

**PUT semantics:** Client sends the full ordered list of blocks (max 20). Server logic: blocks with an `id` field → update existing; blocks without `id` → create new; existing blocks whose `id` is absent from the list → delete. This makes drag-and-drop reordering a single API call. Server validates block count limit and config constraints.

### 5.4 Comments

```
GET /profiles/:username/comments?page=1&limit=20
→ { comments: ProfileComment[], total: number }

POST /profiles/:username/comments
Body: { content: string }  — min 1 char, max 1000 chars, trimmed, reject empty
→ 403 if allowComments is false
→ 403 if profile is not visible to requester

DELETE /profiles/:username/comments/:id
→ Allowed if request.user is profile owner OR comment author
→ Soft delete (sets deletedAt)
```

---

## 6. Frontend Components

### 6.1 File Structure

```
src/pages/ProfilePage.tsx        — Own profile (edit mode available)
src/pages/UserProfilePage.tsx    — Other user's profile (view only)
src/components/profile/
  BlockRenderer.tsx              — Maps block type to component
  ProfileHeader.tsx              — Fixed top: banner, avatar, username, status, visibility badge
  EditToolbar.tsx                — Edit mode top bar: visibility, allowComments, save/cancel
  BlockAddMenu.tsx               — "Add Block" dropdown with block type list
  blocks/
    GameShowcaseBlock.tsx
    FavoriteGameBlock.tsx
    AchievementsBlock.tsx
    ActivityBlock.tsx
    TextBlock.tsx
    ScreenshotsBlock.tsx
    SocialLinksBlock.tsx
    StatsBlock.tsx
    CommentWallBlock.tsx
  BlockWrapper.tsx               — Edit mode wrapper: drag handle, hide/show, delete, config gear
```

### 6.2 ProfilePage (Own Profile)

**View mode:**
- `ProfileHeader` with edit button
- Blocks rendered via `BlockRenderer` in position order
- Only visible blocks shown

**Edit mode (toggle):**
- `EditToolbar` appears at top: visibility dropdown, allowComments toggle, Save/Cancel buttons
- Each block wrapped in `BlockWrapper` with:
  - Drag handle (left edge)
  - Eye icon toggle (visible/hidden)
  - Gear icon (opens config popover for that block type)
  - Trash icon (delete with confirm)
- `BlockAddMenu` button at bottom
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`
- On Save: `PUT /profiles/me/blocks` with full block list + `PATCH /profiles/me` for visibility/comments

### 6.3 UserProfilePage (Other User)

- Fetches `GET /profiles/:username`
- If `restricted`, shows appropriate message + action (add friend / go back)
- If visible, renders `ProfileHeader` (no edit button) + blocks via `BlockRenderer`
- `CommentWallBlock` shows comments + "write comment" form if allowed

### 6.4 Navigation

The existing App.tsx uses `navigate(page: string, slug?: string)` pattern with custom history.

- `App.tsx`: add route `page === "user-profile"` → `<UserProfilePage username={gameSlug} onNavigate={navigate} />`
  - `gameSlug` is reused as the username parameter (already the slug mechanism)
- `FriendsPage`: **must be updated** to accept `onNavigate` prop (currently takes no props). `App.tsx` must pass `onNavigate={navigate}` to it. Clicking a friend's name → `onNavigate("user-profile", friend.username)`
- `ProfilePage` (own): existing `page === "profile"` stays. **Update prop type** from `(page: string) => void` to `(page: string, slug?: string) => void` to support user-profile navigation.
- `CommentWallBlock`: clicking commenter's name → `onNavigate("user-profile", author.username)`

### 6.5 Default Blocks

When a user's profile is created for the first time, seed these default blocks:

1. `stats` — position 0, `{ show: ["games", "hours"] }`
2. `activity` — position 1, `{ count: 5 }`
3. `comment_wall` — position 2, `{}`

---

## 7. i18n

New translation namespace `profile.blocks`:

```json
{
  "profile": {
    "blocks": {
      "gameShowcase": "Game Showcase",
      "favoriteGame": "Favorite Game",
      "achievements": "Achievements",
      "activity": "Recent Activity",
      "text": "Text Block",
      "screenshots": "Screenshots",
      "socialLinks": "Social Links",
      "stats": "Statistics",
      "commentWall": "Comment Wall",
      "addBlock": "Add Block",
      "editProfile": "Edit Profile",
      "saveChanges": "Save Changes",
      "cancelEdit": "Cancel",
      "visibility": "Profile Visibility",
      "visibilityPublic": "Public",
      "visibilityFriends": "Friends Only",
      "visibilityPrivate": "Private",
      "allowComments": "Allow Comments",
      "restricted_friends": "This profile is only visible to friends.",
      "restricted_private": "This profile is private.",
      "addFriend": "Add Friend",
      "writeComment": "Write a comment...",
      "sendComment": "Send",
      "deleteComment": "Delete",
      "noComments": "No comments yet. Be the first!",
      "commentsDisabled": "Comments are disabled for this profile."
    }
  }
}
```

All 4 locale files (tr.json, en.json, de.json, es.json) must include this namespace.

---

## 8. Drag-and-Drop Library

**New dependency (must be installed):** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

Used only in edit mode on `ProfilePage`. Each block gets a `SortableItem` wrapper. On drag end, positions are recalculated and the new order is held in local state until "Save" is pressed.

---

## 9. Out of Scope

- Profile avatar upload (Phase 2 — currently uses initials)
- Banner image upload (Phase 2 — currently uses theme presets)
- Block-level visibility (all blocks share profile-level visibility)
- Comment replies / threading
- Profile analytics (view count, etc.)
- Local game data in profile blocks (blocks reference server-side game IDs only)
