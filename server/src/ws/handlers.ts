import * as roomService from "../services/room.service.js";
import {
  broadcastToRoom,
  sendToUser,
  setClientRoom,
  type ConnectedClient,
} from "./gateway.js";

type Client = Pick<ConnectedClient, "userId" | "username" | "roomId">;

export async function handleMessage(
  client: Client,
  type: string,
  payload: unknown,
) {
  switch (type) {
    case "room:join":
      return handleJoin(client, payload as JoinPayload);
    case "room:leave":
      return handleLeave(client, payload as RoomIdPayload);
    case "room:ready":
      return handleReady(client, payload as ReadyPayload);
    case "room:send-message":
      return handleSendMessage(client, payload as SendMessagePayload);
    case "room:start-game":
      return handleStartGame(client, payload as RoomIdPayload);
    case "room:kick":
      return handleKick(client, payload as KickPayload);
    case "dm:send":
      return handleDmSend(client, payload as DmSendPayload);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// ── Payload types ───────────────────────────────────

interface JoinPayload {
  roomId: string;
}

interface RoomIdPayload {
  roomId: string;
}

interface ReadyPayload {
  roomId: string;
  ready: boolean;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
}

interface KickPayload {
  roomId: string;
  targetUserId: string;
}

interface DmSendPayload {
  friendId: string;
  content: string;
}

// ── Handlers ────────────────────────────────────────

async function handleJoin(client: Client, payload: JoinPayload) {
  const { roomId } = payload;

  const player = await roomService.joinRoom(roomId, client.userId);

  setClientRoom(client.userId, roomId);

  // Send full room state to the joining player
  const room = await roomService.getRoomById(roomId);
  sendToUser(client.userId, { type: "room:state", payload: room });

  // Broadcast that a new player joined (excluding the joiner)
  broadcastToRoom(
    roomId,
    { type: "room:player-joined", payload: player },
    client.userId,
  );

  // System message
  await roomService.addMessage(
    roomId,
    null,
    `player_joined:${client.username}`,
    true,
  );
}

async function handleLeave(client: Client, payload: RoomIdPayload) {
  const { roomId } = payload;
  const result = await roomService.leaveRoom(roomId, client.userId);

  setClientRoom(client.userId, null);

  if (result.closed) {
    // Host left — room is closed
    broadcastToRoom(roomId, { type: "room:closed", payload: { roomId } });
  } else {
    broadcastToRoom(roomId, {
      type: "room:player-left",
      payload: { userId: client.userId, username: client.username },
    });

    await roomService.addMessage(
      roomId,
      null,
      `player_left:${client.username}`,
      true,
    );
  }
}

async function handleReady(client: Client, payload: ReadyPayload) {
  const { roomId, ready } = payload;
  await roomService.toggleReady(roomId, client.userId, ready);

  broadcastToRoom(roomId, {
    type: "room:player-ready",
    payload: { userId: client.userId, ready },
  });
}

async function handleSendMessage(client: Client, payload: SendMessagePayload) {
  const { roomId, content } = payload;
  if (!content.trim()) return;

  const message = await roomService.addMessage(roomId, client.userId, content);

  broadcastToRoom(roomId, { type: "room:message", payload: message });
}

async function handleStartGame(client: Client, payload: RoomIdPayload) {
  const { roomId } = payload;
  await roomService.startGame(roomId, client.userId);

  broadcastToRoom(roomId, {
    type: "room:game-starting",
    payload: { roomId, status: "PLAYING" },
  });
}

async function handleKick(client: Client, payload: KickPayload) {
  const { roomId, targetUserId } = payload;
  await roomService.kickPlayer(roomId, client.userId, targetUserId);

  // Notify the kicked user
  sendToUser(targetUserId, {
    type: "room:kicked",
    payload: { roomId },
  });

  // Update kicked user's client room
  setClientRoom(targetUserId, null);

  // Notify the room
  broadcastToRoom(roomId, {
    type: "room:player-kicked",
    payload: { userId: targetUserId },
  });
}

async function handleDmSend(client: Client, payload: DmSendPayload) {
  const { friendId, content } = payload;
  if (!content?.trim()) return;

  const dmService = await import("../services/dm.service.js");
  const message = await dmService.sendMessage(client.userId, friendId, content.trim());

  // Send to the receiver if they're online
  sendToUser(friendId, {
    type: "dm:message",
    payload: message,
  });

  // Also confirm back to sender
  sendToUser(client.userId, {
    type: "dm:message",
    payload: message,
  });
}
