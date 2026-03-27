# Stealike: Hybrid Gaming Platform — Game Scanner & Local Library

> **Status:** Approved
> **Date:** 2026-03-27
> **Scope:** Phase 1 — Game Scanner, Local Library, Manual Game Addition, UI Integration

---

## 1. Vision

Stealike becomes a hybrid gaming platform:
- **Indie Store** — Small publishers sell their games (existing store/cart/wallet stays)
- **Local Library** — Users scan their PC for installed games (especially cracked/external) and manage them from one place
- **Social Layer** — Friends, reviews, collections work across both store and local games

Phase 2 (out of scope): Self-hosted multiplayer / PC hosting for online play.

---

## 2. Architecture: Tauri-First

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  (Library + Store + Social + Scanner UI)         │
├──────────────────────┬──────────────────────────┤
│   Tauri Commands     │     Fastify API           │
│   (invoke)           │     (fetch)               │
├──────────────────────┤──────────────────────────┤
│   Rust Backend       │     Node.js Server        │
│   - Disk Scanner     │     - Auth                │
│   - Registry Reader  │     - Friends             │
│   - Exe Launcher     │     - Indie Store         │
│   - Metadata Fetch   │     - Reviews/Ratings     │
│   - Local SQLite DB  │     - Cart/Wallet         │
│                      │     - Notifications       │
│   [OFFLINE OK]       │     [ONLINE REQUIRED]     │
└──────────────────────┴──────────────────────────┘
```

### Responsibility Split

- **Tauri/Rust** — Everything about the user's local machine: game scanning, .exe launching, local library (SQLite), metadata caching
- **Fastify/Server** — Social and commercial: auth, friends, indie store, payments, notifications
- **Frontend** — Merges both sources into a unified library experience. Local games via `invoke()`, store games via `fetch()`

### Why This Split

- **Privacy** — Cracked game lists never leave the user's machine
- **Offline** — Local library works without internet
- **Performance** — Rust handles CPU-intensive disk scanning efficiently
- **Clean boundaries** — Each layer has one job

---

## 3. Game Scanner System

### 3.1 Scan Flow

1. User clicks "Scan Games"
2. Options screen appears:
   - Checkbox: "Include Steam/Epic/Ubisoft games?" (default: unchecked)
   - Folder list: default paths + user can add custom paths
3. Rust backend runs parallel scan:
   - **Registry scan** — `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` + `HKCU\...` for installed programs
   - **File system scan** — Find `.exe` files in selected directories
   - **Launcher filter** — Detect and optionally exclude known launcher directories
4. Scan emits progress events (`scan-progress`) so frontend shows real-time feedback (scanned dirs, found games count)
5. Results returned to frontend as a list of discovered executables
6. User selects which games to add
7. For each selected game: attempt metadata fetch from RAWG API (free tier, 20k req/month), fallback to IGDB
8. If metadata not found, user enters manually
9. Save to local SQLite

### 3.2 Known Launcher Detection

| Launcher | Registry Key | Default Path |
|----------|-------------|--------------|
| Steam | `SteamPath` | `/steamapps/common/` |
| Epic Games | `Epic Games` | `/Epic Games/` |
| Ubisoft | `Ubisoft` | `/Ubisoft Game Launcher/` |
| GOG Galaxy | `GOG.com` | `/GOG Galaxy/Games/` |
| EA/Origin | `EA` | `/Origin Games/` |

Detection uses both registry entries and known directory patterns. When a user chooses to exclude a launcher, both the registry-detected and path-detected games from that launcher are filtered out.

### 3.3 Manual Game Addition

1. User clicks "Add Game Manually"
2. File picker dialog opens → select `.exe`
3. Game title extracted from filename (e.g., `Cyberpunk2077.exe` → "Cyberpunk 2077")
4. Automatic metadata search via RAWG/IGDB API using extracted title
5. If found: pre-fill cover image, description, genres
6. If not found: user fills in manually (title required, rest optional)
7. Save to local SQLite

### 3.4 Admin Permissions

- **No admin by default** — normal user permissions suffice for registry reads and most file system paths
- **Escalation on demand** — if a specific folder is inaccessible, show "Can't access this folder. Run as administrator?" prompt
- **Rationale** — requesting admin upfront creates distrust, especially in the cracked games community

---

## 4. Local SQLite Schema

```sql
-- Scanned/manually added games
CREATE TABLE games (
  id            TEXT PRIMARY KEY,  -- UUID
  title         TEXT NOT NULL,
  exe_path      TEXT NOT NULL,
  install_path  TEXT,
  source        TEXT NOT NULL,     -- 'scan', 'manual', 'store'
  launcher      TEXT,              -- 'steam', 'epic', 'ubisoft', 'gog', 'ea', 'none'
  cover_url     TEXT,
  description   TEXT,
  genres        TEXT,              -- JSON array (queried via json_each for filtering)
  added_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_played   DATETIME,
  play_time     INTEGER DEFAULT 0  -- seconds, updated by launch_game on exit
);

