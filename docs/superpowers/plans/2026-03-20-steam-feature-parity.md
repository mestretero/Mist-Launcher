# Steam Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Stealike to full Steam feature parity across 4 phases, from easy frontend-only wins to complex social systems.

**Architecture:** Each phase builds on the previous. Faz 1 uses existing Tauri commands with no backend changes. Faz 2 adds new Prisma models, Fastify routes, and frontend pages. Faz 3-4 add progressively more complex social/community features.

**Tech Stack:** React 19 + Tailwind 4 + Zustand (frontend), Fastify + Prisma 7 + PostgreSQL (backend), Tauri 2.0 + Rust (desktop)

---

## Chunk 1: Faz 1 — Mevcut Altyapıyı Bağla (Frontend-Only)

No backend or schema changes needed. Uses existing Tauri commands and APIs.

### Task 1.1: Screenshot Lightbox Modal

**Files:**
- Create: `src/components/ScreenshotLightbox.tsx`
- Modify: `src/pages/GameDetailPage.tsx`

- [ ] Create `ScreenshotLightbox` component with:
  - Full-screen overlay (z-50, bg-black/90, backdrop-blur)
  - Current image centered, max-w/max-h constrained
  - Left/right arrow navigation (keyboard + click)
  - Close on Escape key or click outside
  - Image counter "3 / 12"
- [ ] Wire into GameDetailPage: click main screenshot → open lightbox
- [ ] Verify TypeScript compilation

### Task 1.2: Library — Verify Files, Uninstall, Disk Space UI

**Files:**
- Modify: `src/pages/LibraryPage.tsx`

- [ ] Add "Dosya Doğrula" button in action bar utility icons
  - Calls `invoke("verify_game_files", { gameId, path, expectedHash })`
  - Shows spinner during verification, toast on result
- [ ] Add "Kaldır" button in action bar utility icons
  - Confirmation dialog before calling `invoke("uninstall_game", { gameId, path })`
  - Toast on success, remove installPath from state
- [ ] Add disk space check before download
  - Call `invoke("get_disk_space", { path })` in handleDownload
  - Compare with `game.downloadSize`, warn if insufficient
  - Toast error if not enough space
- [ ] Verify TypeScript compilation

### Task 1.3: Library Sub-Navigation Tabs

**Files:**
- Modify: `src/pages/LibraryPage.tsx`

- [ ] Add `activeLibTab` state for sub-navigation tabs
- [ ] "Mağaza Sayfası" tab → navigate to game detail page
- [ ] "DLC'ler" tab → placeholder: "Bu oyun için DLC bulunmuyor"
- [ ] "Topluluk" tab → placeholder with future community features
- [ ] "Tartışmalar" tab → placeholder forum-style layout
- [ ] "Atölye" tab → placeholder workshop layout
- [ ] "Rehberler" tab → placeholder guides layout
- [ ] "Destek" tab → link to support/FAQ
- [ ] Verify TypeScript compilation

### Task 1.4: Download Pause/Resume UI

**Files:**
- Modify: `src/pages/LibraryPage.tsx`
- Modify: `src/stores/downloadStore.ts`

- [ ] Add pause/resume buttons next to download progress bar
- [ ] Wire to `invoke("pause_download", { downloadId })` and `invoke("resume_download", { downloadId })`
- [ ] Add paused state to downloadStore
- [ ] Show "Duraklatıldı" state in sidebar game list
- [ ] Verify TypeScript compilation

### Task 1.5: Settings — Bandwidth Limiter

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] Replace static "Sınırsız" text with interactive bandwidth selector
- [ ] Options: Sınırsız, 10 MB/s, 5 MB/s, 2 MB/s, 1 MB/s
- [ ] Save to localStorage for now
- [ ] Toast on change
- [ ] Verify TypeScript compilation

---

## Chunk 2: Faz 2 — Temel Yeni Özellikler (DB + Backend + Frontend)

