# Community Download Links — Design Spec

## Overview

Add a "Community Download Links" section to the existing GameDetailPage, placed between User Reviews and Achievements. Registered users can share download links (with multiple mirrors), vote on them (Reddit-style upvote/downvote), and report suspicious links. Admin-posted links get a gold-bordered card and are pinned to the top.

## Prerequisites

The User model currently has no admin role. This spec requires adding:
- `isAdmin Boolean @default(false) @map("is_admin")` to the `User` model
- Include `isAdmin` in JWT `TokenPayload` (`{ userId, email, isAdmin }`)
- Create `adminGuard` middleware that checks `request.user.isAdmin`

These changes are small and scoped — they will be part of the migration for this feature.

## Placement

```
Hero + Screenshots
Açıklama + Sistem Gereksinimleri
Kullanıcı Değerlendirmeleri
─────────────────────────────
→ Topluluk İndirme Linkleri  ← NEW
─────────────────────────────
Başarımlar
```

## UI Components

### 1. Section Header

- Title: "Topluluk İndirme Linkleri" (i18n key: `gameDetail.communityLinks`)
- Right side: "Link Paylaş" button (only visible to authenticated users)
- Link count badge next to title

### 2. Link Card (Expanded Card Style)

Each link is a full card with:

```
┌─────────────────────────────────────────────────┐
│ [ADMIN badge - gold, top-right, only if admin]  │
│                                                 │
│  Title                        [▲ 42 ▼] vote    │
│  📦 47.2 GB • 🔓 EMPRESS v1.68                 │
│  • username • 3 gün önce                        │
│                                                 │
│  Description text here...                       │
│                                                 │
│  ┌─────────┐ ┌──────────────┐ ┌──────────┐     │
│  │ Fitgirl │ │ TorrentOyun  │ │ DODI     │     │
│  └─────────┘ └──────────────┘ └──────────┘     │
│                                                 │
│  ⚠️ Virüs Bildir                    ⬇ İndir   │
└─────────────────────────────────────────────────┘
```

**Card variants:**
- **Admin card**: `border: 2px solid #d4a843`, "ADMIN" badge top-right with gold background, username in gold color. Always pinned to top regardless of score.
- **Normal card**: `border: 1px solid #1e2128`, standard styling, sorted by score descending.
- **Hidden card**: Not rendered for normal users (score ≤ -5 OR virusReports ≥ 3). Admins see them with a semi-transparent overlay and "Gizli" label.

**Vote widget:**
- Horizontal layout in top-right: `[▲] score [▼]`
- Background: `#1a1d23`, rounded pill shape
- Active upvote: `#1a9fff` filled, active downvote: `#ff4444` filled
- One vote per user per link (toggle behavior — clicking same vote removes it)

**Mirror buttons:**
- Displayed as a row of pill-shaped buttons with source names
- Clicking a mirror opens the URL in external browser (Tauri `shell.open`)
- Main "İndir" button opens the first mirror

**Virus report:**
- "⚠️ Virüs Bildir" link in bottom-left
- Click shows confirmation dialog: "Bu linki virüs olarak bildirmek istediğinize emin misiniz?"
- One report per user per link
- After reporting, shows "⚠️ Bildirildi" in muted state

**Loading state:**
- Skeleton loader (3 placeholder cards with pulse animation) while fetching links
- Consistent with existing loading patterns in GameDetailPage

### 3. Link Submit Modal

Triggered by "Link Paylaş" button. Modal with dimmed backdrop.

**Fields:**

| Field | Required | Type | Placeholder |
|-------|----------|------|-------------|
| Başlık | Yes | text, max 100 chars | "ör. GTA V - Full Repack v1.68" |
| Versiyon / Crack Bilgisi | No | text, max 100 chars | "ör. EMPRESS v1.68 + All DLCs" |
| Boyut | No | text, max 20 chars | "ör. 47.2 GB" |
| Açıklama | No | textarea, max 500 chars | "Açıklama ekle..." |
| Mirror Linkleri | Min 1 | dynamic list | source name + URL |

**Mirror link sub-form:**
- Each row: `[Source Name input (130px)] [URL input (flex)] [× remove button]`
- "+ Mirror Link Ekle" button to add more rows
- First mirror cannot be removed (minimum 1 required)
- Source name placeholder: "ör. Fitgirl"
- URL placeholder: "https://..."

