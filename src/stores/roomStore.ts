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
  leaveRoom: () => Promise<void>;
  sendMessage: (content: string) => void;
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

    const client = new WsClient(
      token,
      (type, payload) => handleWsMessage(type, payload, set, get),
      (connected) => set({ wsConnected: connected }),
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

    // Join via WS
    const { wsClient, wsConnected } = get();
    if (wsClient && wsConnected) {
      wsClient.send("room:join", { roomId: room.id, publicKey: "" });
    }
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

    // Join via WebSocket for real-time updates
    const { wsClient, wsConnected } = get();
    if (wsClient && wsConnected) {
      wsClient.send("room:join", { roomId });
    }
  },

  leaveRoom: async () => {
    const { wsClient, currentRoom } = get();
    if (!currentRoom) return;

    // Notify other players via WS
    if (wsClient) {
      wsClient.send("room:leave", { roomId: currentRoom.id });
    }

    // Host: also call REST DELETE to guarantee room deletion
    try {
      await api.rooms.close(currentRoom.id);
    } catch {
      // Non-host or already deleted — that's fine
    }

    set({ currentRoom: null, messages: [] });
  },

  sendMessage: (content) => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:send-message", {
        roomId: currentRoom.id,
        content,
      });
    }
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
    case "room:state":
      set({ currentRoom: payload, messages: [] });
      break;

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

    case "error":
      console.error("WebSocket error:", payload.message);
      break;
  }
}