### Task 2.1: Prisma Schema — Add All New Models

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: new migration

New models:
- **Wishlist**: userId + gameId (unique pair), addedAt
- **Review**: userId + gameId (unique pair), rating (1-5), content, createdAt, updatedAt
- **WalletTransaction**: userId, amount, type (DEPOSIT/PURCHASE/REFERRAL_EARNING/REFUND), referenceId?, balanceAfter, createdAt
- **Notification**: userId, type, title, message, data (Json), isRead, createdAt
- **Achievement**: gameId, name, description, iconUrl
- **UserAchievement**: userId + achievementId (unique pair), unlockedAt
- **Friendship**: userId + friendId (unique pair), status (PENDING/ACCEPTED/BLOCKED), createdAt
- **GameCollection**: userId, name, createdAt
- **GameCollectionItem**: collectionId + gameId (unique pair)
- **Cart**: userId (unique), updatedAt
- **CartItem**: cartId + gameId (unique pair), addedAt

User model additions:
- walletBalance (Decimal, default 0)
- bio (String?)
- isEmailVerified (Boolean, default false)
- emailVerifyToken (String?)
- passwordResetToken (String?)
- passwordResetExpiry (DateTime?)
- twoFactorSecret (String?)
- twoFactorEnabled (Boolean, default false)

Game model additions:
- trailerUrl (String?)

- [ ] Update schema.prisma with all models above
- [ ] Run `npx prisma migrate dev --name add-steam-features`
- [ ] Update seed.ts with sample achievements, wishlists
- [ ] Verify migration and seed

### Task 2.2: Wishlist System

**Files:**
- Create: `server/src/services/wishlist.service.ts`
- Create: `server/src/routes/wishlist.ts`
- Create: `server/src/schemas/wishlist.schema.ts`
- Modify: `server/src/app.ts` (register routes)
- Modify: `src/lib/api.ts` (add wishlist namespace)
- Modify: `src/lib/types.ts` (add WishlistItem type)
- Create: `src/pages/WishlistPage.tsx`
- Modify: `src/pages/GameDetailPage.tsx` (add wishlist button)
- Modify: `src/pages/StorePage.tsx` (add heart icon on GameCard)
- Modify: `src/components/GameCard.tsx` (optional wishlist heart)
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/TopBar.tsx` (add nav item)

Backend:
- [ ] Create wishlist service: add, remove, list, check
- [ ] Create wishlist routes: POST/DELETE /wishlist/:gameId, GET /wishlist
- [ ] Register in app.ts

Frontend:
- [ ] Add `api.wishlist` namespace
- [ ] Add WishlistPage with game grid + remove button
- [ ] Add heart icon to GameDetailPage purchase panel
- [ ] Add route in App.tsx, nav item in TopBar
- [ ] Verify compilation

### Task 2.3: Wallet System

**Files:**
- Create: `server/src/services/wallet.service.ts`
- Create: `server/src/routes/wallet.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/services/payment.service.ts` (wallet payment option)
- Modify: `src/lib/api.ts`
- Modify: `src/components/TopBar.tsx` (show real balance)
- Create: `src/components/WalletModal.tsx`
- Modify: `src/stores/authStore.ts` (add walletBalance to user)

Backend:
- [ ] Wallet service: getBalance, deposit, deduct, getHistory
- [ ] Wallet routes: GET /wallet, POST /wallet/deposit, GET /wallet/history
- [ ] Update payment service to support wallet deduction
- [ ] Register routes

Frontend:
- [ ] Add wallet balance to user type and auth store
- [ ] Show real balance in TopBar (replace "0.00 TL")
- [ ] Create WalletModal: balance display, deposit form, transaction history
- [ ] Add wallet payment option in GameDetailPage
- [ ] Verify compilation

### Task 2.4: Review & Rating System

**Files:**
- Create: `server/src/services/review.service.ts`
- Create: `server/src/routes/reviews.ts`
- Create: `server/src/schemas/review.schema.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/GameDetailPage.tsx` (reviews section)
- Create: `src/components/StarRating.tsx`
- Create: `src/components/ReviewCard.tsx`

Backend:
- [ ] Review service: create, update, delete, listByGame, getAvgRating
- [ ] Routes: POST/PUT/DELETE /games/:slug/reviews, GET /games/:slug/reviews
- [ ] Register routes

Frontend:
- [ ] StarRating component (interactive + display-only modes)
- [ ] ReviewCard component
- [ ] Add reviews section below game description in GameDetailPage
- [ ] Show average rating + count on GameCard
- [ ] Verify compilation

### Task 2.5: Notification System

**Files:**
- Create: `server/src/services/notification.service.ts`
- Create: `server/src/routes/notifications.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Create: `src/stores/notificationStore.ts`
- Create: `src/components/NotificationPanel.tsx`
- Modify: `src/components/TopBar.tsx` (real notification icon + badge)