-- Scan configuration (singleton row — always id=1)
CREATE TABLE scan_config (
  id                INTEGER PRIMARY KEY DEFAULT 1,
  scan_paths        TEXT NOT NULL,     -- JSON array of directory paths
  exclude_launchers TEXT NOT NULL,     -- JSON array e.g. ['steam','epic','ubisoft']
  last_scan_at      DATETIME
);
```

**Note:** SQLite accessed via `rusqlite` crate (bundled). DB file stored at Tauri app data dir (`app.path().app_data_dir()`). Play time is updated by the existing `launch_game` process tracker when the game process exits — it writes the accumulated seconds to the `games.play_time` column.

---

## 5. Tauri Rust Commands

### 5.1 Dependencies

New crate required: `rusqlite` with `bundled` feature for local SQLite storage. Added to `src-tauri/Cargo.toml`:
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

### 5.2 Data Structures

```rust
struct GameMetadata {
    title: String,
    cover_url: Option<String>,
    description: Option<String>,
    genres: Option<Vec<String>>,  // stored as JSON in SQLite
}

struct ScannedGame {
    exe_path: String,
    suggested_title: String,      // extracted from filename
    install_path: String,         // parent directory of exe
    detected_launcher: Option<String>,  // 'steam', 'epic', etc.
}

struct Game {
    id: String,
    title: String,
    exe_path: String,
    install_path: Option<String>,
    source: String,               // 'scan', 'manual', 'store'
    launcher: Option<String>,
    cover_url: Option<String>,
    description: Option<String>,
    genres: Option<Vec<String>>,
    added_at: String,
    last_played: Option<String>,
    play_time: u64,               // seconds
}

struct ScanConfig {
    scan_paths: Vec<String>,
    exclude_launchers: Vec<String>,
    last_scan_at: Option<String>,
}
```

### 5.3 Commands

```rust
// Scanning — emits "scan-progress" events via AppHandle for UI feedback
#[tauri::command]
fn scan_games(app: AppHandle, paths: Vec<String>, exclude_launchers: Vec<String>) -> Result<Vec<ScannedGame>, String>
// Progress events: { scanned_dirs: u32, total_dirs: u32, found_games: u32 }

// Library management
#[tauri::command]
fn add_manual_game(exe_path: String, metadata: GameMetadata) -> Result<Game, String>

#[tauri::command]
fn get_local_games() -> Result<Vec<Game>, String>

#[tauri::command]
fn update_game(game_id: String, metadata: GameMetadata) -> Result<Game, String>

#[tauri::command]
fn delete_game(game_id: String) -> Result<(), String>

// Game launching — extends existing launcher.rs
// Already exists: launch_game(app, game_id, exe_path) with play-time tracking
// Change: after game exits, write accumulated play_time to SQLite games table
// The existing event-based tracking (game-status events) remains for UI updates
#[tauri::command]
fn launch_game(app: AppHandle, game_id: String, exe_path: String) -> Result<u32, String>

// Metadata — uses RAWG API (https://rawg.io/apidocs, free tier: 20k req/month)
// Fallback: IGDB API if RAWG returns no results
// API key stored in app config, not hardcoded
#[tauri::command]
fn fetch_metadata(game_title: String) -> Result<Option<GameMetadata>, String>

// Scan config
#[tauri::command]
fn get_scan_config() -> Result<ScanConfig, String>

#[tauri::command]
fn update_scan_config(config: ScanConfig) -> Result<(), String>
```

### 5.4 Tauri Capabilities

`src-tauri/capabilities/default.json` needs additional permissions:
- `fs:read` — for scanning game directories
- `dialog:open` — for folder/file picker in manual game addition
- `shell:open` — already present for launching games

---

## 6. Frontend Changes

### 6.1 New Pages

| Page | Purpose |
|------|---------|
| **GameScannerPage** | Scan trigger, options (launcher exclude, folder selection), results list with checkboxes, metadata preview/edit |

### 6.2 Modified Pages

| Page | Changes |
|------|---------|
| **LibraryPage** | Merges local SQLite games + server store games. Shows "source" badge (Scanned / Manual / Store). Adds "Scan Games" and "Add Game" buttons |
| **SettingsPage** | New section: scan paths management, launcher filter defaults |
| **GameDetailPage** | For local games: "Launch Game" button, play time tracking, edit metadata. For store games: existing behavior |

### 6.3 Library Merge Logic

```
Frontend LibraryPage:
  localGames  ← invoke('get_local_games')   // Tauri
  storeGames  ← fetch('/api/library')        // Fastify
  allGames    ← merge(localGames, storeGames)
  render with source badge per game
```

**Deduplication strategy:** Match by normalized title (lowercase, strip special chars). If a local game and a store game match:
- Show as a single entry with **both** source badges ("Store + Installed")
- Use store metadata (cover, description) as primary since it's curated
- Use local exe_path for the "Launch" button
- If titles don't match, show as separate entries — no automatic dedup by exe_path

---

## 7. Existing Pages — No Changes

All current pages are retained as-is:
- StorePage, CartPage, WishlistPage, WalletModal — Indie publisher store
- FriendsPage, CollectionsPage, ProfilePage — Social features
- LoginPage, RegisterPage, ForgotPasswordPage — Auth flow
- AchievementCard, ReviewCard, NotificationPanel — Supporting components

---

## 8. Out of Scope (Phase 2)

- Self-hosted multiplayer / PC hosting for online play
- Lobby system
- Game download/distribution for cracked games
- Cross-device library sync
