# P2P Multiplayer — Virtual LAN Gaming Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a P2P multiplayer system where Stealike creates virtual LAN connections (like Hamachi) so friends can play cracked games together — server only handles signaling, game traffic flows directly P2P.

**Architecture:** Fastify server gains WebSocket support (`@fastify/websocket`) for real-time room signaling and chat. Tauri/Rust backend gains WireGuard tunnel management (`boringtun` + `wintun`) to create virtual network adapters. React frontend gets a Multiplayer page, Room page, and a Zustand WebSocket store.

**Tech Stack:** Fastify + @fastify/websocket, Prisma 7 + PostgreSQL, boringtun + wintun (Rust), React 19 + Zustand, native WebSocket API

**Spec:** `docs/superpowers/specs/2026-03-30-p2p-multiplayer-design.md`

---

## File Structure

### Server (New Files)
| File | Responsibility |
|------|---------------|
| `server/src/ws/gateway.ts` | WebSocket upgrade handler, JWT auth, connection registry, heartbeat, message routing |
| `server/src/ws/handlers.ts` | Per-event handler functions (room:join, room:leave, peer:offer, etc.) |
| `server/src/services/room.service.ts` | Room CRUD, join/leave, ready toggle, virtual IP allocation |
| `server/src/services/hostingProfile.service.ts` | Hosting profile queries |
| `server/src/routes/rooms.ts` | REST endpoints for room listing/creation |
| `server/src/routes/hosting-profiles.ts` | REST endpoints for hosting profiles |

### Server (Modified Files)
| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | Add Room, RoomPlayer, RoomMessage, GameHostingProfile models + enums + reverse relations on User/Game |
| `server/src/app.ts` | Register WebSocket plugin + room routes + hosting-profile routes |
| `server/package.json` | Add `@fastify/websocket`, `nanoid` |

### Tauri/Rust (New Files)
| File | Responsibility |
|------|---------------|
| `src-tauri/src/commands/tunnel.rs` | WireGuard tunnel lifecycle: create, destroy, status, peer latency |
| `src-tauri/src/commands/server_manager.rs` | Dedicated server process spawning and monitoring |
| `src-tauri/src/tunnel/mod.rs` | WireGuard + WinTUN integration module |
| `src-tauri/src/tunnel/wg.rs` | boringtun wrapper: keypair generation, tunnel creation, packet handling |
| `src-tauri/src/tunnel/adapter.rs` | WinTUN adapter management: create/destroy virtual NIC, IP assignment |

### Tauri/Rust (Modified Files)
| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Register tunnel + server_manager commands, add tunnel module |
| `src-tauri/Cargo.toml` | Add `boringtun`, `wintun`, `x25519-dalek`, `base64` |

### Frontend (New Files)
| File | Responsibility |
|------|---------------|
| `src/stores/roomStore.ts` | Zustand store: WebSocket connection, room state, tunnel state, all actions |
| `src/pages/MultiplayerPage.tsx` | Main multiplayer hub: active rooms, friends hosting, create room |
| `src/pages/RoomPage.tsx` | Lobby UI: player list, chat, game info strip, action buttons |
| `src/components/CreateRoomModal.tsx` | Modal for room creation: game selector, name, port, host type |
| `src/lib/wsClient.ts` | Thin WebSocket wrapper: connect, reconnect with backoff, send typed messages |

### Frontend (Modified Files)
| File | Change |
|------|--------|
| `src/App.tsx` | Add `multiplayer` and `room` page routes, pass navigate |
| `src/components/TopBar.tsx` | Add "Multiplayer" nav item |
| `src/lib/api.ts` | Add `rooms` and `hostingProfiles` API namespaces |
| `src/lib/types.ts` | Add Room, RoomPlayer, RoomMessage, GameHostingProfile interfaces |
| `src/i18n/locales/en.json` | Add multiplayer.* and room.* keys |
| `src/i18n/locales/tr.json` | Add multiplayer.* and room.* keys |
| `src/i18n/locales/de.json` | Add multiplayer.* and room.* keys |
| `src/i18n/locales/es.json` | Add multiplayer.* and room.* keys |

---

## Chunk 1: Database Schema + Migration

### Task 1: Add Prisma models and enums

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add enums to schema.prisma**

Add after the existing enums (after `ProfileBlockType`):

```prisma
enum RoomVisibility {
  FRIENDS
  INVITE
  PUBLIC

  @@map("room_visibility")
}

enum RoomStatus {
  WAITING
  PLAYING
  CLOSED

  @@map("room_status")
}

enum HostType {
  LAN_HOST
  DEDICATED

  @@map("host_type")
}

enum PlayerStatus {
  CONNECTING
  CONNECTED
  READY
  DISCONNECTED

  @@map("player_status")
}

enum GameProtocol {
  TCP
  UDP
  BOTH

  @@map("game_protocol")
}
```

- [ ] **Step 2: Add Room model**

```prisma
model Room {
  id         String         @id @default(uuid()) @db.Uuid
  hostId     String         @map("host_id") @db.Uuid
  host       User           @relation("hostedRooms", fields: [hostId], references: [id])
  gameId     String?        @map("game_id") @db.Uuid
  game       Game?          @relation(fields: [gameId], references: [id])
  gameName   String         @map("game_name")
  name       String
  code       String         @unique
  visibility RoomVisibility @default(FRIENDS)
  status     RoomStatus     @default(WAITING)
  maxPlayers Int            @default(8) @map("max_players")
  hostType   HostType       @default(LAN_HOST) @map("host_type")
  port       Int?
  config     Json?
  createdAt  DateTime       @default(now()) @map("created_at")
  closedAt   DateTime?      @map("closed_at")

  players  RoomPlayer[]
  messages RoomMessage[]

  @@index([status, visibility])
  @@index([hostId])
  @@map("rooms")
}
```

- [ ] **Step 3: Add RoomPlayer model**

```prisma
model RoomPlayer {
  id        String       @id @default(uuid()) @db.Uuid
  roomId    String       @map("room_id") @db.Uuid
  room      Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String       @map("user_id") @db.Uuid
  user      User         @relation(fields: [userId], references: [id])
  virtualIp String       @map("virtual_ip")
  publicKey String       @map("public_key")
  status    PlayerStatus @default(CONNECTING)
  joinedAt  DateTime     @default(now()) @map("joined_at")

  @@unique([roomId, userId])
  @@index([roomId])
  @@map("room_players")
}
```

- [ ] **Step 4: Add RoomMessage model**

```prisma
model RoomMessage {
  id        String   @id @default(uuid()) @db.Uuid
  roomId    String   @map("room_id") @db.Uuid
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String?  @map("user_id") @db.Uuid
  user      User?    @relation(fields: [userId], references: [id])
  content   String
  isSystem  Boolean  @default(false) @map("is_system")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([roomId, createdAt])
  @@map("room_messages")
}
```

- [ ] **Step 5: Add GameHostingProfile model**

```prisma
model GameHostingProfile {
  id                String       @id @default(uuid()) @db.Uuid
  gameId            String?      @map("game_id") @db.Uuid
  game              Game?        @relation(fields: [gameId], references: [id])
  gameName          String       @map("game_name")
  port              Int
  protocol          GameProtocol @default(TCP)
  hostType          HostType     @default(LAN_HOST) @map("host_type")
  serverFileUrl     String?      @map("server_file_url")
  serverFileName    String?      @map("server_file_name")
  setupInstructions String?      @map("setup_instructions")
  isOfficial        Boolean      @default(false) @map("is_official")
  createdAt         DateTime     @default(now()) @map("created_at")

  @@index([gameId])
  @@map("game_hosting_profiles")
}
```

- [ ] **Step 6: Add reverse relations to User model**

Find the `User` model and add these relation fields:

```prisma
hostedRooms   Room[]        @relation("hostedRooms")
roomPlayers   RoomPlayer[]
roomMessages  RoomMessage[]
```

- [ ] **Step 7: Add reverse relations to Game model**

Find the `Game` model and add:

```prisma
rooms            Room[]
hostingProfiles  GameHostingProfile[]
```

- [ ] **Step 8: Run migration**

```bash
cd server
npx prisma migrate dev --name add_p2p_multiplayer
```

Expected: Migration created successfully, all models generated.

- [ ] **Step 9: Seed hosting profiles**

Add to `server/prisma/seed.ts` — a `seedHostingProfiles()` function that creates initial profiles:

```typescript
async function seedHostingProfiles() {
  const count = await prisma.gameHostingProfile.count();
  if (count > 0) return; // already seeded

  await prisma.gameHostingProfile.createMany({
    data: [
      { gameName: "Minecraft", port: 25565, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Oyun içinde 'Open to LAN' seçeneğini kullanın." },
      { gameName: "Terraria", port: 7777, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Host & Play ile sunucu açın." },
      { gameName: "Left 4 Dead 2", port: 27015, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Create Lobby ile oda oluşturun." },
      { gameName: "Counter-Strike 2", port: 27015, protocol: "UDP", hostType: "DEDICATED", isOfficial: true, serverFileName: "srcds.exe", setupInstructions: "SteamCMD ile dedicated server indirin." },
      { gameName: "Valheim", port: 2456, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Start Server ile sunucu açın." },
      { gameName: "Don't Starve Together", port: 10999, protocol: "UDP", hostType: "DEDICATED", isOfficial: true, setupInstructions: "Oyun içi Host Game seçeneğini kullanın." },
      { gameName: "Risk of Rain 2", port: 27015, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Multiplayer > Host ile oda oluşturun." },
      { gameName: "The Forest", port: 8766, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Multiplayer > Host seçeneğini kullanın." },
      { gameName: "Stardew Valley", port: 24642, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Co-op > Host Farm ile başlatın." },
      { gameName: "Among Us", port: 22023, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Local > Create Game ile oda oluşturun." },
    ],
  });
  console.log("Seeded 10 hosting profiles");
}
```

