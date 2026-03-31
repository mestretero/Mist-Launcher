import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import type { RoomPlayer, RoomMessage } from "../lib/types";

interface Props {
  roomId: string;
  onNavigate: (page: string, slug?: string) => void;
}

export default function RoomPage({ roomId, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    currentRoom,
    messages,
    tunnelActive,
    wsConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleReady,
    startGame,
    kickPlayer,
  } = useRoomStore();

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Join the room on mount
  useEffect(() => {
    async function init() {
      try {
        // If we don't have currentRoom or it's a different room, join
        if (!currentRoom || currentRoom.id !== roomId) {
          await joinRoom(roomId);
        }
      } catch (err) {
        console.error("Failed to join room:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [roomId]);

  // Auto-launch game when host starts
  useEffect(() => {
    if (currentRoom?.status === "PLAYING" && !isHost) {
      handleLaunchGame();
    }
  }, [currentRoom?.status]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSendMessage() {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function handleLeave() {
    await leaveRoom();
    onNavigate("multiplayer");
  }

  function buildLaunchArgs(template: string | null | undefined, ip: string, port: number): string[] {
    if (!template) return [];
    const resolved = template
      .replace(/\{ip\}/g, ip)
      .replace(/\{port\}/g, String(port));
    return resolved.split(/\s+/).filter(Boolean);
  }

  async function handleLaunchGame() {
    if (!currentRoom) return;
    // Signal room that game is starting (host only)
    if (isHost) startGame();

    // Try to find the game in local library and launch it
    try {
      const localGames = await invoke<any[]>("get_local_games");
      const gameName = currentRoom.gameName.toLowerCase();
      const match = localGames.find((g: any) =>
        g.title?.toLowerCase().includes(gameName) ||
        gameName.includes(g.title?.toLowerCase())
      );
      if (match?.exe_path) {
        const config = (currentRoom.config || {}) as Record<string, any>;
        const ip = config.hostVirtualIp || "10.13.37.1";
        const port = config.gamePort || currentRoom.port || 0;

        // Host: launch dedicated server binary first (if configured)
        if (isHost && config.serverFileName) {
          try {
            const serverPath = await invoke<string>("find_server_binary", {
              gameExePath: match.exe_path,
              serverFileName: config.serverFileName,
            });
            const serverArgs = buildLaunchArgs(config.hostLaunchArgs, ip, port);
            await invoke("start_dedicated_server", {
              gameId: match.id,
              exePath: serverPath,
              args: serverArgs,
              port: port,
            });
            // Give server a moment to start
            await new Promise((r) => setTimeout(r, 2000));
          } catch {
            // Server binary not found — game will launch without auto-server
          }
        }

        // Launch game client
        const template = isHost && !config.serverFileName
          ? config.hostLaunchArgs
          : isHost
            ? config.clientLaunchArgs  // Host with dedicated server connects as client
            : config.clientLaunchArgs;
        const args = buildLaunchArgs(template, ip, port);
        await invoke("launch_game", { gameId: match.id, exePath: match.exe_path, args });
      }
    } catch {
      // If auto-launch fails, user can manually start the game
    }
  }

  const isHost = currentRoom?.hostId === user?.id;
  const myPlayer = currentRoom?.players.find((p) => p.userId === user?.id);
  const isReady = myPlayer?.status === "READY";

  function renderSystemMessage(msg: RoomMessage) {
    let text = msg.content;
    // Parse system messages like "player_joined:username"
    if (text.includes(":")) {
      const [action, username] = text.split(":");
      if (action === "player_joined") {
        text = `${username} ${t("room.playerJoined")}`;
      } else if (action === "player_left") {
        text = `${username} ${t("room.playerLeft")}`;
      }
    }
    return (
      <div key={msg.id} className="text-center py-1">
        <span className="text-xs text-brand-600 italic">{text}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-brand-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-brand-500">{t("room.roomClosed")}</p>
        <button onClick={() => onNavigate("multiplayer")} className="px-4 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-300 hover:border-brand-600 transition-colors">
          {t("gameDetail.back")}
        </button>
      </div>
    );
  }

  const emptySlots = Math.max(0, currentRoom.maxPlayers - currentRoom.players.length);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-brand-800 bg-brand-950">
        <div className="flex items-center gap-4">
          <button onClick={handleLeave} className="p-1.5 rounded hover:bg-brand-800 text-brand-400 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-brand-100">{currentRoom.name}</h1>
              <span className="text-[10px] font-mono text-brand-500 bg-brand-900 px-2 py-0.5 rounded">{currentRoom.code}</span>
              {currentRoom.visibility === "FRIENDS" && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{t("room.visibility.friends")}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-brand-500 mt-0.5">
              <span>{currentRoom.gameName}</span>
              <span>•</span>
              <span>{t("room.hostType." + (currentRoom.hostType === "LAN_HOST" ? "lan" : "dedicated"))}</span>
              {currentRoom.port && <><span>•</span><span>:{currentRoom.port}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-600"}`} />
              <span className="text-[10px] text-brand-500">
                {wsConnected ? t("room.connected") : t("room.connecting")}
              </span>
            </div>
            {tunnelActive && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                <span className="text-[10px] text-brand-500">VPN</span>
              </div>
            )}
          </div>
          {/* Close room (host only) */}
          {isHost && (
            <button
              onClick={handleLeave}
              className="text-[10px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-md transition-colors"
            >
              {t("room.closeRoom", "Odayı Kapat")}
            </button>
          )}
        </div>
      </div>

      {/* Game info strip */}
      {currentRoom.game && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-brand-800/50 bg-brand-950/50">
          {currentRoom.game.coverImageUrl && (
            <img src={currentRoom.game.coverImageUrl} alt="" className="w-8 h-10 rounded object-cover" />
          )}
          <span className="text-sm font-semibold text-brand-200">{currentRoom.game.title}</span>
        </div>
      )}

      {/* Main content: player list (left) + chat (right) */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Players */}
        <div className="w-[280px] flex-shrink-0 border-r border-brand-800 flex flex-col bg-brand-950/50">
          <div className="px-4 py-3 border-b border-brand-800">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-500">
              {t("room.players")} ({currentRoom.players.length}/{currentRoom.maxPlayers})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {currentRoom.players.map((player) => (
              <PlayerRow
                key={player.userId}
                player={player}
                isHost={player.userId === currentRoom.hostId}
                canKick={isHost && player.userId !== user?.id}
                onKick={() => kickPlayer(player.userId)}
              />
            ))}

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-brand-800/30 border-dashed">
                <div className="w-8 h-8 rounded-md bg-brand-900/50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-700">
                    <circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  </svg>
                </div>
                <span className="text-xs text-brand-700">{t("room.emptySlot")}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="p-3 border-t border-brand-800 space-y-2">
            {isHost && (
              <button onClick={handleLaunchGame} className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                {t("room.startGame")}
              </button>
            )}
            {!isHost && (
              <button onClick={() => toggleReady(!isReady)}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  isReady
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-brand-900 border border-brand-800 text-brand-300 hover:border-brand-600"
                }`}>
                {isReady ? `✓ ${t("room.ready")}` : t("room.notReady")}
              </button>
            )}
            <button onClick={handleLeave} className="w-full py-2 rounded-lg text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              {isHost ? t("room.closeRoom", "Odayı Kapat") : t("room.leave")}
            </button>
          </div>
        </div>

        {/* Right panel: Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-brand-950/30">
          <div className="px-4 py-3 border-b border-brand-800">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-500">{t("room.chat")}</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((msg) => {
              if (msg.isSystem) return renderSystemMessage(msg);

              const isMine = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <div className={`max-w-[70%] ${isMine ? "text-right" : ""}`}>
                    {!isMine && (
                      <span className="text-[10px] font-semibold text-brand-500 mb-0.5 block">{msg.username}</span>
                    )}
                    <div className={`inline-block px-3 py-1.5 rounded-lg text-sm ${
                      isMine ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-200"
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-brand-700 mt-0.5 block">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-brand-800">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("room.messagePlaceholder")}
                className="flex-1 px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none"
              />
              <button onClick={handleSendMessage} disabled={!chatInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t("room.sendMessage")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ player, isHost, canKick, onKick }: {
  player: RoomPlayer;
  isHost: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation();
  const initials = player.user.username.slice(0, 2).toUpperCase();
  const avatarSrc = player.user.avatarUrl
    ? (player.user.avatarUrl.startsWith("http") ? player.user.avatarUrl : `http://localhost:3001${player.user.avatarUrl}`)
    : null;

  let statusText = "";
  let ledColor = "bg-gray-600";
  let ledAnim = "";
  if (player.status === "READY") {
    ledColor = "bg-emerald-400";
    statusText = t("room.ready");
  } else if (player.status === "CONNECTING") {
    ledColor = "bg-amber-400";
    ledAnim = "animate-pulse";
    statusText = t("room.connecting");
  } else if (player.status === "CONNECTED") {
    ledColor = "bg-blue-400";
    statusText = t("room.connected");
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-900/50 group transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white text-xs font-black">
            {initials}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-brand-950 ${ledColor} ${ledAnim}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-brand-200 truncate">{player.user.username}</span>
          {isHost && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400">
              {t("room.host")}
            </span>
          )}
        </div>
        {statusText && (
          <span className="text-[10px] text-brand-600">{statusText}</span>
        )}
      </div>

      {/* Kick button */}
      {canKick && (
        <button onClick={onKick}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-all"
          title={t("room.kick")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