**Validation:**
- Title required, at least 3 characters
- At least 1 mirror with both source name and valid URL
- URL must start with `http://` or `https://`

**Submit flow:**
- POST to API → success → close modal → prepend new link to list
- Error → show inline error message in modal

### 4. Empty State

When no links exist for a game:
- Centered message: "Henüz indirme linki paylaşılmamış"
- "İlk linki sen paylaş!" call-to-action (links to modal, auth required)

## Data Model

### Changes to Existing Models

**User model — add:**
```prisma
isAdmin        Boolean   @default(false) @map("is_admin")
communityLinks CommunityLink[]
communityLinkVotes CommunityLinkVote[]
communityLinkReports CommunityLinkReport[]
```

**Game model — add:**
```prisma
communityLinks CommunityLink[]
```

### CommunityLink

```prisma
model CommunityLink {
  id            String    @id @default(uuid())
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
```

### CommunityLinkMirror

```prisma
model CommunityLinkMirror {
  id              String        @id @default(uuid())
  communityLinkId String        @map("community_link_id") @db.Uuid
  sourceName      String        @map("source_name") @db.VarChar(50)
  url             String        @db.VarChar(500)
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)

  @@map("community_link_mirrors")
}
```

### CommunityLinkVote

```prisma
model CommunityLinkVote {
  id              String        @id @default(uuid())
  communityLinkId String        @map("community_link_id") @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  voteType        VoteType      @map("vote_type")
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id])

  @@unique([communityLinkId, userId])
  @@map("community_link_votes")
}

enum VoteType {
  UP
  DOWN

  @@map("vote_type")
}
```

### CommunityLinkReport

```prisma
model CommunityLinkReport {
  id              String        @id @default(uuid())
  communityLinkId String        @map("community_link_id") @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  createdAt       DateTime      @default(now()) @map("created_at")

  communityLink   CommunityLink @relation(fields: [communityLinkId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id])

  @@unique([communityLinkId, userId])
  @@map("community_link_reports")
}
```

## API Endpoints

### GET /games/:slug/community-links

Returns all visible links for a game, sorted by: admin pins first, then score descending.

**Auth:** Optional. If Bearer token present, includes `userVote` and `hasReported` per link. Uses a `tryAuthenticate` pattern (does not 401 on missing token).

**Response:**
```json
{
  "links": [
    {
      "id": "uuid",
      "title": "GTA V - Full Repack",
      "description": "Selective install...",
      "size": "47.2 GB",
      "crackInfo": "EMPRESS v1.68",
      "score": 42,
      "virusReports": 0,
      "isAdminPost": true,
      "isHidden": false,
      "createdAt": "2026-03-30T...",
      "user": { "username": "admin_user", "avatarUrl": "..." },
      "mirrors": [
        { "id": "uuid", "sourceName": "Fitgirl", "url": "https://..." },
        { "id": "uuid", "sourceName": "TorrentOyun", "url": "https://..." }
      ],
      "userVote": "UP" | "DOWN" | null,
      "hasReported": false
    }
  ]
}
```

**Filtering:**
- Normal users: only `isHidden = false` links
- Admin users: all links (with `isHidden` flag visible)

### POST /games/:slug/community-links (Auth required)

Create a new download link. `isAdminPost` is automatically set to `true` if `request.user.isAdmin` is true.

**Body:**
```json
{
  "title": "GTA V - Full Repack",
  "description": "Selective install...",
  "size": "47.2 GB",
  "crackInfo": "EMPRESS v1.68",
  "mirrors": [
    { "sourceName": "Fitgirl", "url": "https://..." },
    { "sourceName": "TorrentOyun", "url": "https://..." }
  ]
}
```

**Validation:**
- title: required, 3-100 chars
- mirrors: at least 1, each with sourceName (1-50 chars) and valid HTTP/HTTPS URL
- description: optional, max 500 chars
- size: optional, max 20 chars
- crackInfo: optional, max 100 chars

**Rate limits:** max 5 links per user per game, max 20 links per user per day.

### POST /games/:slug/community-links/:linkId/vote (Auth required)

**Body:** `{ "voteType": "UP" | "DOWN" }`

- Toggle behavior: same vote type removes the vote
- Uses Prisma `$transaction` with `increment`/`decrement` on `score` field
- Score change logic:
  - No previous vote → add vote → score ±1
  - Same vote exists → remove vote → score ∓1
  - Different vote exists → switch vote → score ±2