Call `seedHostingProfiles()` from the main seed function.

- [ ] **Step 10: Run seed**

```bash
cd server
npx tsx prisma/seed.ts
```

- [ ] **Step 11: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ server/prisma/seed.ts
git commit -m "feat(db): add P2P multiplayer models — Room, RoomPlayer, RoomMessage, GameHostingProfile"
```

---

## Chunk 2: Server — Room Service + REST Routes + Hosting Profiles

### Task 2: Install server dependencies

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install packages**

```bash
cd server
npm install @fastify/websocket nanoid
```

- [ ] **Step 2: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore(server): add @fastify/websocket and nanoid"
```

### Task 3: Room service

**Files:**
- Create: `server/src/services/room.service.ts`

- [ ] **Step 1: Create room service**

```typescript
import { prisma } from "../lib/prisma.js";
import { notFound, forbidden, conflict, badRequest } from "../lib/errors.js";
import { customAlphabet } from "nanoid";

const generateCode = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

export async function createRoom(
  hostId: string,
  data: {
    gameId?: string;
    gameName: string;
    name: string;
    maxPlayers?: number;
    hostType?: "LAN_HOST" | "DEDICATED";
    port?: number;
  }
) {
  // Rate limit: max 5 active rooms per user
  const activeCount = await prisma.room.count({
    where: { hostId, status: { in: ["WAITING", "PLAYING"] } },
  });
  if (activeCount >= 5) throw badRequest("Maximum 5 active rooms allowed");

  // Generate unique code with retry
  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    const exists = await prisma.room.findUnique({ where: { code } });
    if (!exists) break;
    attempts++;
  } while (attempts < 5);
  if (attempts >= 5) throw badRequest("Could not generate unique room code");

  const room = await prisma.room.create({
    data: {
      hostId,
      gameId: data.gameId || null,
      gameName: data.gameName,
      name: data.name,
      code,
      maxPlayers: data.maxPlayers || 8,
      hostType: data.hostType || "LAN_HOST",
      port: data.port || null,
    },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      game: { select: { id: true, title: true, slug: true, coverImageUrl: true } },
      players: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  // Auto-join host as first player
  await prisma.roomPlayer.create({
    data: {
      roomId: room.id,
      userId: hostId,
      virtualIp: "10.13.37.1",
      publicKey: "", // host sets this via WebSocket
      status: "CONNECTED",
    },
  });

  return room;
}

export async function listRooms(userId: string) {
  // Get friend IDs (excluding blocked)
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  const friendIds = friendships.map((f) =>
    f.senderId === userId ? f.receiverId : f.senderId
  );

  // Get blocked user IDs
  const blocked = await prisma.friendship.findMany({
    where: {
      status: "BLOCKED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });
  const blockedIds = blocked.map((b) =>
    b.senderId === userId ? b.receiverId : b.senderId
  );

  // Include own rooms + friends' rooms, exclude blocked users' rooms
  return prisma.room.findMany({
    where: {
      status: { in: ["WAITING", "PLAYING"] },
      hostId: { in: [userId, ...friendIds], notIn: blockedIds },
    },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      game: { select: { id: true, title: true, slug: true, coverImageUrl: true } },
      players: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRoomById(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      host: { select: { id: true, username: true, avatarUrl: true } },
      game: { select: { id: true, title: true, slug: true, coverImageUrl: true } },
      players: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!room) throw notFound("Room not found");
  return room;
}

export async function joinRoom(roomId: string, userId: string, publicKey: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.status === "CLOSED") throw badRequest("Room is closed");
  if (room.players.length >= room.maxPlayers) throw badRequest("Room is full");

  // Check if already in room
  const existing = room.players.find((p) => p.userId === userId);
  if (existing) return existing;

  // Check blocked user
  const isBlocked = await prisma.friendship.findFirst({
    where: {
      status: "BLOCKED",
      OR: [
        { senderId: room.hostId, receiverId: userId },
        { senderId: userId, receiverId: room.hostId },
      ],
    },
  });
  if (isBlocked) throw forbidden("Cannot join this room");

  // Assign next virtual IP
  const usedIps = room.players.map((p) => p.virtualIp);
  let nextOctet = 2;
  while (usedIps.includes(`10.13.37.${nextOctet}`) && nextOctet < 255) {
    nextOctet++;
  }
  if (nextOctet >= 255) throw badRequest("No available IP addresses");

  return prisma.roomPlayer.create({
    data: {
      roomId,
      userId,
      virtualIp: `10.13.37.${nextOctet}`,
      publicKey,
      status: "CONNECTING",
    },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });
}

export async function leaveRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, hostId: true },
  });
  if (!room) throw notFound("Room not found");

  // If host leaves, close the room
  if (room.hostId === userId) {
    await prisma.room.update({
      where: { id: roomId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    // Cascade will clean up players
    return { closed: true };
  }

  // Otherwise just remove the player
  await prisma.roomPlayer.deleteMany({
    where: { roomId, userId },
  });
  return { closed: false };
}

export async function kickPlayer(roomId: string, hostId: string, targetUserId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.hostId !== hostId) throw forbidden("Only host can kick players");

  await prisma.roomPlayer.deleteMany({
    where: { roomId, userId: targetUserId },
  });
}

export async function toggleReady(roomId: string, userId: string, ready: boolean) {
  await prisma.roomPlayer.updateMany({
    where: { roomId, userId },
    data: { status: ready ? "READY" : "CONNECTED" },
  });
}

export async function updatePlayerStatus(roomId: string, userId: string, status: "CONNECTING" | "CONNECTED" | "READY" | "DISCONNECTED") {
  await prisma.roomPlayer.updateMany({
    where: { roomId, userId },
    data: { status },
  });
}

export async function startGame(roomId: string, hostId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true, status: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.hostId !== hostId) throw forbidden("Only host can start the game");
  if (room.status !== "WAITING") throw badRequest("Game already started");

  return prisma.room.update({
    where: { id: roomId },
    data: { status: "PLAYING" },
  });
}

export async function closeRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.hostId !== userId) throw forbidden("Only host can close the room");

  return prisma.room.update({
    where: { id: roomId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

export async function addMessage(roomId: string, userId: string | null, content: string, isSystem = false) {
  return prisma.roomMessage.create({
    data: { roomId, userId, content, isSystem },
    include: {
      user: userId ? { select: { id: true, username: true } } : false,
    },
  });
}

export async function getMessages(roomId: string, limit = 100, before?: string) {
  return prisma.roomMessage.findMany({
    where: {
      roomId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Cleanup: mark stale WAITING rooms as closed (call on server startup)
// PLAYING rooms are left alone — gaming sessions can last hours
export async function cleanupStaleRooms() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const result = await prisma.room.updateMany({
    where: {
      status: "WAITING",
      createdAt: { lt: oneHourAgo },
    },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  if (result.count > 0) {
    console.log(`Cleaned up ${result.count} stale rooms`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/room.service.ts
git commit -m "feat(server): add room service — CRUD, join/leave, chat, IP allocation"
```

### Task 4: Hosting profile service

**Files:**
- Create: `server/src/services/hostingProfile.service.ts`

- [ ] **Step 1: Create hosting profile service**

```typescript
import { prisma } from "../lib/prisma.js";

export async function listProfiles(gameId?: string) {
  return prisma.gameHostingProfile.findMany({
    where: {
      isOfficial: true,
      ...(gameId ? { gameId } : {}),
    },
    include: {
      game: gameId ? { select: { id: true, title: true, slug: true } } : false,
    },
    orderBy: { gameName: "asc" },
  });
}

export async function getProfileById(id: string) {
  return prisma.gameHostingProfile.findUnique({
    where: { id },
    include: { game: { select: { id: true, title: true, slug: true } } },
  });
}

export async function getProfileByGameName(gameName: string) {
  return prisma.gameHostingProfile.findFirst({
    where: {
      gameName: { contains: gameName, mode: "insensitive" },
      isOfficial: true,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/hostingProfile.service.ts
git commit -m "feat(server): add hosting profile service"
```

### Task 5: REST routes for rooms and hosting profiles

**Files:**
- Create: `server/src/routes/rooms.ts`
- Create: `server/src/routes/hosting-profiles.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create rooms route**

```typescript
import type { FastifyInstance } from "fastify";
import * as roomService from "../services/room.service.js";