Backend:
- [ ] Notification service: create, markRead, markAllRead, list, unreadCount
- [ ] Routes: GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all
- [ ] Trigger notifications on: payment success, wishlist game on sale, friend request
- [ ] Register routes

Frontend:
- [ ] Notification store with unread count polling
- [ ] NotificationPanel dropdown from TopBar bell icon
- [ ] Badge count on bell icon
- [ ] Mark as read on click
- [ ] Verify compilation

### Task 2.6: Profile Editing

**Files:**
- Modify: `server/src/services/auth.service.ts` (updateProfile)
- Modify: `server/src/routes/auth.ts` (PATCH /auth/profile)
- Modify: `src/lib/api.ts`
- Modify: `src/pages/ProfilePage.tsx` (edit mode)
- Modify: `src/lib/types.ts` (add bio, avatarUrl to User)

- [ ] Backend: PATCH /auth/profile endpoint (bio, avatarUrl)
- [ ] Frontend: Edit mode in ProfilePage with bio textarea, avatar upload placeholder
- [ ] Update User type and auth store
- [ ] Verify compilation

### Task 2.7: Password Reset Flow

**Files:**
- Modify: `server/src/services/auth.service.ts`
- Modify: `server/src/routes/auth.ts`
- Create: `src/pages/ForgotPasswordPage.tsx`
- Modify: `src/pages/LoginPage.tsx` (add link)

- [ ] Backend: POST /auth/forgot-password, POST /auth/reset-password
- [ ] Frontend: ForgotPasswordPage with email input
- [ ] Add "Şifremi Unuttum" link to LoginPage
- [ ] Verify compilation

### Task 2.8: Email Verification

**Files:**
- Modify: `server/src/services/auth.service.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `src/pages/SettingsPage.tsx` (verification banner)

- [ ] Backend: POST /auth/verify-email, POST /auth/resend-verification
- [ ] Show verification banner in SettingsPage if not verified
- [ ] Send verification token on registration
- [ ] Verify compilation

### Task 2.9: Achievement System

**Files:**
- Create: `server/src/services/achievement.service.ts`
- Create: `server/src/routes/achievements.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/LibraryPage.tsx` (real achievement data)
- Create: `src/components/AchievementCard.tsx`

- [ ] Backend: GET /games/:slug/achievements, GET /library/:id/achievements
- [ ] Seed sample achievements for each game
- [ ] Frontend: Replace hardcoded "12/45" with real data
- [ ] AchievementCard component with locked/unlocked states
- [ ] Verify compilation

### Task 2.10: Download Queue

**Files:**
- Modify: `src/stores/downloadStore.ts`
- Create: `src/components/DownloadQueue.tsx`
- Modify: `src/pages/LibraryPage.tsx`

- [ ] Extend downloadStore with queue management (add to queue, process next)
- [ ] DownloadQueue component showing all pending/active downloads
- [ ] Sequential processing: only one active download at a time
- [ ] Verify compilation

### Task 2.11: Game Collections

**Files:**
- Create: `server/src/services/collection.service.ts`
- Create: `server/src/routes/collections.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/LibraryPage.tsx` (collection sidebar)

- [ ] Backend: CRUD for collections, add/remove games
- [ ] Frontend: Collection groups in library sidebar
- [ ] Right-click game → "Koleksiyona Ekle" context menu
- [ ] Verify compilation

---

## Chunk 3: Faz 3 — İleri Özellikler

### Task 3.1: Shopping Cart

**Files:**
- Create: `server/src/services/cart.service.ts`
- Create: `server/src/routes/cart.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Create: `src/stores/cartStore.ts`
- Create: `src/pages/CartPage.tsx`
- Modify: `src/components/TopBar.tsx` (cart icon + badge)
- Modify: `src/pages/GameDetailPage.tsx` (add to cart button)

