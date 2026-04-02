import type { FastifyInstance } from "fastify";
import * as groupService from "../services/group.service.js";
import { sendToUser } from "../ws/gateway.js";

export default async function groupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Create a group
  app.post("/groups", async (request, reply) => {
    const userId = request.user!.userId;
    const { name, memberIds } = request.body as { name: string; memberIds: string[] };
    if (!name?.trim()) return reply.status(400).send({ error: { message: "Group name required" } });
    if (name.trim().length > 50) return reply.status(400).send({ error: { message: "Group name too long (max 50)" } });
    if (!memberIds?.length) return reply.status(400).send({ error: { message: "Select at least one member" } });

    const group = await groupService.createGroup(userId, name.trim(), memberIds);

    const allMemberIds = group.members.map((m: any) => m.userId);
    for (const memberId of allMemberIds) {
      sendToUser(memberId, { type: "group:created", payload: group });
    }

    return reply.status(201).send({ data: group });
  });

  // List user's groups
  app.get("/groups", async (request) => {
    const userId = request.user!.userId;
    const groups = await groupService.getUserGroups(userId);
    return { data: groups };
  });

  // Get group messages
  app.get("/groups/:id/messages", async (request) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const messages = await groupService.getGroupMessages(id, userId);
    return { data: messages };
  });

  // Send a message
  app.post("/groups/:id/messages", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    if (!content?.trim()) return reply.status(400).send({ error: { message: "Empty message" } });
    if (content.trim().length > 2000) return reply.status(400).send({ error: { message: "Message too long (max 2000)" } });

    const message = await groupService.sendMessage(id, userId, content.trim());

    const members = await groupService.getGroupMembers(id, userId);
    for (const member of members) {
      sendToUser(member.userId, { type: "group:message", payload: { ...message, groupId: id } });
    }

    return reply.status(201).send({ data: message });
  });

  // Add a member (creator only)
  app.post("/groups/:id/members", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { newUserId } = request.body as { newUserId: string };

    const existingMembers = await groupService.getGroupMembers(id, userId);
    const newMember = await groupService.addMember(id, userId, newUserId);
    const toNotify = [...existingMembers.map((m: any) => m.userId), newUserId];
    for (const memberId of toNotify) {
      sendToUser(memberId, { type: "group:member-added", payload: { groupId: id, member: newMember } });
    }

    return reply.status(201).send({ data: newMember });
  });

  // Remove a member (creator only)
  app.delete("/groups/:id/members/:userId", async (request, reply) => {
    const requesterId = request.user!.userId;
    const { id, userId: targetId } = request.params as { id: string; userId: string };

    const members = await groupService.getGroupMembers(id, requesterId);
    await groupService.removeMember(id, requesterId, targetId);

    for (const member of members) {
      sendToUser(member.userId, { type: "group:member-kicked", payload: { groupId: id, userId: targetId } });
    }

    return reply.status(204).send();
  });

  // Leave group
  app.delete("/groups/:id/leave", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const members = await groupService.getGroupMembers(id, userId);
    const result = await groupService.leaveGroup(id, userId);

    if (result.deleted) {
      for (const member of members) {
        sendToUser(member.userId, { type: "group:deleted", payload: { groupId: id } });
      }
    } else {
      for (const member of members) {
        if (member.userId !== userId) {
          sendToUser(member.userId, { type: "group:member-left", payload: { groupId: id, userId } });
        }
      }
    }

    return reply.status(204).send();
  });

  // Delete group (creator only)
  app.delete("/groups/:id", async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const members = await groupService.getGroupMembers(id, userId);
    await groupService.deleteGroup(id, userId);

    for (const member of members) {
      sendToUser(member.userId, { type: "group:deleted", payload: { groupId: id } });
    }

    return reply.status(204).send();
  });
}
