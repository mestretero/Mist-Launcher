import type { FastifyInstance } from "fastify";
import * as roomService from "../services/room.service.js";

export default async function roomRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Create a new room
  app.post("/rooms", async (request, reply) => {
    const userId = request.user!.userId;
    const body = request.body as {
      gameId?: string;
      gameName: string;
      name: string;
      maxPlayers?: number;
      visibility?: "FRIENDS" | "SCHEDULED" | "PUBLIC";
      serverAddress?: string;
      discordLink?: string;
      description?: string;
      durationHours?: number;
      language?: string;
      scheduledStart?: string;
      scheduledEnd?: string;
    };
    try {
      const room = await roomService.createRoom(userId, body);
      return reply.status(201).send({ data: room });
    } catch (err) {
      console.error("Room creation failed:", err);
      throw err;
    }
  });

  // List rooms (friends + own)
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

  // Close / delete room
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
    const body = request.body as {
      name?: string;
      maxPlayers?: number;
      port?: number;
    };
    const room = await roomService.getRoomById(id);
    if (room.hostId !== userId) {
      return reply.status(403).send({
        error: { message: "Only host can update room" },
      });
    }
    const updated = await roomService.updateRoom(id, body);
    return { data: updated };
  });

  // Get room chat messages
  app.get("/rooms/:id/messages", async (request) => {
    const { id } = request.params as { id: string };
    const { before } = request.query as { before?: string };
    const messages = await roomService.getMessages(id, 100, before);
    return { data: messages };
  });
}
