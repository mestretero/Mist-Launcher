import { prisma } from "../lib/prisma.js";
import { forbidden, notFound } from "../lib/errors.js";

const SENDER_SELECT = { select: { id: true, username: true, avatarUrl: true } };
const MEMBER_USER_SELECT = { select: { id: true, username: true, avatarUrl: true } };

// ── Helpers ──────────────────────────────────────────

async function assertMember(groupId: string, userId: string) {
  const member = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw forbidden("You are not a member of this group");
  return member;
}

async function assertCreator(groupId: string, userId: string) {
  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) throw notFound("Group not found");
  if (group.creatorId !== userId) throw forbidden("Only the creator can do this");
  return group;
}

// ── Public functions ──────────────────────────────────

export async function createGroup(creatorId: string, name: string, memberIds: string[]) {
  const uniqueMembers = [...new Set([creatorId, ...memberIds])];
  return prisma.groupChat.create({
    data: {
      name,
      creatorId,
      members: {
        create: uniqueMembers.map((userId) => ({ userId })),
      },
    },
    include: {
      members: { include: { user: MEMBER_USER_SELECT } },
    },
  });
}

export async function getUserGroups(userId: string) {
  const memberships = await prisma.groupChatMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: MEMBER_USER_SELECT } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: SENDER_SELECT },
          },
        },
      },
    },
  });
  return memberships.map((m) => ({
    ...m.group,
    lastMessage: m.group.messages[0] || null,
    messages: undefined,
  }));
}

export async function getGroupMessages(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  // Fetch newest 50, then reverse so they're oldest-first in the UI
  const messages = await prisma.groupChatMessage.findMany({
    where: { groupId },
    include: { sender: SENDER_SELECT },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return messages.reverse();
}

export async function sendMessage(groupId: string, senderId: string, content: string) {
  await assertMember(groupId, senderId);
  return prisma.groupChatMessage.create({
    data: { groupId, senderId, content },
    include: { sender: SENDER_SELECT },
  });
}

export async function addMember(groupId: string, requesterId: string, newUserId: string) {
  await assertCreator(groupId, requesterId);
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: requesterId, receiverId: newUserId },
        { senderId: newUserId, receiverId: requesterId },
      ],
    },
  });
  if (!friendship) throw forbidden("You can only add friends to a group");
  return prisma.groupChatMember.create({
    data: { groupId, userId: newUserId },
    include: { user: MEMBER_USER_SELECT },
  });
}

export async function removeMember(groupId: string, requesterId: string, targetUserId: string) {
  await assertCreator(groupId, requesterId);
  if (requesterId === targetUserId) throw forbidden("Use leaveGroup to leave");
  const exists = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!exists) throw notFound("Member not found");
  await prisma.groupChatMember.delete({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
}

export async function leaveGroup(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) throw notFound("Group not found");

  if (group.creatorId === userId) {
    await prisma.groupChat.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  await prisma.groupChatMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
  return { deleted: false };
}

export async function deleteGroup(groupId: string, requesterId: string) {
  await assertCreator(groupId, requesterId);
  await prisma.groupChat.delete({ where: { id: groupId } });
}

export async function getGroupMembers(groupId: string, userId: string) {
  await assertMember(groupId, userId);
  const members = await prisma.groupChatMember.findMany({
    where: { groupId },
    include: { user: MEMBER_USER_SELECT },
  });
  return members;
}

export async function cleanupOldMessages() {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const result = await prisma.groupChatMessage.deleteMany({
    where: { createdAt: { lt: eightHoursAgo } },
  });
  if (result.count > 0) console.log(`Cleaned up ${result.count} old group messages`);
}