- [ ] Backend: cart CRUD, checkout (batch payment)
- [ ] Frontend: CartPage with item list, total, checkout flow
- [ ] Cart icon in TopBar with item count badge
- [ ] "Sepete Ekle" button on GameDetailPage alongside "Satın Al"
- [ ] Verify compilation

### Task 3.2: Friends System

**Files:**
- Create: `server/src/services/friendship.service.ts`
- Create: `server/src/routes/friends.ts`
- Modify: `server/src/app.ts`
- Modify: `src/lib/api.ts`
- Create: `src/pages/FriendsPage.tsx`
- Create: `src/components/FriendCard.tsx`
- Modify: `src/components/TopBar.tsx` (friends icon opens panel)

- [ ] Backend: send request, accept, reject, block, list friends, search users
- [ ] Frontend: FriendsPage with tabs (Friends, Pending, Blocked)
- [ ] Friend request notifications
- [ ] "Bu oyunu oynayan arkadaşlar" in LibraryPage uses real data
- [ ] Verify compilation

### Task 3.3: Two-Factor Authentication

**Files:**
- Modify: `server/src/services/auth.service.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `src/pages/SettingsPage.tsx` (2FA setup section)
- Create: `src/components/TwoFactorSetup.tsx`

- [ ] Backend: generate TOTP secret, verify code, enable/disable 2FA
- [ ] Frontend: QR code display, verification code input
- [ ] Login flow: if 2FA enabled, prompt for code after password
- [ ] Verify compilation

### Task 3.4: DLC Support

**Files:**
- Modify: `server/prisma/schema.prisma` (Game self-relation: parentGameId)
- Modify: `server/src/services/game.service.ts`
- Modify: `src/pages/GameDetailPage.tsx` (DLC section)
- Modify: `src/pages/LibraryPage.tsx` (DLC tab content)

- [ ] Schema: add parentGameId to Game model
- [ ] Backend: list DLCs for a game
- [ ] Frontend: DLC section on GameDetailPage
- [ ] Library DLC tab shows owned DLCs
- [ ] Verify compilation

---

## Chunk 4: Faz 4 — Topluluk Özellikleri

### Task 4.1: Chat System

- Real-time messaging between friends
- WebSocket or SSE for live updates
- Chat panel in sidebar or floating window

### Task 4.2: Community Hub

- Discussion forums per game
- User-generated guides
- Screenshot sharing

### Task 4.3: Workshop

- Mod upload/download system
- Mod ratings and comments
- Auto-install to game directory

### Task 4.4: Family Sharing

- Share library with family members
- Concurrent play restrictions
- Family group management

---

## Execution Order

1. **Faz 1** (Tasks 1.1-1.5): Pure frontend, ~2 hours
2. **Faz 2** (Tasks 2.1-2.11): Schema + backend + frontend, ~6 hours
3. **Faz 3** (Tasks 3.1-3.4): Advanced features, ~4 hours
4. **Faz 4** (Tasks 4.1-4.4): Community features, ~8 hours
