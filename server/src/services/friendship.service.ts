import { prisma } from "../lib/prisma.js";
import { notFound, conflict, badRequest } from "../lib/errors.js";
import { createNotification } from "./notification.service.js";

export async function sendRequest(senderId: string, receiverUsername: string) {
  const receiver = await prisma.user.findUnique({ where: { username: receiverUsername } });
  if (!receiver) throw notFound("User not found");
  if (receiver.id === senderId) throw badRequest("Cannot friend yourself");

  const existing = await prisma.friendship.findFirst({
    where: { OR: [
      { senderId, receiverId: receiver.id },
      { senderId: receiver.id, receiverId: senderId },
    ] },
  });
  if (existing) throw conflict("Friendship already exists");

  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { username: true } });
  const friendship = await prisma.friendship.create({ data: { senderId, receiverId: receiver.id } });

  await createNotification(
    receiver.id,
    "FRIEND_REQUEST",
    "Arkadaşlık İsteği",
    `${sender?.username ?? "Bir kullanıcı"} sana arkadaşlık isteği gönderdi.`,
    { friendshipId: friendship.id }
  );

  return friendship;
}

export async function acceptRequest(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || f.receiverId !== userId) throw notFound("Request not found");
  const friendship = await prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } });

  const accepter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  await createNotification(
    friendship.senderId,
    "FRIEND_ACCEPTED",
    "Arkadaşlık Kabul Edildi",
    `${accepter?.username ?? "Bir kullanıcı"} arkadaşlık isteğini kabul etti.`,
    { friendshipId: friendship.id }
  );

  return friendship;
}

export async function rejectRequest(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || f.receiverId !== userId) throw notFound("Request not found");
  return prisma.friendship.delete({ where: { id: friendshipId } });
}

export async function blockUser(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || (f.senderId !== userId && f.receiverId !== userId)) throw notFound("Not found");
  return prisma.friendship.update({ where: { id: friendshipId }, data: { status: "BLOCKED" } });
}

export async function removeFriend(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || (f.senderId !== userId && f.receiverId !== userId)) throw notFound("Not found");
  return prisma.friendship.delete({ where: { id: friendshipId } });
}

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }], status: "ACCEPTED" },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      receiver: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  return friendships.map((f) => ({
    friendshipId: f.id,
    friend: f.senderId === userId ? f.receiver : f.sender,
    since: f.createdAt,
  }));
}

export async function getPendingRequests(userId: string) {
  return prisma.friendship.findMany({
    where: { receiverId: userId, status: "PENDING" },
    include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
  });
}

export async function searchUsers(query: string, currentUserId: string) {
  return prisma.user.findMany({
    where: { username: { contains: query, mode: "insensitive" }, id: { not: currentUserId } },
    select: { id: true, username: true, avatarUrl: true },
    take: 20,
  });
}