export default async function roomRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Create room
  app.post("/rooms", async (request, reply) => {
    const userId = request.user!.userId;
    const body = request.body as {
      gameId?: string;
      gameName: string;
      name: string;
      maxPlayers?: number;
      hostType?: "LAN_HOST" | "DEDICATED";
      port?: number;
    };
    const room = await roomService.createRoom(userId, body);
    return reply.status(201).send({ data: room });
  });

  // List rooms (own + friends')
  app.get("/rooms", async (request) => {
    const userId = request.user!.userId;
    const rooms = await roomService.listRooms(userId);
    return { data: rooms };
  });

  // Get room by ID
  app.get("/rooms/:id", async (request) => {
    const { id } = request.params as { id: string };
    const room = await roomService.getRoomById(id);
    return { data: room };
  });

  // Close room (host only)
  app.delete("/rooms/:id", async (request) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;
    await roomService.closeRoom(id, userId);
    return { data: { success: true } };
  });

  // Update room settings (host only)
  app.patch("/rooms/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;
    const body = request.body as { name?: string; maxPlayers?: number; port?: number };
    const room = await roomService.getRoomById(id);
    if (room.hostId !== userId) {
      return reply.status(403).send({ error: { message: "Only host can update room" } });
    }
    // Update via service layer — uses prisma internally
    const updated = await roomService.updateRoom(id, body);
    return { data: updated };
  });

  // Chat history
  app.get("/rooms/:id/messages", async (request) => {
    const { id } = request.params as { id: string };
    const { before } = request.query as { before?: string };
    const messages = await roomService.getMessages(id, 100, before);
    return { data: messages };
  });
}
```

- [ ] **Step 2: Create hosting profiles route**

```typescript
import type { FastifyInstance } from "fastify";
import * as profileService from "../services/hostingProfile.service.js";

export default async function hostingProfileRoutes(app: FastifyInstance) {
  // Public read access (no auth required)
  app.get("/hosting-profiles", async (request) => {
    const { gameId } = request.query as { gameId?: string };
    const profiles = await profileService.listProfiles(gameId);
    return { data: profiles };
  });
}
```

- [ ] **Step 3: Register routes in app.ts**

In `server/src/app.ts`, add imports and register:

```typescript
import roomRoutes from "./routes/rooms.js";
import hostingProfileRoutes from "./routes/hosting-profiles.js";

// In buildApp(), after existing route registrations:
await app.register(roomRoutes);
await app.register(hostingProfileRoutes);
```

- [ ] **Step 4: Call cleanupStaleRooms on server startup**

In `server/src/index.ts`, add after `app.listen`:

```typescript
import { cleanupStaleRooms } from "./services/room.service.js";

// After app.listen:
await cleanupStaleRooms();
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/rooms.ts server/src/routes/hosting-profiles.ts server/src/app.ts server/src/index.ts
git commit -m "feat(server): add REST routes for rooms and hosting profiles"
```

---

## Chunk 3: Server — WebSocket Gateway

### Task 6: WebSocket gateway

**Files:**
- Create: `server/src/ws/gateway.ts`
- Create: `server/src/ws/handlers.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create WebSocket gateway**

`server/src/ws/gateway.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { verifyToken } from "../lib/auth.js";

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  roomId: string | null;
  lastPong: number;
}

// Registry of connected clients
const clients = new Map<string, ConnectedClient>();

// Get all clients in a room
export function getRoomClients(roomId: string): ConnectedClient[] {
  return Array.from(clients.values()).filter((c) => c.roomId === roomId);
}

// Send to all clients in a room
export function broadcastToRoom(roomId: string, message: object, excludeUserId?: string) {
  const json = JSON.stringify(message);
  for (const client of getRoomClients(roomId)) {
    if (client.userId !== excludeUserId && client.ws.readyState === 1) {
      client.ws.send(json);
    }
  }
}

// Send to a specific user
export function sendToUser(userId: string, message: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

// Get client by userId
export function getClient(userId: string): ConnectedClient | undefined {
  return clients.get(userId);
}

// Set client's room
export function setClientRoom(userId: string, roomId: string | null) {
  const client = clients.get(userId);
  if (client) client.roomId = roomId;
}

export default async function wsGateway(app: FastifyInstance) {
  // Import handlers
  const { handleMessage } = await import("./handlers.js");

  app.get("/ws", { websocket: true }, async (socket, request) => {
    // Authenticate via query param
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let decoded: { userId: string; username: string };
    try {
      decoded = verifyToken(token) as any;
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    // Register client
    const client: ConnectedClient = {
      ws: socket,
      userId: decoded.userId,
      username: decoded.username,
      roomId: null,
      lastPong: Date.now(),
    };
    clients.set(decoded.userId, client);

    // Handle messages
    socket.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type && msg.payload) {
          await handleMessage(client, msg.type, msg.payload);
        }
      } catch (err) {
        socket.send(JSON.stringify({
          type: "error",
          payload: { message: (err as Error).message },
        }));
      }
    });

    // Handle pong
    socket.on("pong", () => {
      client.lastPong = Date.now();
    });

    // Handle disconnect
    socket.on("close", async () => {
      clients.delete(decoded.userId);
      // If in a room, handle leave
      if (client.roomId) {
        try {
          const { handleMessage: h } = await import("./handlers.js");
          await h(client, "room:leave", { roomId: client.roomId });
        } catch { /* room may already be closed */ }
      }
    });
  });

  // Heartbeat interval: ping every 30s
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, client] of clients) {
      if (now - client.lastPong > 40000) {
        // No pong for 40s — disconnect
        client.ws.close(4002, "Heartbeat timeout");
        clients.delete(userId);
      } else {
        client.ws.ping();
      }
    }
  }, 30000);

  // Cleanup on server close
  app.addHook("onClose", () => {
    clearInterval(heartbeatInterval);
  });
}
```

- [ ] **Step 2: Create WebSocket handlers**

`server/src/ws/handlers.ts`:

```typescript
import * as roomService from "../services/room.service.js";
import {
  broadcastToRoom,
  sendToUser,
  setClientRoom,
  getRoomClients,
} from "./gateway.js";

interface Client {
  userId: string;
  username: string;
  roomId: string | null;
}

export async function handleMessage(client: Client, type: string, payload: any) {
  switch (type) {
    case "room:join":
      return handleJoin(client, payload);
    case "room:leave":
      return handleLeave(client, payload);
    case "room:ready":
      return handleReady(client, payload);
    case "room:send-message":
      return handleSendMessage(client, payload);
    case "room:start-game":
      return handleStartGame(client, payload);
    case "room:kick":
      return handleKick(client, payload);
    case "peer:offer":
      return handlePeerOffer(client, payload);
    case "peer:answer":
      return handlePeerAnswer(client, payload);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

async function handleJoin(client: Client, payload: { roomId: string; publicKey: string }) {
  const player = await roomService.joinRoom(payload.roomId, client.userId, payload.publicKey);
  setClientRoom(client.userId, payload.roomId);

  // Notify others in room
  broadcastToRoom(payload.roomId, {
    type: "room:player-joined",
    payload: {
      userId: player.userId,
      username: player.user.username,
      avatarUrl: player.user.avatarUrl,
      virtualIp: player.virtualIp,
      publicKey: payload.publicKey,
    },
  }, client.userId);

  // Send existing players to the joiner
  const room = await roomService.getRoomById(payload.roomId);
  sendToUser(client.userId, {
    type: "room:state",
    payload: room,
  });

  // System message — use key format so client can translate
  await roomService.addMessage(payload.roomId, null, `player_joined:${client.username}`, true);
}

async function handleLeave(client: Client, payload: { roomId: string }) {
  const result = await roomService.leaveRoom(payload.roomId, client.userId);
  setClientRoom(client.userId, null);

  if (result.closed) {
    broadcastToRoom(payload.roomId, {
      type: "room:closed",
      payload: { reason: "host-left" },
    });
  } else {
    broadcastToRoom(payload.roomId, {
      type: "room:player-left",
      payload: { userId: client.userId, reason: "left" },
    });
    await roomService.addMessage(payload.roomId, null, `player_left:${client.username}`, true);
  }
}

async function handleReady(client: Client, payload: { roomId: string; ready: boolean }) {
  await roomService.toggleReady(payload.roomId, client.userId, payload.ready);
  broadcastToRoom(payload.roomId, {
    type: "room:player-ready",
    payload: { userId: client.userId, ready: payload.ready },
  });
}

async function handleSendMessage(client: Client, payload: { roomId: string; content: string }) {
  if (!payload.content.trim()) return;
  const msg = await roomService.addMessage(payload.roomId, client.userId, payload.content.trim());
  broadcastToRoom(payload.roomId, {
    type: "room:message",
    payload: {
      id: msg.id,
      userId: client.userId,
      username: client.username,
      content: msg.content,
      isSystem: false,
      createdAt: msg.createdAt.toISOString(),
    },
  });
}

async function handleStartGame(client: Client, payload: { roomId: string }) {
  const room = await roomService.startGame(payload.roomId, client.userId);
  broadcastToRoom(payload.roomId, {
    type: "room:game-starting",
    payload: {
      hostType: room.hostType,
      port: room.port,
      hostVirtualIp: "10.13.37.1",
    },
  });
}

async function handleKick(client: Client, payload: { roomId: string; userId: string }) {
  await roomService.kickPlayer(payload.roomId, client.userId, payload.userId);

  // Notify kicked user
  sendToUser(payload.userId, {
    type: "room:player-left",
    payload: { userId: payload.userId, reason: "kicked" },
  });

  // Notify room
  broadcastToRoom(payload.roomId, {
    type: "room:player-left",
    payload: { userId: payload.userId, reason: "kicked" },
  }, payload.userId);

  // Update kicked user's client room
  setClientRoom(payload.userId, null);
}

async function handlePeerOffer(client: Client, payload: { roomId: string; targetUserId: string; publicKey: string; endpoint: string }) {
  sendToUser(payload.targetUserId, {
    type: "peer:signal",
    payload: {
      fromUserId: client.userId,
      publicKey: payload.publicKey,
      endpoint: payload.endpoint,
    },
  });
}

async function handlePeerAnswer(client: Client, payload: { roomId: string; targetUserId: string; publicKey: string; endpoint: string }) {
  sendToUser(payload.targetUserId, {
    type: "peer:signal",
    payload: {
      fromUserId: client.userId,
      publicKey: payload.publicKey,
      endpoint: payload.endpoint,
    },
  });
}
```

