import { FastifyInstance } from "fastify";
import * as notificationService from "../services/notification.service.js";

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/notifications", async (request) => {
    const notifications = await notificationService.getNotifications(request.user!.userId);
    const unreadCount = await notificationService.getUnreadCount(request.user!.userId);
    return { data: { notifications, unreadCount } };
  });

  app.patch("/notifications/:id/read", async (request) => {
    const { id } = request.params as { id: string };
    await notificationService.markAsRead(request.user!.userId, id);
    return { data: { success: true } };
  });

  app.post("/notifications/read-all", async (request) => {
    await notificationService.markAllAsRead(request.user!.userId);
    return { data: { success: true } };
  });
}
