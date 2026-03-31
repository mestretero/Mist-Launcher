import { FastifyInstance } from "fastify";
import * as friendshipService from "../services/friendship.service.js";
import { isUserOnline } from "../ws/gateway.js";

export default async function friendRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/friends", async (request) => {
    const friends = await friendshipService.getFriends(request.user!.userId);
    const enriched = friends.map((f: any) => ({
      ...f,
      online: isUserOnline(f.friend?.id || f.id),
    }));
    return { data: enriched };
  });

  app.get("/friends/pending", async (request) => {
    const pending = await friendshipService.getPendingRequests(request.user!.userId);
    return { data: pending };
  });

  app.get("/friends/search", async (request) => {
    const { q } = request.query as { q: string };
    const users = await friendshipService.searchUsers(q || "", request.user!.userId);
    return { data: users };
  });

  app.post("/friends/request", async (request) => {
    const { username } = request.body as { username: string };
    const result = await friendshipService.sendRequest(request.user!.userId, username);
    return { data: result };
  });

  app.post("/friends/:id/accept", async (request) => {
    const { id } = request.params as { id: string };
    const result = await friendshipService.acceptRequest(request.user!.userId, id);
    return { data: result };
  });

  app.post("/friends/:id/reject", async (request) => {
    const { id } = request.params as { id: string };
    await friendshipService.rejectRequest(request.user!.userId, id);
    return { data: { success: true } };
  });

  app.delete("/friends/:id", async (request) => {
    const { id } = request.params as { id: string };
    await friendshipService.removeFriend(request.user!.userId, id);
    return { data: { success: true } };
  });
}
