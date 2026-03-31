import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
    wsConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleReady,
    kickPlayer,
  } = useRoomStore();

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      try {
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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isHost = currentRoom?.hostId === user?.id;
  const myPlayer = currentRoom?.players.find((p) => p.userId === user?.id);
  const isReady = myPlayer?.status === "READY";
  const config = (currentRoom?.config || {}) as Record<string, any>;

  function renderSystemMessage(msg: RoomMessage) {
    let text = msg.content;
    if (text.includes(":")) {
      const [action, username] = text.split(":");
      if (action === "player_joined") text = `${username} ${t("room.playerJoined", "lobiye katıldı")}`;
      else if (action === "player_left") text = `${username} ${t("room.playerLeft", "lobiden ayrıldı")}`;
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
        <p className="text-sm text-brand-500">{t("common.loading", "Yükleniyor...")}</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-brand-500">{t("room.roomClosed", "Bu lobi kapatılmış")}</p>
        <button onClick={() => onNavigate("multiplayer")} className="px-4 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-300 hover:border-brand-600 transition-colors">
          {t("gameDetail.back", "Geri Dön")}
        </button>
      </div>
    );
  }

  const emptySlots = Math.max(0, currentRoom.maxPlayers - currentRoom.players.length);
  const hasInfo = config.serverAddress || config.discordLink || config.description;

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
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                currentRoom.visibility === "PUBLIC" ? "text-emerald-400 bg-emerald-400/10" :
                currentRoom.visibility === "FRIENDS" ? "text-blue-400 bg-blue-400/10" :
                "text-amber-400 bg-amber-400/10"
              }`}>
                {currentRoom.visibility === "PUBLIC" ? t("room.visibility.public", "Herkes") :
                 currentRoom.visibility === "FRIENDS" ? t("room.visibility.friends", "Arkadaşlar") :
                 t("room.visibility.invite", "Davetli")}
              </span>
            </div>
            <span className="text-xs text-brand-500">{currentRoom.gameName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-600"}`} />
            <span className="text-[10px] text-brand-500">
              {wsConnected ? t("room.connected", "Bağlandı") : t("room.connecting", "Bağlanıyor...")}
            </span>
          </div>
          {isHost && (
            <button onClick={handleLeave}
              className="text-[10px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-md transition-colors">
              {t("room.closeRoom", "Odayı Kapat")}
            </button>
          )}
        </div>
      </div>

      {/* Info panel */}
      {hasInfo && (
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-brand-800/50 bg-brand-900/30">
          {config.serverAddress && (
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500 flex-shrink-0">
                <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/>
              </svg>
              <span className="text-xs text-brand-300 font-mono">{config.serverAddress}</span>
              <button onClick={() => copyToClipboard(config.serverAddress)}
                className="p-1 rounded hover:bg-brand-800 text-brand-500 hover:text-brand-300 transition-colors" title="Kopyala">
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </div>
          )}
          {config.discordLink && (
            <a href={config.discordLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discord
            </a>
          )}
          {config.description && (
            <span className="text-xs text-brand-400 italic truncate">{config.description}</span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Players */}
        <div className="w-[280px] flex-shrink-0 border-r border-brand-800 flex flex-col bg-brand-950/50">
          <div className="px-4 py-3 border-b border-brand-800">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-500">
              {t("room.players", "Oyuncular")} ({currentRoom.players.length}/{currentRoom.maxPlayers})
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
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-brand-800/30 border-dashed">
                <div className="w-8 h-8 rounded-md bg-brand-900/50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-700">
                    <circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  </svg>
                </div>
                <span className="text-xs text-brand-700">{t("room.emptySlot", "Boş slot")}</span>
              </div>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-brand-800 space-y-2">
            {!isHost && (
              <button onClick={() => toggleReady(!isReady)}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  isReady
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-brand-900 border border-brand-800 text-brand-300 hover:border-brand-600"
                }`}>
                {isReady ? t("room.ready", "Hazır") : t("room.notReady", "Hazır Değil")}
              </button>
            )}
            <button onClick={handleLeave} className="w-full py-2 rounded-lg text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              {isHost ? t("room.closeRoom", "Odayı Kapat") : t("room.leave", "Ayrıl")}
            </button>
          </div>
        </div>

        {/* Right panel: Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-brand-950/30">
          <div className="px-4 py-3 border-b border-brand-800">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-500">{t("room.chat", "Sohbet")}</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((msg) => {
              if (msg.isSystem) return renderSystemMessage(msg);
              const isMine = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <div className={`max-w-[70%] ${isMine ? "text-right" : ""}`}>
                    {!isMine && <span className="text-[10px] font-semibold text-brand-500 mb-0.5 block">{msg.username}</span>}
                    <div className={`inline-block px-3 py-1.5 rounded-lg text-sm ${isMine ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-200"}`}>
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

          <div className="p-3 border-t border-brand-800">
            <div className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={t("room.messagePlaceholder", "Mesaj yaz...")}
                className="flex-1 px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none" />
              <button onClick={handleSendMessage} disabled={!chatInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t("room.sendMessage", "Gönder")}
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

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-900/50 group transition-colors">
      <div className="relative flex-shrink-0">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white text-xs font-black">
            {initials}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-brand-950 ${
          player.status === "READY" ? "bg-emerald-400" : "bg-blue-400"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-brand-200 truncate">{player.user.username}</span>
          {isHost && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400">
              {t("room.host", "HOST")}
            </span>
          )}
        </div>
        <span className="text-[10px] text-brand-600">
          {player.status === "READY" ? t("room.ready", "Hazır") : t("room.connected", "Bağlandı")}
        </span>
      </div>
      {canKick && (
        <button onClick={onKick}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-all"
          title={t("room.kick", "At")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
