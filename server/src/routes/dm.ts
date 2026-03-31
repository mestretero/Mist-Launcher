import type { FastifyInstance } from "fastify";
import * as dmService from "../services/dm.service.js";

export default async function dmRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Get conversations list
  app.get("/dm/conversations", async (request) => {
    const userId = request.user!.userId;
    const conversations = await dmService.getConversations(userId);
    return { data: conversations };
  });

  // Get messages with a specific friend
  app.get("/dm/:friendId/messages", async (request) => {
    const userId = request.user!.userId;
    const { friendId } = request.params as { friendId: string };
    const messages = await dmService.getMessages(userId, friendId);
    return { data: messages };
  });

  // Send a message
  app.post("/dm/:friendId", async (request, reply) => {
    const userId = request.user!.userId;
    const { friendId } = request.params as { friendId: string };
    const { content } = request.body as { content: string };
    if (!content?.trim()) return reply.status(400).send({ error: { message: "Empty message" } });
    const message = await dmService.sendMessage(userId, friendId, content.trim());
    return reply.status(201).send({ data: message });
  });
}
