import { create } from "zustand";
import { WsClient } from "../lib/wsClient";
import { api } from "../lib/api";
import type { Room, RoomMessage } from "../lib/types";

interface RoomState {
  wsConnected: boolean;
  wsClient: WsClient | null;
  currentRoom: Room | null;
  rooms: Room[];
  messages: RoomMessage[];

  connect: (token: string) => void;
  disconnect: () => void;
  fetchRooms: () => Promise<void>;
  createRoom: (data: {
    gameName: string;
    name: string;
    maxPlayers?: number;
    serverAddress?: string;
    discordLink?: string;
    description?: string;
    visibility?: "FRIENDS" | "SCHEDULED" | "PUBLIC";
    durationHours?: number;
    language?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  }) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  closeRoom: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  toggleReady: (ready: boolean) => void;
  startGame: () => void;
  kickPlayer: (userId: string) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  wsConnected: false,
  wsClient: null,
  currentRoom: null,
  rooms: [],
  messages: [],

  connect: (token) => {
    const existing = get().wsClient;
    if (existing) existing.disconnect();

    console.log("[WS] Connecting with token:", token?.slice(0, 20) + "...");
    const client = new WsClient(
      token,
      (type, payload) => {
        console.log("[WS] Received:", type);
        handleWsMessage(type, payload, set, get);
      },
      (connected) => {
        console.log("[WS] Connected:", connected);
        set({ wsConnected: connected });
      },
    );
    client.connect();
    set({ wsClient: client });
  },

  disconnect: () => {
    const { wsClient } = get();
    if (wsClient) {
      wsClient.disconnect();
      set({ wsClient: null, wsConnected: false });
    }
    set({ currentRoom: null, messages: [] });
  },

  fetchRooms: async () => {
    const rooms = await api.rooms.list();
    set({ rooms });
  },

  createRoom: async (data) => {
    const room = await api.rooms.create(data);

    set({ currentRoom: room, messages: [] });

    // Load message history (in case host rejoins)
    try {
      const msgs = await api.rooms.getMessages(room.id);
      set({ messages: msgs });
    } catch { /* no history available */ }

    // Join via WS (with retry — WS might still be connecting)
    await waitForWs(get);
    get().wsClient?.send("room:join", { roomId: room.id });
    return room;
  },

  joinRoom: async (roomId) => {
    // Fetch room data via REST
    try {
      const room = await api.rooms.getById(roomId);
      set({ currentRoom: room, messages: [] });

      // Load message history
      try {
        const msgs = await api.rooms.getMessages(roomId);
        set({ messages: msgs });
      } catch { /* no history available */ }
    } catch {
      /* will get state from WS */
    }

    // Join via WebSocket (with retry)
    await waitForWs(get);
    get().wsClient?.send("room:join", { roomId });
  },

  leaveRoom: () => {
    const { wsClient, currentRoom } = get();
    if (!currentRoom) return;

    // Notify other players via WS — just leave, don't delete the room
    if (wsClient) {
      wsClient.send("room:leave", { roomId: currentRoom.id });
    }

    set({ currentRoom: null, messages: [] });
  },

  closeRoom: async () => {
    const { wsClient, currentRoom } = get();
    if (!currentRoom) return;

    // Notify other players via WS
    if (wsClient) {
      wsClient.send("room:leave", { roomId: currentRoom.id });
    }

    // Actually delete the room via REST
    try {
      await api.rooms.close(currentRoom.id);
    } catch {
      // Already deleted — fine
    }

    set({ currentRoom: null, messages: [] });
  },

  sendMessage: async (content) => {
    const { currentRoom } = get();
    if (!currentRoom) return;
    // Wait for WS if not connected yet
    await waitForWs(get);
    const { wsClient } = get();
    if (!wsClient) {
      console.warn("WebSocket not available — message not sent");
      return;
    }
    wsClient.send("room:send-message", {
      roomId: currentRoom.id,
      content,
    });
  },

  toggleReady: (ready) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:ready", { roomId: currentRoom.id, ready });
    }
  },

  startGame: () => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:start-game", { roomId: currentRoom.id });
    }
  },

  kickPlayer: (userId) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:kick", { roomId: currentRoom.id, userId });
    }
  },
}));

function handleWsMessage(
  type: string,
  payload: any,
  set: any,
  get: () => RoomState,
) {
  switch (type) {
    case "room:state": {
      // Update room data (with fresh player list) but preserve messages
      const existingMessages = get().messages;
      set({ currentRoom: payload, messages: existingMessages.length > 0 ? existingMessages : [] });
      break;
    }

    case "room:player-joined": {
      const room = get().currentRoom;
      if (!room) break;
      set({
        currentRoom: {
          ...room,
          players: [
            ...room.players,
            {
              id: "",
              userId: payload.userId,
              user: {
                id: payload.userId,
                username: payload.username,
                avatarUrl: payload.avatarUrl,
              },
              status: "CONNECTED" as const,
              joinedAt: new Date().toISOString(),
            },
          ],
        },
      });
      break;
    }

    case "room:player-left": {
      const room = get().currentRoom;
      if (!room) return;
      set({
        currentRoom: {
          ...room,
          players: room.players.filter((p) => p.userId !== payload.userId),
        },
      });
      break;
    }

    case "room:player-ready": {
      const room = get().currentRoom;
      if (!room) return;
      set({
        currentRoom: {
          ...room,
          players: room.players.map((p) =>
            p.userId === payload.userId
              ? {
                  ...p,
                  status: payload.ready
                    ? ("READY" as const)
                    : ("CONNECTED" as const),
                }
              : p,
          ),
        },
      });
      break;
    }

    case "room:message":
      set({ messages: [...get().messages, payload] });
      break;

    case "room:game-starting": {
      const room = get().currentRoom;
      if (room) {
        set({
          currentRoom: { ...room, status: "PLAYING" as const },
        });
      }
      break;
    }

    case "room:closed":
    case "room:kicked":
      set({ currentRoom: null, messages: [] });
      break;

    case "room:player-kicked": {
      const room2 = get().currentRoom;
      if (!room2) return;
      set({
        currentRoom: {
          ...room2,
          players: room2.players.filter((p) => p.userId !== payload.userId),
        },
      });
      break;
    }

    case "dm:message":
      import("./dmStore").then(({ useDmStore }) => {
        useDmStore.getState().receiveMessage(payload);
      });
      break;

    case "error":
      console.error("WebSocket error:", payload.message);
      break;
  }
}

/** Wait up to 5 seconds for WS to be connected */
function waitForWs(get: () => RoomState): Promise<void> {
  return new Promise((resolve) => {
    if (get().wsConnected) return resolve();
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (get().wsConnected || attempts >= 25) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}
