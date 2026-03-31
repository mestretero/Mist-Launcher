import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { WsClient } from "../lib/wsClient";
import { api } from "../lib/api";
import type { Room, RoomPlayer, RoomMessage } from "../lib/types";

interface RoomState {
  wsConnected: boolean;
  wsClient: WsClient | null;
  currentRoom: Room | null;
  rooms: Room[];
  messages: RoomMessage[];
  tunnelActive: boolean;
  virtualIp: string | null;
  publicKey: string | null;
  privateKey: string | null;

  connect: (token: string) => void;
  disconnect: () => void;
  fetchRooms: () => Promise<void>;
  createRoom: (data: {
    gameId?: string;
    gameName: string;
    name: string;
    maxPlayers?: number;
    hostType?: string;
    port?: number;
  }) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
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
  tunnelActive: false,
  virtualIp: null,
  publicKey: null,
  privateKey: null,

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
    const { wsClient, currentRoom } = get();
    if (wsClient) {
      wsClient.disconnect();
      set({ wsClient: null, wsConnected: false });
    }
    if (currentRoom) {
      invoke("destroy_tunnel", { roomId: currentRoom.id }).catch(() => {});
      set({
        currentRoom: null,
        messages: [],
        tunnelActive: false,
        virtualIp: null,
      });
    }
  },

  fetchRooms: async () => {
    const rooms = await api.rooms.list();
    set({ rooms });
  },

  createRoom: async (data) => {
    const room = await api.rooms.create(data);
    // Generate keypair — fallback to dummy if Tauri command unavailable
    let privateKey = "dummy-private-key";
    let publicKey = "dummy-public-key";
    try {
      [privateKey, publicKey] = await invoke<[string, string]>("generate_keypair");
    } catch { /* Phase 1: tunnel is scaffold, dummy keys OK */ }
    set({
      currentRoom: room,
      messages: [],
      publicKey,
      privateKey,
      virtualIp: "10.13.37.1",
    });
    // Only send WS join if connected
    const { wsClient, wsConnected } = get();
    if (wsClient && wsConnected) {
      wsClient.send("room:join", { roomId: room.id, publicKey });
    }
    return room;
  },

  joinRoom: async (roomId) => {
    // Generate keypair — fallback to dummy if Tauri command unavailable
    let privateKey = "dummy-private-key";
    let publicKey = "dummy-public-key";
    try {
      [privateKey, publicKey] = await invoke<[string, string]>("generate_keypair");
    } catch { /* Phase 1: tunnel is scaffold, dummy keys OK */ }
    set({ publicKey, privateKey });
    // Fetch room data via REST as fallback
    try {
      const room = await api.rooms.getById(roomId);
      set({ currentRoom: room, messages: [] });
      // Find our player entry for virtualIp
      const myPlayer = room.players?.find((p: any) => p.publicKey === publicKey);
      if (myPlayer) set({ virtualIp: myPlayer.virtualIp });
    } catch { /* will get state from WS */ }
    // Join via WebSocket for real-time updates
    const { wsClient, wsConnected } = get();
    if (wsClient && wsConnected) {
      wsClient.send("room:join", { roomId, publicKey });
    }
  },

  leaveRoom: () => {
    const { wsClient, currentRoom } = get();
    if (currentRoom && wsClient) {
      wsClient.send("room:leave", { roomId: currentRoom.id });
      invoke("destroy_tunnel", { roomId: currentRoom.id }).catch(() => {});
      set({
        currentRoom: null,
        messages: [],
        tunnelActive: false,
        virtualIp: null,
      });
    }
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
      const myPlayer = payload.players?.find(
        (p: RoomPlayer) => p.publicKey === get().publicKey,
      );
      if (myPlayer) set({ virtualIp: myPlayer.virtualIp });
      break;

    case "room:player-joined": {
      const room = get().currentRoom;
      if (!room) return;
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
              virtualIp: payload.virtualIp,
              publicKey: payload.publicKey,
              status: "CONNECTING" as const,
              joinedAt: new Date().toISOString(),
            },
          ],
        },
      });
      const { wsClient, publicKey } = get();
      if (wsClient && publicKey) {
        wsClient.send("peer:offer", {
          roomId: room.id,
          targetUserId: payload.userId,
          publicKey,
          endpoint: "",
        });
      }
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
      if (room) set({ currentRoom: { ...room, status: "PLAYING" as const } });
      break;
    }

    case "room:closed":
    case "room:kicked":
      invoke("destroy_tunnel", {
        roomId: get().currentRoom?.id || "",
      }).catch(() => {});
      set({
        currentRoom: null,
        messages: [],
        tunnelActive: false,
        virtualIp: null,
      });
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

    case "peer:signal":
      handlePeerSignal(payload, set, get);
      break;

    case "peer:connected": {
      const r = get().currentRoom;
      if (r) {
        set({
          currentRoom: {
            ...r,
            players: r.players.map((p) =>
              p.userId === payload.userId
                ? { ...p, status: "CONNECTED" as const }
                : p,
            ),
          },
        });
      }
      break;
    }

    case "error":
      console.error("WebSocket error:", payload.message);
      break;
  }
}

async function handlePeerSignal(
  payload: { fromUserId: string; publicKey: string; endpoint: string },
  set: any,
  get: () => RoomState,
) {
  const { currentRoom, privateKey, virtualIp } = get();
  if (!currentRoom || !privateKey || !virtualIp) return;

  try {
    await invoke("create_tunnel", {
      roomId: currentRoom.id,
      virtualIp,
      privateKey,
      peers: [
        {
          public_key: payload.publicKey,
          endpoint: payload.endpoint,
          virtual_ip: "",
        },
      ],
    });
    set({ tunnelActive: true });
  } catch (err) {
    console.error("Tunnel creation failed:", err);
  }
}
