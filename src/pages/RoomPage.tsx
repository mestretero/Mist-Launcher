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
    joinRoom,
    leaveRoom,
    closeRoom,
    sendMessage,
    toggleReady,
    kickPlayer,
  } = useRoomStore();

  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Join the room on mount
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Expiry countdown
  useEffect(() => {
    if (!currentRoom) return;
    const config = (currentRoom.config || {}) as Record<string, any>;
    const durationHours = config.durationHours as number | undefined;
    if (!durationHours) return;

    function update() {
      const expiresAt =
        new Date(currentRoom!.createdAt).getTime() +
        durationHours! * 60 * 60 * 1000;
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(null);
      } else {
        setExpired(false);
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${h}h ${m}m`);
      }
    }

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [currentRoom?.id, currentRoom?.createdAt]);

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

  function handleLeave() {
    leaveRoom();
    onNavigate("multiplayer");
  }

  async function handleClose() {
    await closeRoom();
    onNavigate("multiplayer");
  }

  async function handleCopy(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  const isHost = currentRoom?.hostId === user?.id;
  const myPlayer = currentRoom?.players.find((p) => p.userId === user?.id);
  const isReady = myPlayer?.status === "READY";

  const config = (currentRoom?.config || {}) as Record<string, any>;
  const serverAddress = config.serverAddress as string | undefined;
  const discordLink = config.discordLink as string | undefined;
  const description = config.description as string | undefined;
  const durationHours = config.durationHours as number | undefined;
  const scheduledStart = config.scheduledStart as string | undefined;
  const scheduledEnd = config.scheduledEnd as string | undefined;
  const language = config.language as string | undefined;
  const hasInfo = Boolean(
    serverAddress || discordLink || description || durationHours || scheduledStart || language
  );

  function renderSystemMessage(msg: RoomMessage) {
    let text = msg.content;
    if (text.includes(":")) {
      const [action, username] = text.split(":");
      if (action === "player_joined") {
        text = `${username} ${t("room.playerJoined")}`;
      } else if (action === "player_left") {
        text = `${username} ${t("room.playerLeft")}`;
      }
    }
    return (
      <div key={msg.id} className="flex justify-center py-1.5">
        <span className="text-[11px] text-[#67707b] italic bg-[#1a1c23]/40 px-3 py-1 rounded-full">
          {text}
        </span>
      </div>
    );
  }

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0f1115]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#1a9fff] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#8f98a0]">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  /* ---- Room closed / not found ---- */
  if (!currentRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0f1115]">
        <div className="w-16 h-16 rounded-2xl bg-[#1a1c23]/60 border border-[#2a2e38] flex items-center justify-center mb-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[#67707b]"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm text-[#8f98a0]">{t("room.roomClosed")}</p>
        <button
          onClick={() => onNavigate("multiplayer")}
          className="px-5 py-2 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-sm text-[#c6d4df] hover:border-[#1a9fff]/40 transition-colors"
        >
          {t("gameDetail.back")}
        </button>
      </div>
    );
  }

  const emptySlots = Math.max(
    0,
    currentRoom.maxPlayers - currentRoom.players.length
  );

  return (
    <div className="flex flex-col h-full bg-[#0f1115]">
      {/* ============ TOP BAR ============ */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[#1a1c23]/80 backdrop-blur-md border-b border-[#2a2e38] shadow-lg shadow-black/20">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button — just navigate, don't close the room */}
          <button
            onClick={() => onNavigate("multiplayer")}
            className="p-2 rounded-lg hover:bg-[#2a2e38] text-[#8f98a0] hover:text-white transition-colors flex-shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Room title + badges */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-white truncate">
                {currentRoom.name}
              </h1>
              <span className="text-[10px] font-mono text-[#8f98a0] bg-[#0f1115] px-2 py-0.5 rounded-md border border-[#2a2e38] flex-shrink-0">
                {currentRoom.code}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                  currentRoom.visibility === "PUBLIC"
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : currentRoom.visibility === "FRIENDS"
                    ? "text-[#1a9fff] bg-[#1a9fff]/10 border border-[#1a9fff]/20"
                    : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                }`}
              >
                {currentRoom.visibility === "PUBLIC"
                  ? t("room.visibility.public")
                  : currentRoom.visibility === "FRIENDS"
                  ? t("room.visibility.friends")
                  : t("room.visibility.scheduled")}
              </span>
            </div>
            <span className="text-xs text-[#67707b]">
              {currentRoom.gameName}
            </span>
          </div>
        </div>

        {/* Right side — just game name */}
        <span className="text-xs text-[#67707b] flex-shrink-0">{currentRoom.gameName}</span>
      </div>

      {/* ============ INFO PANEL ============ */}
      {hasInfo && (
        <div className="flex items-center gap-5 px-5 py-2.5 border-b border-[#2a2e38]/60 bg-[#1a1c23]/40 backdrop-blur-sm overflow-x-auto">
          {/* Server Address */}
          {serverAddress && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[#67707b]"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <circle cx="6" cy="6" r="1" fill="currentColor" />
                <circle cx="6" cy="18" r="1" fill="currentColor" />
              </svg>
              <span className="text-xs text-[#c6d4df] font-mono">
                {serverAddress}
              </span>
              <button
                onClick={() => handleCopy(serverAddress, "server")}
                className="p-1 rounded hover:bg-[#2a2e38] text-[#67707b] hover:text-[#c6d4df] transition-colors"
              >
                {copiedField === "server" ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-emerald-400"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Separator */}
          {serverAddress && (discordLink || description || durationHours) && (
            <div className="w-px h-4 bg-[#2a2e38] flex-shrink-0" />
          )}

          {/* Discord Link */}
          {discordLink && (
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#1a9fff] hover:text-[#1a9fff]/80 font-medium transition-colors flex-shrink-0"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="flex-shrink-0"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </a>
          )}

          {/* Separator */}
          {discordLink && (description || durationHours) && (
            <div className="w-px h-4 bg-[#2a2e38] flex-shrink-0" />
          )}

          {/* Description */}
          {description && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[#67707b] flex-shrink-0"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="text-xs text-[#8f98a0] truncate italic">
                {description}
              </span>
            </div>
          )}

          {/* Separator */}
          {description && durationHours && (
            <div className="w-px h-4 bg-[#2a2e38] flex-shrink-0" />
          )}

          {/* Expiry countdown */}
          {durationHours && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={expired ? "text-red-400" : "text-[#67707b]"}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {expired ? (
                <span className="text-[11px] font-semibold text-red-400">
                  {t("room.expired")}
                </span>
              ) : timeLeft ? (
                <span className="text-[11px] text-[#8f98a0]">
                  {t("room.expiresIn")}: {timeLeft}
                </span>
              ) : null}
            </div>
          )}

          {/* Scheduled time */}
          {scheduledStart && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-[11px] text-amber-400 font-medium">
                {new Date(scheduledStart).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {scheduledEnd && ` — ${new Date(scheduledEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
          )}

          {/* Language badge */}
          {language && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] flex-shrink-0">
              {language}
            </span>
          )}
        </div>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex flex-1 min-h-0">
        {/* ---- Left panel: Players ---- */}
        <div className="w-[280px] flex-shrink-0 border-r border-[#2a2e38] flex flex-col bg-[#0f1115]">
          <div className="px-4 py-3 border-b border-[#2a2e38]">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#67707b]">
              {t("room.players")} ({currentRoom.players.length}/
              {currentRoom.maxPlayers})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
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
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#2a2e38]/40 border-dashed"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1a1c23]/40 flex items-center justify-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-[#2a2e38]"
                  >
                    <circle cx="12" cy="7" r="4" />
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  </svg>
                </div>
                <span className="text-xs text-[#2a2e38]">
                  {t("room.emptySlot")}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-[#2a2e38] space-y-2">
            {!isHost && (
              <button
                onClick={() => toggleReady(!isReady)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isReady
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/10"
                    : "bg-[#1a1c23] border border-[#2a2e38] text-[#8f98a0] hover:border-[#1a9fff]/40 hover:text-[#c6d4df]"
                }`}
              >
                {isReady ? t("room.ready") : t("room.notReady")}
              </button>
            )}
            {isHost ? (
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition-all duration-200"
              >
                {t("room.closeRoom")}
              </button>
            ) : (
              <button
                onClick={handleLeave}
                className="w-full py-2 rounded-xl text-xs font-semibold text-[#67707b] hover:text-[#8f98a0] hover:bg-[#1a1c23] transition-all duration-200"
              >
                {t("room.leave")}
              </button>
            )}
          </div>
        </div>

        {/* ---- Right panel: Chat ---- */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f1115]/80">
          <div className="px-4 py-3 border-b border-[#2a2e38]">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#67707b]">
              {t("room.chat")}
            </h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-[#2a2e38]">
                  {t("room.noMessages", "Henuz mesaj yok. Selam ver!")}
                </p>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.isSystem) return renderSystemMessage(msg);

              const isMine = msg.userId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] ${isMine ? "text-right" : "text-left"}`}
                  >
                    {!isMine && (
                      <span className="text-[10px] font-semibold text-[#67707b] mb-1 block px-1">
                        {msg.username}
                      </span>
                    )}
                    <div
                      className={`inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? "bg-[#1a9fff] text-white rounded-br-md"
                          : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-[#67707b]/60 mt-1 block px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-[#2a2e38]">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("room.messagePlaceholder")}
                className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-sm text-[#c6d4df] placeholder:text-[#67707b]/50 focus:border-[#1a9fff]/50 focus:ring-1 focus:ring-[#1a9fff]/20 outline-none transition-all duration-200"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="px-4 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/90 text-white text-sm font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-[#1a9fff]/20"
              >
                {t("room.sendMessage")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Player Row                                                        */
/* ------------------------------------------------------------------ */

function PlayerRow({
  player,
  isHost,
  canKick,
  onKick,
}: {
  player: RoomPlayer;
  isHost: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation();
  const initials = player.user.username.slice(0, 2).toUpperCase();
  const avatarSrc = player.user.avatarUrl
    ? player.user.avatarUrl.startsWith("http")
      ? player.user.avatarUrl
      : `http://localhost:3001${player.user.avatarUrl}`
    : null;

  let ledColor = "bg-[#67707b]";
  let ledShadow = "";
  let statusText = "";

  if (player.status === "READY") {
    ledColor = "bg-emerald-400";
    ledShadow = "shadow-[0_0_4px_rgba(52,211,153,0.5)]";
    statusText = t("room.ready");
  } else if (player.status === "CONNECTING") {
    ledColor = "bg-amber-400 animate-pulse";
    ledShadow = "shadow-[0_0_4px_rgba(251,191,36,0.5)]";
    statusText = t("room.connecting");
  } else if (player.status === "CONNECTED") {
    ledColor = "bg-[#1a9fff]";
    ledShadow = "shadow-[0_0_4px_rgba(26,159,255,0.5)]";
    statusText = t("room.connected");
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#20232c]/60 group transition-colors">
      {/* Avatar with status LED */}
      <div className="relative flex-shrink-0">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/5"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1a9fff]/25 to-[#1a1c23] flex items-center justify-center text-white text-xs font-black ring-1 ring-white/5">
            {initials}
          </div>
        )}
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f1115] ${ledColor} ${ledShadow}`}
        />
      </div>

      {/* Username + HOST badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#c6d4df] truncate">
            {player.user.username}
          </span>
          {isHost && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#1a9fff]/15 text-[#1a9fff] flex-shrink-0 tracking-wider">
              {t("room.host")}
            </span>
          )}
        </div>
        {statusText && (
          <span className="text-[10px] text-[#67707b]">{statusText}</span>
        )}
      </div>

      {/* Kick button */}
      {canKick && (
        <button
          onClick={onKick}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/15 text-red-400/60 hover:text-red-400 transition-all duration-200"
          title={t("room.kick")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
