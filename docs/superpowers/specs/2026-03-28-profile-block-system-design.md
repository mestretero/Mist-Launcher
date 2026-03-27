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

```prisma
model UserProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
  visibility    String   @default("public")  // "public" | "friends" | "private"
  allowComments Boolean  @default(true)
  bannerUrl     String?
  customStatus  String?
  blocks        ProfileBlock[]
  comments      ProfileComment[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ProfileBlock {
  id        String      @id @default(uuid())
  profileId String
  profile   UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type      String      // "game_showcase" | "achievements" | "activity" | "text" | "screenshots" | "social_links" | "stats" | "favorite_game" | "comment_wall"
  position  Int
  config    Json        @default("{}")
  visible   Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([profileId, position])
}

model ProfileComment {
  id            String      @id @default(uuid())
  profileId     String
  profile       UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  authorId      String
  author        User        @relation("ProfileCommentsWritten", fields: [authorId], references: [id])
  content       String
  createdAt     DateTime    @default(now())
  deletedAt     DateTime?

  @@index([profileId, createdAt])
}
```

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
| `screenshots` | `{ images: [{ url: string, caption?: string }] }` | Screenshot gallery |
| `social_links` | `{ links: [{ platform: string, url: string }] }` | Discord, YouTube, Twitch, X, etc. |
| `stats` | `{ show: string[] }` | Custom stat cards (games, hours, achievements) |
| `comment_wall` | `{}` | Comment section — controlled by allowComments |

**Supported social platforms:** discord, youtube, twitch, twitter, instagram, github, reddit, steam, epic

---

## 5. API Endpoints

### 5.1 Profile Viewing

```
GET /profiles/:username
```

**Response:** `{ profile: UserProfile, blocks: ProfileBlock[], comments: ProfileComment[] }`

**Visibility logic (server-side):**
- `public` → return full profile to anyone
- `friends` → check if `request.user` has accepted friendship with profile owner. If yes, return full. If no, return `{ restricted: "friends_only" }`
- `private` → only `request.user.id === profile.userId` returns full. Others get `{ restricted: "private" }`
- Unauthenticated requests: only see `public` profiles

### 5.2 Profile Management

```
PATCH /profiles/me
Body: { visibility?, allowComments?, bannerUrl?, customStatus? }
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

**PUT semantics:** Client sends the full ordered list of blocks. Server deletes blocks not in the list, updates existing ones, creates new ones. This makes drag-and-drop reordering a single API call.

### 5.4 Comments

```
GET /profiles/:username/comments?page=1&limit=20
→ { comments: ProfileComment[], total: number }

POST /profiles/:username/comments
Body: { content: string }
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

- `App.tsx`: new route `page === "user-profile"` with `slug = username`
- `FriendsPage`: clicking a friend's name → `onNavigate("user-profile", friend.username)`
- `ProfilePage`: "View Public Profile" button → `onNavigate("user-profile", user.username)`
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

**Package:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

Used only in edit mode on `ProfilePage`. Each block gets a `SortableItem` wrapper. On drag end, positions are recalculated and the new order is held in local state until "Save" is pressed.

---

## 9. Out of Scope

- Profile avatar upload (Phase 2 — currently uses initials)
- Banner image upload (Phase 2 — currently uses theme presets)
- Block-level visibility (all blocks share profile-level visibility)
- Comment replies / threading
- Profile analytics (view count, etc.)
- Local game data in profile blocks (blocks reference server-side game IDs only)
