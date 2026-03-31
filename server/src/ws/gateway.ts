import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  roomId: string | null;
  lastPong: number;
}

const clients = new Map<string, ConnectedClient>();

export function getRoomClients(roomId: string): ConnectedClient[] {
  return Array.from(clients.values()).filter((c) => c.roomId === roomId);
}

export function broadcastToRoom(
  roomId: string,
  message: object,
  excludeUserId?: string,
) {
  const json = JSON.stringify(message);
  for (const client of getRoomClients(roomId)) {
    if (client.userId !== excludeUserId && client.ws.readyState === 1) {
      client.ws.send(json);
    }
  }
}

export function sendToUser(userId: string, message: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

export function getClient(userId: string): ConnectedClient | undefined {
  return clients.get(userId);
}

export function getOnlineUserIds(): string[] {
  return Array.from(clients.keys());
}

export function isUserOnline(userId: string): boolean {
  return clients.has(userId);
}

export function setClientRoom(userId: string, roomId: string | null) {
  const client = clients.get(userId);
  if (client) client.roomId = roomId;
}

export default async function wsGateway(app: FastifyInstance) {
  const { handleMessage } = await import("./handlers.js");

  app.get("/ws", { websocket: true }, async (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let userId: string;
    let username: string;

    try {
      const decoded = verifyAccessToken(token);
      userId = decoded.userId;

      // Token doesn't carry username — look it up
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { username: true },
      });
      if (!user) {
        socket.close(4001, "User not found");
        return;
      }
      username = user.username;
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    const client: ConnectedClient = {
      ws: socket,
      userId,
      username,
      roomId: null,
      lastPong: Date.now(),
    };

    // If user already has an active connection, close the old one
    const existing = clients.get(userId);
    if (existing) {
      existing.ws.close(4003, "Replaced by new connection");
    }

    clients.set(userId, client);

    socket.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          payload?: unknown;
        };
        if (msg.type && msg.payload) {
          await handleMessage(client, msg.type, msg.payload);
        }
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "error",
            payload: { message: (err as Error).message },
          }),
        );
      }
    });

    socket.on("pong", () => {
      client.lastPong = Date.now();
    });

    socket.on("close", async () => {
      // Only delete if this is still the active client for this userId
      // (avoids race with "replaced by new connection")
      if (clients.get(userId) === client) {
        clients.delete(userId);
      }
      if (client.roomId) {
        try {
          await handleMessage(client, "room:leave", {
            roomId: client.roomId,
          });
        } catch {
          // Best-effort cleanup
        }
      }
    });
  });

  // Heartbeat: ping every 30s, kill after 40s without pong
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [uid, client] of clients) {
      if (now - client.lastPong > 40_000) {
        client.ws.close(4002, "Heartbeat timeout");
        clients.delete(uid);
      } else {
        client.ws.ping();
      }
    }
  }, 30_000);

  app.addHook("onClose", () => {
    clearInterval(heartbeatInterval);
  });
}