- [ ] **Step 3: Verify auth token verification function**

Check `server/src/lib/auth.ts` (or wherever JWT verification is) and see what function to import. The gateway needs a function that takes a JWT string and returns `{ userId, username }`. If the existing auth plugin only works as Fastify decorator, extract the verify logic into a standalone function.

Look at the existing `authPlugin` in `server/src/plugins/auth.ts` or similar — find the `jwt.verify()` call and expose it. You may need to create:

```typescript
// server/src/lib/auth.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
}
```

If this already exists, just import it. If not, create it and also refactor the authPlugin to use it.

- [ ] **Step 4: Register WebSocket in app.ts**

In `server/src/app.ts`:

```typescript
import websocket from "@fastify/websocket";
import wsGateway from "./ws/gateway.js";

// In buildApp(), BEFORE route registrations:
await app.register(websocket);
await app.register(wsGateway);
```

- [ ] **Step 5: Commit**

```bash
git add server/src/ws/gateway.ts server/src/ws/handlers.ts server/src/app.ts
git commit -m "feat(server): add WebSocket gateway with room signaling and chat"
```

---

## Chunk 4: Rust — WireGuard Tunnel Manager

### Task 7: Add Rust dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add dependencies to Cargo.toml**

Add under `[dependencies]`:

```toml
boringtun = "0.5"
wintun = "0.5"
x25519-dalek = { version = "2", features = ["static_secrets"] }
base64 = "0.22"
lazy_static = "1"
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri
cargo check
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore(tauri): add WireGuard tunnel dependencies"
```

### Task 8: WireGuard tunnel module

**Files:**
- Create: `src-tauri/src/tunnel/mod.rs`
- Create: `src-tauri/src/tunnel/wg.rs`
- Create: `src-tauri/src/tunnel/adapter.rs`

- [ ] **Step 1: Create tunnel module**

`src-tauri/src/tunnel/mod.rs`:

```rust
pub mod wg;
pub mod adapter;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfig {
    pub public_key: String,
    pub endpoint: String, // "ip:port"
    pub virtual_ip: String, // "10.13.37.x"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInfo {
    pub room_id: String,
    pub virtual_ip: String,
    pub private_key: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStatus {
    pub active: bool,
    pub virtual_ip: String,
    pub peer_count: usize,
    pub bytes_sent: u64,
    pub bytes_received: u64,
}

// Global tunnel registry
lazy_static::lazy_static! {
    static ref TUNNELS: Mutex<HashMap<String, TunnelInfo>> = Mutex::new(HashMap::new());
}

pub fn register_tunnel(room_id: &str, info: TunnelInfo) {
    TUNNELS.lock().unwrap().insert(room_id.to_string(), info);
}

pub fn unregister_tunnel(room_id: &str) {
    TUNNELS.lock().unwrap().remove(room_id);
}

pub fn get_tunnel(room_id: &str) -> Option<TunnelInfo> {
    TUNNELS.lock().unwrap().get(room_id).cloned()
}
```

Note: Add `lazy_static = "1"` to `Cargo.toml` as well.

- [ ] **Step 2: Create WireGuard key generation wrapper**

`src-tauri/src/tunnel/wg.rs`:

```rust
use base64::{engine::general_purpose::STANDARD, Engine};
use x25519_dalek::{PublicKey, StaticSecret};

pub struct KeyPair {
    pub private_key: String, // base64
    pub public_key: String,  // base64
}

pub fn generate_keypair() -> KeyPair {
    let secret = StaticSecret::random();
    let public = PublicKey::from(&secret);

    KeyPair {
        private_key: STANDARD.encode(secret.as_bytes()),
        public_key: STANDARD.encode(public.as_bytes()),
    }
}

// For Phase 1: we generate keys and exchange them via signaling
// The actual WireGuard tunnel creation using boringtun + wintun
// happens in adapter.rs
```

- [ ] **Step 3: Create virtual adapter module (Phase 1 scaffold)**

`src-tauri/src/tunnel/adapter.rs`:

```rust
use super::{PeerConfig, TunnelInfo, TunnelStatus};

/// Create a WireGuard tunnel with WinTUN virtual adapter.
///
/// Phase 1 implementation: Creates the virtual adapter, assigns IP,
/// and establishes WireGuard tunnel to peers.
///
/// This is the most complex part — requires:
/// 1. Loading wintun.dll
/// 2. Creating a virtual network adapter
/// 3. Assigning 10.13.37.x IP to the adapter
/// 4. Setting up boringtun WireGuard tunnel
/// 5. Routing packets between the virtual adapter and UDP socket
pub async fn create_adapter(
    room_id: &str,
    virtual_ip: &str,
    private_key: &str,
    peers: &[PeerConfig],
) -> Result<TunnelInfo, String> {
    // Step 1: Check/load wintun.dll
    let dll_path = get_wintun_dll_path()?;

    // Step 2: Create WinTUN adapter
    let wintun = unsafe {
        wintun::load_from_path(&dll_path)
            .map_err(|e| format!("WinTUN yüklenemedi: {}. Antivirüs engelliyor olabilir.", e))?
    };

    let adapter = wintun::Adapter::create(&wintun, "Stealike", &format!("stealike-{}", &room_id[..8]), None)
        .map_err(|e| format!("Ağ adaptörü oluşturulamadı: {}", e))?;

    // Step 3: Assign IP address
    // On Windows, use netsh to assign IP
    let output = std::process::Command::new("netsh")
        .args([
            "interface", "ip", "set", "address",
            &format!("stealike-{}", &room_id[..8]),
            "static", virtual_ip, "255.255.255.0",
        ])
        .output()
        .map_err(|e| format!("IP atanamadı: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "IP atanamadı: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Step 4: Start WireGuard tunnel session
    let session = adapter.start_session(0x20000) // 128KB ring buffer
        .map_err(|e| format!("Tunnel oturumu başlatılamadı: {}", e))?;

    // Step 5: Start packet routing in background
    // For each peer, create a UDP socket and use boringtun to
    // encrypt/decrypt packets between the virtual adapter and the socket
    let keypair = super::wg::generate_keypair();

    // Store tunnel info
    let info = TunnelInfo {
        room_id: room_id.to_string(),
        virtual_ip: virtual_ip.to_string(),
        private_key: keypair.private_key.clone(),
        public_key: keypair.public_key.clone(),
    };
    super::register_tunnel(room_id, info.clone());

    // Phase 1 scaffold: adapter and IP assignment are functional.
    // The packet routing loop (virtual adapter <-> boringtun <-> UDP socket)
    // will be iterated on after verifying the signaling + UI flow works end-to-end.
    // For Phase 1 testing, peers can verify adapter creation and IP assignment.

    Ok(info)
}

pub async fn destroy_adapter(room_id: &str) -> Result<(), String> {
    super::unregister_tunnel(room_id);

    // The WinTUN adapter is dropped when the Adapter goes out of scope
    // For proper cleanup, we'd store the adapter handle in the tunnel registry
    // and drop it here. For now, the adapter is cleaned up on process exit.

    // Remove IP route
    let adapter_name = format!("stealike-{}", &room_id[..8]);
    let _ = std::process::Command::new("netsh")
        .args(["interface", "ip", "delete", "address", &adapter_name, "addr=10.13.37.0"])
        .output();

    Ok(())
}

pub fn get_status(room_id: &str) -> Result<TunnelStatus, String> {
    match super::get_tunnel(room_id) {
        Some(info) => Ok(TunnelStatus {
            active: true,
            virtual_ip: info.virtual_ip,
            peer_count: 0, // TODO: track actual peers
            bytes_sent: 0,
            bytes_received: 0,
        }),
        None => Ok(TunnelStatus {
            active: false,
            virtual_ip: String::new(),
            peer_count: 0,
            bytes_sent: 0,
            bytes_received: 0,
        }),
    }
}

fn get_wintun_dll_path() -> Result<std::path::PathBuf, String> {
    // Check app directory first
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Uygulama dizini bulunamadı: {}", e))?
        .parent()
        .ok_or("Uygulama dizini bulunamadı")?
        .to_path_buf();

    let dll_path = exe_dir.join("wintun.dll");
    if dll_path.exists() {
        return Ok(dll_path);
    }

    Err("Sanal ağ adaptörü (wintun.dll) bulunamadı. Lütfen wintun.dll dosyasını uygulama dizinine koyun.".to_string())
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/tunnel/
git commit -m "feat(tauri): add WireGuard tunnel module — keypair gen, adapter scaffold"
```

