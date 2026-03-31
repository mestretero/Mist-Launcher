import { prisma } from "../lib/prisma.js";
import { forbidden } from "../lib/errors.js";

// Send a direct message to a friend
export async function sendMessage(senderId: string, receiverId: string, content: string) {
  // Verify they are friends (ACCEPTED friendship exists)
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  });
  if (!friendship) throw forbidden("You can only message friends");

  return prisma.directMessage.create({
    data: { senderId, receiverId, content },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
}

// Get message history between two users (last 50)
export async function getMessages(userId: string, friendId: string) {
  return prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

// Get recent conversations (list of friends with last message)
export async function getConversations(userId: string) {
  // Get all DMs involving this user, grouped by the other person
  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      receiver: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by conversation partner, keep only the latest message
  const convMap = new Map<string, any>();
  for (const msg of messages) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    if (!convMap.has(partnerId)) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      convMap.set(partnerId, {
        friendId: partnerId,
        friend: partner,
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt,
        isFromMe: msg.senderId === userId,
      });
    }
  }

  return Array.from(convMap.values());
}

// Delete messages older than 8 hours (DM + group)
export async function cleanupOldMessages() {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const dmResult = await prisma.directMessage.deleteMany({
    where: { createdAt: { lt: eightHoursAgo } },
  });
  if (dmResult.count > 0) console.log(`Cleaned up ${dmResult.count} old direct messages`);

  // Import lazily to avoid circular deps
  const groupService = await import("./group.service.js");
  await groupService.cleanupOldMessages();
}
