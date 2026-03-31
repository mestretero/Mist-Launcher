import { prisma } from "../lib/prisma.js";
import { notFound, forbidden, badRequest } from "../lib/errors.js";
import { customAlphabet } from "nanoid";

const generateCode = customAlphabet(
  "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  8,
);

const roomInclude = {
  host: { select: { id: true, username: true, avatarUrl: true } },
  game: {
    select: { id: true, title: true, slug: true, coverImageUrl: true },
  },
  players: {
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  },
} as const;

// ── Create ───────────────────────────────────────

export async function createRoom(
  hostId: string,
  data: {
    gameId?: string;
    gameName: string;
    name: string;
    maxPlayers?: number;
    hostType?: "LAN_HOST" | "DEDICATED";
    port?: number;
    visibility?: "FRIENDS" | "INVITE" | "PUBLIC";
    hostLaunchArgs?: string;
    clientLaunchArgs?: string;
    serverFileName?: string;
  },
) {
  const activeCount = await prisma.room.count({
    where: { hostId, status: { in: ["WAITING", "PLAYING"] } },
  });
  if (activeCount >= 5) throw badRequest("Maximum 5 active rooms allowed");

  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    const exists = await prisma.room.findUnique({ where: { code } });
    if (!exists) break;
    attempts++;
  } while (attempts < 5);
  if (attempts >= 5) throw badRequest("Could not generate unique room code");

  const config: Record<string, string> = {};
  if (data.hostLaunchArgs) config.hostLaunchArgs = data.hostLaunchArgs;
  if (data.clientLaunchArgs) config.clientLaunchArgs = data.clientLaunchArgs;
  if (data.serverFileName) config.serverFileName = data.serverFileName;

  const room = await prisma.room.create({
    data: {
      hostId,
      gameId: data.gameId || null,
      gameName: data.gameName,
      name: data.name,
      code: code!,
      maxPlayers: data.maxPlayers || 8,
      hostType: data.hostType || "LAN_HOST",
      visibility: data.visibility || "FRIENDS",
      port: data.port || null,
      ...(Object.keys(config).length > 0 && { config }),
    },
  });

  // Auto-join the host as the first player BEFORE returning
  await prisma.roomPlayer.create({
    data: {
      roomId: room.id,
      userId: hostId,
      virtualIp: "10.13.37.1",
      publicKey: "",
      status: "CONNECTED",
    },
  });

  // Re-fetch with players included so host shows in response
  return prisma.room.findUnique({
    where: { id: room.id },
    include: roomInclude,
  });
}

// ── List (friends-only, excluding blocked) ───────

export async function listRooms(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  const friendIds = friendships.map((f) =>
    f.senderId === userId ? f.receiverId : f.senderId,
  );

  const blocked = await prisma.friendship.findMany({
    where: {
      status: "BLOCKED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  const blockedIds = new Set(
    blocked.map((b) => (b.senderId === userId ? b.receiverId : b.senderId)),
  );

  // Filter blocked users out of the friend list instead of using notIn
  // (Prisma doesn't support combining `in` and `notIn` on the same field)
  const allowedHostIds = [userId, ...friendIds].filter(
    (id) => !blockedIds.has(id),
  );

  return prisma.room.findMany({
    where: {
      status: { in: ["WAITING", "PLAYING"] },
      OR: [
        // Public rooms from anyone (except blocked users)
        { visibility: "PUBLIC", hostId: { notIn: [...blockedIds] } },
        // Friends-only rooms from friends + own rooms
        { visibility: "FRIENDS", hostId: { in: allowedHostIds } },
        // Own rooms (any visibility)
        { hostId: userId },
      ],
    },
    include: roomInclude,
    orderBy: { createdAt: "desc" },
  });
}

// ── Get by ID ────────────────────────────────────

export async function getRoomById(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      ...roomInclude,
      players: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!room) throw notFound("Room not found");
  return room;
}

// ── Join ─────────────────────────────────────────

export async function joinRoom(
  roomId: string,
  userId: string,
  publicKey: string,
) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.status === "CLOSED") throw badRequest("Room is closed");
  if (room.players.length >= room.maxPlayers) throw badRequest("Room is full");

  const existing = room.players.find((p) => p.userId === userId);
  if (existing) return existing;

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
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
}

// ── Leave ────────────────────────────────────────

export async function leaveRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, hostId: true },
  });
  if (!room) throw notFound("Room not found");

  if (room.hostId === userId) {
    // Host left — hard delete the room (cascade deletes players + messages)
    await prisma.room.delete({ where: { id: roomId } });
    return { closed: true };
  }

  await prisma.roomPlayer.deleteMany({ where: { roomId, userId } });
  return { closed: false };
}

// ── Kick ─────────────────────────────────────────

export async function kickPlayer(
  roomId: string,
  hostId: string,
  targetUserId: string,
) {
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

// ── Ready toggle ─────────────────────────────────

export async function toggleReady(
  roomId: string,
  userId: string,
  ready: boolean,
) {
  await prisma.roomPlayer.updateMany({
    where: { roomId, userId },
    data: { status: ready ? "READY" : "CONNECTED" },
  });
}

// ── Player status ────────────────────────────────

export async function updatePlayerStatus(
  roomId: string,
  userId: string,
  status: "CONNECTING" | "CONNECTED" | "READY" | "DISCONNECTED",
) {
  await prisma.roomPlayer.updateMany({
    where: { roomId, userId },
    data: { status },
  });
}

// ── Start game ───────────────────────────────────

export async function startGame(roomId: string, hostId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true, status: true, config: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.hostId !== hostId) throw forbidden("Only host can start the game");
  if (room.status !== "WAITING") throw badRequest("Game already started");

  return prisma.room.update({
    where: { id: roomId },
    data: { status: "PLAYING" },
  });
}

// ── Close room ───────────────────────────────────

export async function closeRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.hostId !== userId) throw forbidden("Only host can close the room");

  // Hard delete — cascade deletes players + messages
  await prisma.room.delete({ where: { id: roomId } });
}

// ── Update room settings ─────────────────────────

export async function updateRoom(
  roomId: string,
  data: { name?: string; maxPlayers?: number; port?: number },
) {
  return prisma.room.update({ where: { id: roomId }, data });
}

// ── Chat messages ────────────────────────────────

export async function addMessage(
  roomId: string,
  userId: string | null,
  content: string,
  isSystem = false,
) {
  return prisma.roomMessage.create({
    data: { roomId, userId, content, isSystem },
    include: userId
      ? { user: { select: { id: true, username: true } } }
      : undefined,
  });
}

export async function getMessages(
  roomId: string,
  limit = 100,
  before?: string,
) {
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

// ── Cleanup stale rooms ──────────────────────────

export async function cleanupStaleRooms() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const result = await prisma.room.deleteMany({
    where: { status: "WAITING", createdAt: { lt: oneHourAgo } },
  });
  if (result.count > 0) {
    console.log(`Cleaned up ${result.count} stale rooms`);
  }
}