### Task 9: Tunnel Tauri commands

**Files:**
- Create: `src-tauri/src/commands/tunnel.rs`
- Create: `src-tauri/src/commands/server_manager.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create tunnel commands**

`src-tauri/src/commands/tunnel.rs`:

```rust
use crate::tunnel::{self, PeerConfig, TunnelInfo, TunnelStatus};
use crate::tunnel::wg;

#[tauri::command]
pub async fn generate_keypair() -> Result<(String, String), String> {
    let kp = wg::generate_keypair();
    Ok((kp.private_key, kp.public_key))
}

#[tauri::command]
pub async fn create_tunnel(
    room_id: String,
    virtual_ip: String,
    private_key: String,
    peers: Vec<PeerConfig>,
) -> Result<TunnelInfo, String> {
    tunnel::adapter::create_adapter(&room_id, &virtual_ip, &private_key, &peers).await
}

#[tauri::command]
pub async fn destroy_tunnel(room_id: String) -> Result<(), String> {
    tunnel::adapter::destroy_adapter(&room_id).await
}

#[tauri::command]
pub async fn get_tunnel_status(room_id: String) -> Result<TunnelStatus, String> {
    tunnel::adapter::get_status(&room_id)
}
```

- [ ] **Step 2: Create server manager commands**

`src-tauri/src/commands/server_manager.rs`:

```rust
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub process_id: u32,
    pub running: bool,
}