- Auto-hides link if score drops to -5 (`isHidden = true`)
- Returns updated `{ score, userVote }`

### POST /games/:slug/community-links/:linkId/report (Auth required)

- Creates report record (unique per user per link)
- Increments `virusReports` atomically via `$transaction`
- Auto-hides link if virusReports reaches 3 (`isHidden = true`)
- Returns `{ reported: true, virusReports: count }`

### DELETE /games/:slug/community-links/:linkId (Auth required)

- Owner can delete their own link
- Admin (`isAdmin = true`) can delete any link
- Cascades to mirrors, votes, reports

### PATCH /games/:slug/community-links/:linkId/toggle-hide (Admin only)

- Toggles `isHidden` on a link (admin un-hide/re-hide)
- Uses `adminGuard` middleware
- Returns `{ isHidden: boolean }`

## Frontend API Client Additions

Add to `src/lib/api.ts`:

```typescript
api.communityLinks = {
  list(slug: string): Promise<{ links: CommunityLink[] }>,
  create(slug: string, data: CreateCommunityLinkBody): Promise<CommunityLink>,
  vote(slug: string, linkId: string, voteType: VoteType): Promise<{ score: number, userVote: string | null }>,
  report(slug: string, linkId: string): Promise<{ reported: boolean, virusReports: number }>,
  delete(slug: string, linkId: string): Promise<void>,
  toggleHide(slug: string, linkId: string): Promise<{ isHidden: boolean }>,
}
```

## Sorting Logic

1. **Admin links** (`isAdminPost = true`) — always first, sorted by score desc
2. **Normal links** — sorted by score descending, then createdAt descending
3. **Hidden links** (`isHidden = true`) — not returned for normal users

## Auto-hide Rules

A link becomes hidden (`isHidden = true`) when:
- `score <= -5` (too many downvotes)
- `virusReports >= 3` (virus threshold reached)

Admins can toggle visibility back via PATCH endpoint.

## i18n Keys Required

All 4 languages (TR/EN/DE/ES):

```
gameDetail.communityLinks                    — section title
gameDetail.communityLinks.count              — "{{count}} link"
gameDetail.communityLinks.share              — "Link Paylaş"
gameDetail.communityLinks.empty              — "Henüz indirme linki paylaşılmamış"
gameDetail.communityLinks.emptyAction        — "İlk linki sen paylaş!"
gameDetail.communityLinks.modal.title        — "Yeni İndirme Linki Paylaş"
gameDetail.communityLinks.modal.linkTitle    — "Başlık"
gameDetail.communityLinks.modal.crackInfo    — "Versiyon / Crack Bilgisi"
gameDetail.communityLinks.modal.size         — "Boyut"
gameDetail.communityLinks.modal.description  — "Açıklama"
gameDetail.communityLinks.modal.mirrors      — "İndirme Linkleri"
gameDetail.communityLinks.modal.addMirror    — "+ Mirror Link Ekle"
gameDetail.communityLinks.modal.sourceName   — "ör. Fitgirl"
gameDetail.communityLinks.modal.submit       — "Paylaş"
gameDetail.communityLinks.modal.cancel       — "İptal"
gameDetail.communityLinks.vote.report        — "Virüs Bildir"
gameDetail.communityLinks.vote.reported      — "Bildirildi"
gameDetail.communityLinks.vote.reportConfirm — "Bu linki virüs olarak bildirmek istediğinize emin misiniz?"
gameDetail.communityLinks.download           — "İndir"
gameDetail.communityLinks.admin              — "ADMIN"
gameDetail.communityLinks.hidden             — "Gizli"
gameDetail.communityLinks.loginRequired      — "Link paylaşmak için giriş yapın"
gameDetail.communityLinks.deleteConfirm      — "Bu linki silmek istediğinize emin misiniz?"
gameDetail.communityLinks.rateLimitError     — "Link paylaşma limitine ulaştınız"
```

## Security Considerations

- URLs are opened externally via Tauri `shell.open` — no iframe/embed risk
- Rate limiting on POST endpoints (max 5 links per user per game, max 20 links per user per day)
- URL validation server-side (must be valid HTTP/HTTPS URL)
- XSS prevention: all user text rendered with React (auto-escaped)
- CSRF: already handled by Bearer token auth pattern
- Admin actions protected by `adminGuard` middleware checking `isAdmin` from JWT
