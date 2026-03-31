import { prisma } from "../lib/prisma.js";
import type { NotificationType } from "@prisma/client";

export async function createNotification(userId: string, type: NotificationType, title: string, message: string, data: any = {}) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, data },
  });
  // Push to client in real-time via WebSocket (lazy import to avoid circular deps)
  try {
    const { sendToUser } = await import("../ws/gateway.js");
    sendToUser(userId, { type: "notification:new", payload: notification });
  } catch { /* WS not available — silent fail */ }
  return notification;
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function cleanupExpiredNotifications() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: oneDayAgo } },
  });
  if (result.count > 0) console.log(`Cleaned up ${result.count} expired notifications`);
}