#[tauri::command]
pub async fn start_dedicated_server(
    app: AppHandle,
    game_id: String,
    exe_path: String,
    args: Vec<String>,
    port: u16,
) -> Result<u32, String> {
    let child = tokio::process::Command::new(&exe_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Sunucu başlatılamadı: {}", e))?;

    let pid = child.id().ok_or("Process ID alınamadı")?;
    let app_clone = app.clone();
    let game_id_clone = game_id.clone();

    // Monitor process in background
    tokio::spawn(async move {
        let mut child = child;
        let _ = child.wait().await;
        let _ = app_clone.emit("server-status", serde_json::json!({
            "gameId": game_id_clone,
            "processId": pid,
            "status": "stopped",
        }));
    });

    Ok(pid)
}

#[tauri::command]
pub async fn stop_dedicated_server(process_id: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("taskkill")
            .args(["/PID", &process_id.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Sunucu durdurulamadı: {}", e))?;
    }
    Ok(())
}
```

- [ ] **Step 3: Register commands in lib.rs**

Add to `src-tauri/src/lib.rs`:

```rust
mod tunnel;

// In the invoke_handler! macro, add:
commands::tunnel::generate_keypair,
commands::tunnel::create_tunnel,
commands::tunnel::destroy_tunnel,
commands::tunnel::get_tunnel_status,
commands::server_manager::start_dedicated_server,
commands::server_manager::stop_dedicated_server,
```

Also add `mod commands::tunnel;` and `mod commands::server_manager;` if the module system requires it (check existing pattern — if commands are `pub mod` in a `commands/mod.rs`, add entries there).

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri
cargo check
```

Fix any compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/tunnel.rs src-tauri/src/commands/server_manager.rs src-tauri/src/tunnel/ src-tauri/src/lib.rs
git commit -m "feat(tauri): add tunnel and server manager commands"
```

---

## Chunk 5: Frontend — Types, API, i18n, WebSocket Store

### Task 10: Add TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add types to types.ts**

```typescript
export interface Room {
  id: string;
  hostId: string;
  host: { id: string; username: string; avatarUrl?: string };
  gameId?: string;
  game?: { id: string; title: string; slug: string; coverImageUrl: string };
  gameName: string;
  name: string;
  code: string;
  visibility: "FRIENDS" | "INVITE" | "PUBLIC";
  status: "WAITING" | "PLAYING" | "CLOSED";
  maxPlayers: number;
  hostType: "LAN_HOST" | "DEDICATED";
  port?: number;
  config?: Record<string, any>;
  createdAt: string;
  closedAt?: string;
  players: RoomPlayer[];
}

export interface RoomPlayer {
  id: string;
  userId: string;
  user: { id: string; username: string; avatarUrl?: string };
  virtualIp: string;
  publicKey: string;
  status: "CONNECTING" | "CONNECTED" | "READY" | "DISCONNECTED";
  joinedAt: string;
}

export interface RoomMessage {
  id: string;
  userId?: string;
  username?: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
}

export interface GameHostingProfile {
  id: string;
  gameId?: string;
  gameName: string;
  port: number;
  protocol: "TCP" | "UDP" | "BOTH";
  hostType: "LAN_HOST" | "DEDICATED";
  serverFileUrl?: string;
  serverFileName?: string;
  setupInstructions?: string;
  isOfficial: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(frontend): add P2P multiplayer TypeScript types"
```

### Task 11: Add API endpoints

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add rooms and hostingProfiles namespaces**

```typescript
rooms: {
  list: () => request<Room[]>("/rooms"),
  getById: (id: string) => request<Room>(`/rooms/${id}`),
  create: (data: {
    gameId?: string;
    gameName: string;
    name: string;
    maxPlayers?: number;
    hostType?: string;
    port?: number;
  }) => request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),
  close: (id: string) => request<void>(`/rooms/${id}`, { method: "DELETE" }),
  getMessages: (id: string, before?: string) => {
    const params = before ? `?before=${before}` : "";
    return request<RoomMessage[]>(`/rooms/${id}/messages${params}`);
  },
},
hostingProfiles: {
  list: (gameId?: string) => {
    const params = gameId ? `?gameId=${gameId}` : "";
    return request<GameHostingProfile[]>(`/hosting-profiles${params}`);
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(frontend): add rooms and hosting profiles API client"
```

### Task 12: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`

- [ ] **Step 1: Add English keys**

Add to `en.json`:

```json
"multiplayer": {
  "title": "Multiplayer",
  "createRoom": "Create Room",
  "joinRoom": "Join",
  "friendsHosting": "Friends Hosting",
  "myRooms": "My Rooms",
  "noRooms": "No active rooms",
  "noFriendsHosting": "No friends hosting right now",
  "roomName": "Room Name",
  "selectGame": "Select Game",
  "gameName": "Game Name",
  "maxPlayers": "Max Players",
  "port": "Port",
  "hostType": "Host Type",
  "create": "Create"
},
"room": {
  "players": "Players",
  "chat": "Chat",
  "startGame": "Start Game",
  "ready": "Ready",
  "notReady": "Not Ready",
  "leave": "Leave Room",
  "sendMessage": "Send",
  "messagePlaceholder": "Type a message...",
  "host": "Host",
  "connecting": "Connecting...",
  "connected": "Connected",
  "disconnected": "Disconnected",
  "emptySlot": "Empty slot",
  "gameStarting": "Game is starting!",
  "roomClosed": "Room has been closed",
  "kicked": "You have been kicked from the room",
  "visibility": {
    "friends": "Friends Only"
  },
  "hostType": {
    "lan": "LAN Host",
    "dedicated": "Dedicated Server"
  },
  "createdAgo": "Created {{time}} ago",
  "playerCount": "{{current}} / {{max}} players",
  "inviteLink": "Invite Link",
  "settings": "Settings",
  "kick": "Kick"
}
```

- [ ] **Step 2: Add Turkish keys**

Add to `tr.json`:

```json
"multiplayer": {
  "title": "Çok Oyunculu",
  "createRoom": "Oda Oluştur",
  "joinRoom": "Katıl",
  "friendsHosting": "Arkadaşların Oynuyor",
  "myRooms": "Odalarım",
  "noRooms": "Aktif oda yok",
  "noFriendsHosting": "Şu an oynayan arkadaşın yok",
  "roomName": "Oda Adı",
  "selectGame": "Oyun Seç",
  "gameName": "Oyun Adı",
  "maxPlayers": "Maksimum Oyuncu",
  "port": "Port",
  "hostType": "Sunucu Türü",
  "create": "Oluştur"
},
"room": {
  "players": "Oyuncular",
  "chat": "Sohbet",
  "startGame": "Oyunu Başlat",
  "ready": "Hazırım",
  "notReady": "Hazır Değilim",
  "leave": "Odadan Ayrıl",
  "sendMessage": "Gönder",
  "messagePlaceholder": "Mesaj yaz...",
  "host": "Host",
  "connecting": "Bağlanıyor...",
  "connected": "Bağlandı",
  "disconnected": "Bağlantı Kesildi",
  "emptySlot": "Boş slot",
  "gameStarting": "Oyun başlıyor!",
  "roomClosed": "Oda kapatıldı",
  "kicked": "Odadan atıldınız",
  "visibility": {
    "friends": "Arkadaşlara Özel"
  },
  "hostType": {
    "lan": "LAN Host",
    "dedicated": "Özel Sunucu"
  },
  "createdAgo": "{{time}} önce oluşturuldu",
  "playerCount": "{{current}} / {{max}} oyuncu",
  "inviteLink": "Davet Linki",
  "settings": "Ayarlar",
  "kick": "At"
}
```

- [ ] **Step 3: Add German keys**

Add to `de.json`:

```json
"multiplayer": {
  "title": "Mehrspieler",
  "createRoom": "Raum erstellen",
  "joinRoom": "Beitreten",
  "friendsHosting": "Freunde hosten",
  "myRooms": "Meine Räume",
  "noRooms": "Keine aktiven Räume",
  "noFriendsHosting": "Keine Freunde hosten gerade",
  "roomName": "Raumname",
  "selectGame": "Spiel auswählen",
  "gameName": "Spielname",
  "maxPlayers": "Max. Spieler",
  "port": "Port",
  "hostType": "Host-Typ",
  "create": "Erstellen"
},
"room": {
  "players": "Spieler",
  "chat": "Chat",
  "startGame": "Spiel starten",
  "ready": "Bereit",
  "notReady": "Nicht bereit",
  "leave": "Raum verlassen",
  "sendMessage": "Senden",
  "messagePlaceholder": "Nachricht eingeben...",
  "host": "Host",
  "connecting": "Verbinden...",
  "connected": "Verbunden",
  "disconnected": "Getrennt",
  "emptySlot": "Leerer Platz",
  "gameStarting": "Spiel startet!",
  "roomClosed": "Raum wurde geschlossen",
  "kicked": "Du wurdest aus dem Raum entfernt",
  "visibility": {
    "friends": "Nur Freunde"
  },
  "hostType": {
    "lan": "LAN Host",
    "dedicated": "Dedizierter Server"
  },
  "createdAgo": "Vor {{time}} erstellt",
  "playerCount": "{{current}} / {{max}} Spieler",
  "inviteLink": "Einladungslink",
  "settings": "Einstellungen",
  "kick": "Kicken"
}
```

- [ ] **Step 4: Add Spanish keys**

Add to `es.json`:

```json
"multiplayer": {
  "title": "Multijugador",
  "createRoom": "Crear Sala",
  "joinRoom": "Unirse",
  "friendsHosting": "Amigos Jugando",
  "myRooms": "Mis Salas",
  "noRooms": "No hay salas activas",
  "noFriendsHosting": "Ningún amigo está jugando ahora",
  "roomName": "Nombre de Sala",
  "selectGame": "Seleccionar Juego",
  "gameName": "Nombre del Juego",
  "maxPlayers": "Máx. Jugadores",
  "port": "Puerto",
  "hostType": "Tipo de Host",
  "create": "Crear"
},
"room": {
  "players": "Jugadores",
  "chat": "Chat",
  "startGame": "Iniciar Juego",
  "ready": "Listo",
  "notReady": "No Listo",
  "leave": "Salir de la Sala",
  "sendMessage": "Enviar",
  "messagePlaceholder": "Escribe un mensaje...",
  "host": "Host",
  "connecting": "Conectando...",
  "connected": "Conectado",
  "disconnected": "Desconectado",
  "emptySlot": "Espacio vacío",
  "gameStarting": "¡El juego está comenzando!",
  "roomClosed": "La sala ha sido cerrada",
  "kicked": "Has sido expulsado de la sala",
  "visibility": {
    "friends": "Solo Amigos"
  },
  "hostType": {
    "lan": "LAN Host",
    "dedicated": "Servidor Dedicado"
  },
  "createdAgo": "Creada hace {{time}}",
  "playerCount": "{{current}} / {{max}} jugadores",
  "inviteLink": "Enlace de Invitación",
  "settings": "Configuración",
  "kick": "Expulsar"
}
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add multiplayer and room keys in 4 languages"
```

### Task 13: WebSocket client wrapper

**Files:**
- Create: `src/lib/wsClient.ts`

- [ ] **Step 1: Create WebSocket wrapper**

```typescript
type MessageHandler = (type: string, payload: any) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private onMessage: MessageHandler;
  private onStatusChange: (connected: boolean) => void;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    token: string,
    onMessage: MessageHandler,
    onStatusChange: (connected: boolean) => void
  ) {
    this.url = `ws://localhost:3001/ws?token=${token}`;
    this.token = token;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStatusChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type && msg.payload !== undefined) {
            this.onMessage(msg.type, msg.payload);
          }
        } catch { /* ignore malformed messages */ }
      };

      this.ws.onclose = () => {
        this.onStatusChange(false);
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  send(type: string, payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/wsClient.ts
git commit -m "feat(frontend): add WebSocket client wrapper with auto-reconnect"
```

### Task 14: Room Zustand store

**Files:**
- Create: `src/stores/roomStore.ts`

- [ ] **Step 1: Create room store**

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { WsClient } from "../lib/wsClient";
import { api } from "../lib/api";
import type { Room, RoomPlayer, RoomMessage } from "../lib/types";

interface RoomState {
  // Connection
  wsConnected: boolean;
  wsClient: WsClient | null;

  // Room state
  currentRoom: Room | null;
  rooms: Room[]; // listing
  messages: RoomMessage[];

  // Tunnel
  tunnelActive: boolean;
  virtualIp: string | null;
  publicKey: string | null;
  privateKey: string | null;

  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  fetchRooms: () => Promise<void>;
  createRoom: (data: {
    gameId?: string;
    gameName: string;
    name: string;
    maxPlayers?: number;
    hostType?: string;
    port?: number;
  }) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (content: string) => void;
  toggleReady: (ready: boolean) => void;
  startGame: () => void;
  kickPlayer: (userId: string) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  wsConnected: false,
  wsClient: null,
  currentRoom: null,
  rooms: [],
  messages: [],
  tunnelActive: false,
  virtualIp: null,
  publicKey: null,
  privateKey: null,

  connect: (token: string) => {
    const existing = get().wsClient;
    if (existing) existing.disconnect();

    const client = new WsClient(
      token,
      (type, payload) => handleWsMessage(type, payload, set, get),
      (connected) => set({ wsConnected: connected })
    );
    client.connect();
    set({ wsClient: client });
  },

  disconnect: () => {
    const { wsClient, currentRoom } = get();
    if (wsClient) {
      wsClient.disconnect();
      set({ wsClient: null, wsConnected: false });
    }
    if (currentRoom) {
      // Destroy tunnel
      invoke("destroy_tunnel", { roomId: currentRoom.id }).catch(() => {});
      set({ currentRoom: null, messages: [], tunnelActive: false, virtualIp: null });
    }
  },

  fetchRooms: async () => {
    const rooms = await api.rooms.list();
    set({ rooms });
  },

  createRoom: async (data) => {
    const room = await api.rooms.create(data);

    // Generate keypair for tunnel
    const [privateKey, publicKey] = await invoke<[string, string]>("generate_keypair");

    set({
      currentRoom: room,
      messages: [],
      publicKey,
      privateKey,
      virtualIp: "10.13.37.1", // host always gets .1
    });

    // Join via WebSocket
    const { wsClient } = get();
    wsClient?.send("room:join", { roomId: room.id, publicKey });

    return room;
  },

  joinRoom: async (roomId: string) => {
    // Generate keypair
    const [privateKey, publicKey] = await invoke<[string, string]>("generate_keypair");
    set({ publicKey, privateKey });

    // Join via WebSocket — server will respond with room:state
    const { wsClient } = get();
    wsClient?.send("room:join", { roomId, publicKey });
  },

  leaveRoom: () => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:leave", { roomId: currentRoom.id });
      invoke("destroy_tunnel", { roomId: currentRoom.id }).catch(() => {});
      set({ currentRoom: null, messages: [], tunnelActive: false, virtualIp: null });
    }
  },

  sendMessage: (content: string) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:send-message", { roomId: currentRoom.id, content });
    }
  },

  toggleReady: (ready: boolean) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:ready", { roomId: currentRoom.id, ready });
    }
  },

  startGame: () => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:start-game", { roomId: currentRoom.id });
    }
  },

  kickPlayer: (userId: string) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:kick", { roomId: currentRoom.id, userId });
    }
  },
}));

// Handle incoming WebSocket messages
function handleWsMessage(
  type: string,
  payload: any,
  set: any,
  get: () => RoomState
) {
  switch (type) {
    case "room:state":
      set({
        currentRoom: payload,
        messages: [],
      });
      // Find our player entry to get virtualIp
      const myPlayer = payload.players?.find(
        (p: RoomPlayer) => p.publicKey === get().publicKey
      );
      if (myPlayer) {
        set({ virtualIp: myPlayer.virtualIp });
      }
      break;

    case "room:player-joined": {
      const room = get().currentRoom;
      if (!room) return;
      set({
        currentRoom: {
          ...room,
          players: [...room.players, {
            id: "",
            userId: payload.userId,
            user: { id: payload.userId, username: payload.username, avatarUrl: payload.avatarUrl },
            virtualIp: payload.virtualIp,
            publicKey: payload.publicKey,
            status: "CONNECTING",
            joinedAt: new Date().toISOString(),
          }],
        },
      });

      // Send peer offer to new player
      const { wsClient, publicKey } = get();
      if (wsClient && publicKey) {
        wsClient.send("peer:offer", {
          roomId: room.id,
          targetUserId: payload.userId,
          publicKey,
          endpoint: "", // will be filled by STUN/actual endpoint discovery
        });
      }
      break;
    }

    case "room:player-left": {
      const room = get().currentRoom;
      if (!room) return;
      set({
        currentRoom: {
          ...room,
          players: room.players.filter((p) => p.userId !== payload.userId),
        },
      });
      break;
    }

    case "room:player-ready": {
      const room = get().currentRoom;
      if (!room) return;
      set({
        currentRoom: {
          ...room,
          players: room.players.map((p) =>
            p.userId === payload.userId
              ? { ...p, status: payload.ready ? "READY" : "CONNECTED" }
              : p
          ),
        },
      });
      break;
    }

    case "room:message":
      set({ messages: [...get().messages, payload] });
      break;

    case "room:game-starting": {
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: "PLAYING" } });
      }
      break;
    }

    case "room:closed":
      invoke("destroy_tunnel", { roomId: get().currentRoom?.id || "" }).catch(() => {});
      set({ currentRoom: null, messages: [], tunnelActive: false, virtualIp: null });
      break;

    case "peer:signal":
      // Received peer's WireGuard info — trigger tunnel creation
      handlePeerSignal(payload, set, get);
      break;

    case "peer:connected":
      // Update player status to connected
      const r = get().currentRoom;
      if (r) {
        set({
          currentRoom: {
            ...r,
            players: r.players.map((p) =>
              p.userId === payload.userId ? { ...p, status: "CONNECTED" } : p
            ),
          },
        });
      }
      break;

    case "error":
      console.error("WebSocket error:", payload.message);
      break;
  }
}

async function handlePeerSignal(
  payload: { fromUserId: string; publicKey: string; endpoint: string },
  set: any,
  get: () => RoomState
) {
  const { currentRoom, privateKey, virtualIp } = get();
  if (!currentRoom || !privateKey || !virtualIp) return;

  try {
    // Create/update tunnel with new peer
    await invoke("create_tunnel", {
      roomId: currentRoom.id,
      virtualIp,
      privateKey,
      peers: [{
        public_key: payload.publicKey,
        endpoint: payload.endpoint,
        virtual_ip: "", // assigned by server
      }],
    });
    set({ tunnelActive: true });
  } catch (err) {
    console.error("Tunnel creation failed:", err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/roomStore.ts
git commit -m "feat(frontend): add room Zustand store with WebSocket + tunnel integration"
```

---

## Chunk 6: Frontend — Pages and UI Components

### Task 15: Create Room Modal component

**Files:**
- Create: `src/components/CreateRoomModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { GameHostingProfile } from "../lib/types";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (data: {
    gameName: string;
    name: string;
    maxPlayers: number;
    hostType: "LAN_HOST" | "DEDICATED";
    port?: number;
  }) => void;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<GameHostingProfile[]>([]);
  const [gameName, setGameName] = useState("");
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [hostType, setHostType] = useState<"LAN_HOST" | "DEDICATED">("LAN_HOST");
  const [port, setPort] = useState<number | undefined>();
  const [selectedProfile, setSelectedProfile] = useState<GameHostingProfile | null>(null);

  useEffect(() => {
    api.hostingProfiles.list().then(setProfiles).catch(() => {});
  }, []);

  function handleProfileSelect(profile: GameHostingProfile) {
    setSelectedProfile(profile);
    setGameName(profile.gameName);
    setPort(profile.port);
    setHostType(profile.hostType);
    setName(`${profile.gameName} Lobby`);
  }

  function handleSubmit() {
    if (!gameName.trim() || !name.trim()) return;
    onCreate({
      gameName: gameName.trim(),
      name: name.trim(),
      maxPlayers,
      hostType,
      port,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-brand-950 border border-brand-800 p-6">
        <h2 className="text-lg font-bold text-brand-100 mb-4">{t("multiplayer.createRoom")}</h2>

        {/* Quick select from hosting profiles */}
        {profiles.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
              {t("multiplayer.selectGame")}
            </label>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProfileSelect(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    selectedProfile?.id === p.id
                      ? "bg-indigo-600 text-white"
                      : "bg-brand-900 text-brand-300 border border-brand-800 hover:border-brand-600"
                  }`}
                >
                  {p.gameName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual game name */}
        <div className="mb-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
            {t("multiplayer.gameName")}
          </label>
          <input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none"
            placeholder="Minecraft, Terraria..."
          />
        </div>

        {/* Room name */}
        <div className="mb-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
            {t("multiplayer.roomName")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none"
            placeholder="Survival birlikte oynayalım"
          />
        </div>

        {/* Max players + Port row */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
              {t("multiplayer.maxPlayers")}
            </label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              min={2}
              max={32}
              className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
              {t("multiplayer.port")}
            </label>
            <input
              type="number"
              value={port || ""}
              onChange={(e) => setPort(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none"
              placeholder="25565"
            />
          </div>
        </div>

        {/* Host type */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
            {t("multiplayer.hostType")}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setHostType("LAN_HOST")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                hostType === "LAN_HOST"
                  ? "bg-indigo-600 text-white"
                  : "bg-brand-900 text-brand-400 border border-brand-800"
              }`}
            >
              {t("room.hostType.lan")}
            </button>
            <button
              onClick={() => setHostType("DEDICATED")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                hostType === "DEDICATED"
                  ? "bg-indigo-600 text-white"
                  : "bg-brand-900 text-brand-400 border border-brand-800"
              }`}
            >
              {t("room.hostType.dedicated")}
            </button>
          </div>
        </div>

        {/* Setup instructions from profile */}
        {selectedProfile?.setupInstructions && (
          <div className="mb-4 p-3 bg-brand-900/50 border border-brand-800 rounded-lg">
            <p className="text-xs text-brand-400">{selectedProfile.setupInstructions}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-brand-400 bg-brand-900 border border-brand-800 hover:border-brand-600 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!gameName.trim() || !name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t("multiplayer.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CreateRoomModal.tsx
git commit -m "feat(frontend): add CreateRoomModal component"
```

### Task 16: Multiplayer Page

**Files:**
- Create: `src/pages/MultiplayerPage.tsx`

- [ ] **Step 1: Create MultiplayerPage**

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { CreateRoomModal } from "../components/CreateRoomModal";
import type { Room } from "../lib/types";

interface Props {
  onNavigate: (page: string, slug?: string) => void;
}

export default function MultiplayerPage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { rooms, fetchRooms, createRoom } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchRooms(); }, []);

  const myRooms = rooms.filter(
    (r) => r.hostId === user?.id || r.players.some((p) => p.userId === user?.id)
  );
  const friendRooms = rooms.filter(
    (r) => r.hostId !== user?.id && !r.players.some((p) => p.userId === user?.id)
  );

  async function handleCreate(data: any) {
    const room = await createRoom(data);
    setShowCreate(false);
    onNavigate("room", room.id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-brand-100">{t("multiplayer.title")}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors"
        >
          + {t("multiplayer.createRoom")}
        </button>
      </div>

      {/* My Rooms */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-3">
          {t("multiplayer.myRooms")}
        </h2>
        {myRooms.length === 0 ? (
          <p className="text-sm text-brand-600">{t("multiplayer.noRooms")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myRooms.map((room) => (
              <RoomCard key={room.id} room={room} onClick={() => onNavigate("room", room.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Friends Hosting */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-3">
          {t("multiplayer.friendsHosting")}
        </h2>
        {friendRooms.length === 0 ? (
          <p className="text-sm text-brand-600">{t("multiplayer.noFriendsHosting")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {friendRooms.map((room) => (
              <RoomCard key={room.id} room={room} onClick={() => onNavigate("room", room.id)} />
            ))}
          </div>
        )}
      </section>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const { t } = useTranslation();
  const statusColor = room.status === "WAITING" ? "text-green-400" : "text-yellow-400";
  const statusBg = room.status === "WAITING" ? "bg-green-400/10" : "bg-yellow-400/10";
  const initials = room.host.username.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-brand-950 border border-brand-800 rounded-xl hover:border-brand-600 transition-colors text-left w-full"
    >
      {/* Game icon placeholder */}
      <div className="w-12 h-12 rounded-lg bg-brand-900 flex items-center justify-center text-xl flex-shrink-0">
        {room.game?.coverImageUrl ? (
          <img src={room.game.coverImageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
        ) : (
          "🎮"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-brand-100 truncate">{room.name}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusBg} ${statusColor}`}>
            {room.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-500">
          <span>{room.gameName}</span>
          <span>•</span>
          <span>{t("room.playerCount", { current: room.players.length, max: room.maxPlayers })}</span>
        </div>
      </div>
      {/* Host avatar */}
      <div className="flex items-center gap-2">
        {room.host.avatarUrl ? (
          <img src={room.host.avatarUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
            {initials}
          </div>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/MultiplayerPage.tsx
git commit -m "feat(frontend): add MultiplayerPage — room listing and creation"
```

### Task 17: Room Page

**Files:**
- Create: `src/pages/RoomPage.tsx`

- [ ] **Step 1: Create RoomPage**

```tsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";

interface Props {
  roomId: string;
  onNavigate: (page: string, slug?: string) => void;
}

export default function RoomPage({ roomId, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    currentRoom, messages, wsConnected, tunnelActive, virtualIp,
    joinRoom, leaveRoom, sendMessage, toggleReady, startGame, kickPlayer,
  } = useRoomStore();
  const [msgInput, setMsgInput] = useState("");
  const [isReady, setIsReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wsConnected && !currentRoom) {
      joinRoom(roomId);
    }
  }, [wsConnected, roomId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!msgInput.trim()) return;
    sendMessage(msgInput.trim());
    setMsgInput("");
  }

  function handleReady() {
    const next = !isReady;
    setIsReady(next);
    toggleReady(next);
  }

  function handleLeave() {
    leaveRoom();
    onNavigate("multiplayer");
  }

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-brand-500">{t("room.connecting")}</p>
      </div>
    );
  }

  const isHost = currentRoom.hostId === user?.id;
  const emptySlots = Math.max(0, currentRoom.maxPlayers - currentRoom.players.length);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate("multiplayer")} className="w-9 h-9 flex items-center justify-center bg-brand-900 border border-brand-800 rounded-lg text-brand-500 hover:text-brand-200 transition-colors">
            ←
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-brand-100">
              {currentRoom.name} <span className="text-brand-600 font-medium text-sm ml-2">#{currentRoom.code}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-400/10 text-purple-400">
            {t("room.visibility.friends")}
          </span>
          {tunnelActive && (
            <span className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-green-400/10 text-green-400">
              VPN: {virtualIp}
            </span>
          )}
        </div>
      </div>

      {/* Game Info Strip */}
      <div className="flex items-center gap-4 p-3 bg-brand-950 border border-brand-800 rounded-xl mb-4">
        <div className="w-14 h-14 rounded-lg bg-brand-900 flex items-center justify-center text-2xl flex-shrink-0">
          {currentRoom.game?.coverImageUrl ? (
            <img src={currentRoom.game.coverImageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
          ) : "🎮"}
        </div>
        <div className="flex-1">
          <div className="font-bold text-brand-100">{currentRoom.gameName}</div>
          <div className="flex gap-4 text-xs text-brand-500 mt-1">
            <span>{t("room.playerCount", { current: currentRoom.players.length, max: currentRoom.maxPlayers })}</span>
            {currentRoom.port && <span>Port: {currentRoom.port}</span>}
          </div>
        </div>
        <div className="px-3 py-1.5 bg-brand-900 border border-brand-800 rounded-lg text-xs text-brand-400 font-semibold text-center">
          <strong className="text-brand-300 block">
            {currentRoom.hostType === "LAN_HOST" ? t("room.hostType.lan") : t("room.hostType.dedicated")}
          </strong>
        </div>
      </div>

      {/* Main: Players + Chat */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Players */}
        <div className="w-[280px] flex-shrink-0 flex flex-col gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[2px] text-brand-600">{t("room.players")}</div>
          <div className="flex flex-col gap-1 flex-1">
            {currentRoom.players.map((p) => {
              const initials = p.user.username.slice(0, 2).toUpperCase();
              const isPlayerHost = p.userId === currentRoom.hostId;
              const statusColor = p.status === "READY" ? "bg-green-400" : p.status === "CONNECTING" ? "bg-yellow-400 animate-pulse" : "bg-brand-600";
              return (
                <div key={p.id || p.userId} className="flex items-center gap-3 px-3 py-2.5 bg-brand-950 border border-brand-800 rounded-lg">
                  <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {p.user.avatarUrl ? <img src={p.user.avatarUrl} alt="" className="w-full h-full rounded-md object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-brand-200 truncate">{p.user.username}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isPlayerHost ? "#6366f1" : "#4ade80" }}>
                      {isPlayerHost ? t("room.host") : p.status === "READY" ? t("room.ready") : t("room.connecting")}
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                  {isHost && !isPlayerHost && (
                    <button onClick={() => kickPlayer(p.userId)} className="text-[10px] text-red-400 hover:text-red-300 font-bold">
                      {t("room.kick")}
                    </button>
                  )}
                </div>
              );
            })}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center justify-center px-3 py-2.5 border border-dashed border-brand-800/50 rounded-lg text-brand-700 text-xs font-semibold">
                {t("room.emptySlot")}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-1.5 mt-auto pt-3">
            {isHost && (
              <button onClick={startGame} className="py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-lg text-white text-sm font-extrabold uppercase tracking-wider hover:brightness-110 transition">
                {t("room.startGame")}
              </button>
            )}
            <button onClick={handleReady} className={`py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border transition ${isReady ? "bg-green-900/30 border-green-800 text-green-400" : "bg-brand-950 border-brand-800 text-brand-400 hover:border-brand-600"}`}>
              {isReady ? "✓ " + t("room.ready") : t("room.notReady")}
            </button>
            <button onClick={handleLeave} className="py-2 text-red-400 text-xs font-semibold opacity-60 hover:opacity-100 transition">
              {t("room.leave")}
            </button>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col bg-brand-950/50 border border-brand-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-800 text-[11px] font-bold uppercase tracking-[2px] text-brand-600">
            {t("room.chat")}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {messages.map((msg, i) =>
              msg.isSystem ? (
                <div key={msg.id || i} className="text-center text-xs text-brand-600 italic py-1">
                  {renderSystemMessage(msg.content, t)}
                </div>
              ) : (
                <div key={msg.id || i} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5">
                    {(msg.username || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-400">{msg.username}</div>
                    <div className="text-sm text-brand-300">{msg.content}</div>
                    <div className="text-[10px] text-brand-700 mt-0.5">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-brand-800 flex gap-2">
            <input
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 px-3 py-2.5 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 outline-none focus:border-indigo-500"
              placeholder={t("room.messagePlaceholder")}
            />
            <button onClick={handleSend} className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white text-sm font-bold hover:bg-indigo-500 transition">
              {t("room.sendMessage")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Parse system messages like "player_joined:username" into translated strings
function renderSystemMessage(content: string, t: any): string {
  const [key, name] = content.split(":");
  if (key === "player_joined") return `${name} ${t("room.playerJoined", "joined the room")}`;
  if (key === "player_left") return `${name} ${t("room.playerLeft", "left the room")}`;
  return content;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/RoomPage.tsx
git commit -m "feat(frontend): add RoomPage — lobby UI with chat and player list"
```

### Task 18: Wire up routing and navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Add multiplayer and room routes in App.tsx**

In the route rendering section, add:

```tsx
{page === "multiplayer" && <MultiplayerPage onNavigate={navigate} />}
{page === "room" && gameSlug && <RoomPage roomId={gameSlug} onNavigate={navigate} />}
```

Import `MultiplayerPage` and `RoomPage`.

- [ ] **Step 2: Add "Multiplayer" nav item in TopBar.tsx**

Add a nav button between existing items (after Library, before Marketplace):

```tsx
<button
  onClick={() => onNavigate("multiplayer")}
  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-colors ${
    currentPage === "multiplayer"
      ? "text-brand-100 bg-brand-800"
      : "text-brand-500 hover:text-brand-300"
  }`}
>
  {t("multiplayer.title")}
</button>
```

- [ ] **Step 3: Connect WebSocket on auth**

In `App.tsx`, when user authenticates, connect the room store's WebSocket:

```typescript
import { useRoomStore } from "./stores/roomStore";

// After successful auth / loadSession:
const connectWs = useRoomStore.getState().connect;
// Call connect with the access token when user is authenticated
```

This should be in the existing auth flow — when `isAuthenticated` becomes true, call `connectWs(token)`.

- [ ] **Step 4: Add nav.multiplayer to i18n**

In all 4 locale files, add under `nav`:

```json
"multiplayer": "Multiplayer"  // en
"multiplayer": "Çok Oyunculu"  // tr
"multiplayer": "Mehrspieler"  // de
"multiplayer": "Multijugador"  // es
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/TopBar.tsx src/i18n/locales/
git commit -m "feat(frontend): wire up multiplayer routing and navigation"
```

---

## Chunk 7: Integration Testing and Polish

### Task 19: Manual integration test

- [ ] **Step 1: Start server and verify**

```bash
cd server
npm run dev
```

Verify: No startup errors, WebSocket registered, stale room cleanup runs.

- [ ] **Step 2: Start Tauri app**

```bash
npm run tauri dev
```

Verify: App compiles, new Multiplayer nav item visible.

- [ ] **Step 3: Test room creation flow**

1. Navigate to Multiplayer page
2. Click "Create Room"
3. Select a game from hosting profiles
4. Fill in room name
5. Click Create
6. Verify room appears in listing
7. Verify redirected to Room page
8. Verify player list shows you as Host

- [ ] **Step 4: Test WebSocket chat**

1. In the Room page, type a message
2. Verify it appears in the chat
3. Verify system messages appear (join/leave)

- [ ] **Step 5: Test room closing**

1. Click "Leave Room" as host
2. Verify room closes
3. Verify redirected to Multiplayer page

- [ ] **Step 6: Fix any issues found during testing**

Address TypeScript compilation errors, missing imports, layout issues, or broken API calls.

- [ ] **Step 7: Commit fixes**

```bash
git add -A
git commit -m "fix: address integration issues from P2P multiplayer testing"
```

### Task 20: TypeScript verification

- [ ] **Step 1: Check frontend compilation**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Check server compilation**

```bash
cd server
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Check Rust compilation**

```bash
cd src-tauri
cargo check
```

Fix any compilation errors.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript and Rust compilation errors"
```
