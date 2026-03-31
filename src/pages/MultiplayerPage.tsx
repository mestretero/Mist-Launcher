import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { CreateRoomModal } from "../components/CreateRoomModal";
import type { Room } from "../lib/types";

interface Props {
  onNavigate: (page: string, slug?: string) => void;
}

export default function MultiplayerPage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { rooms, fetchRooms, createRoom, wsConnected } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>("");

  useEffect(() => {
    fetchRooms();
  }, []);

  // Unique game names for filter pills
  const gameNames = useMemo(
    () => [...new Set(rooms.map((r) => r.gameName))].sort(),
    [rooms]
  );

  // Single sorted list: newest first
  const filtered = useMemo(() => {
    const list = gameFilter ? rooms.filter((r) => r.gameName === gameFilter) : rooms;
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rooms, gameFilter]);

  async function handleCreate(data: any) {
    const room = await createRoom(data);
    setShowCreate(false);
    onNavigate("room", room.id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t("multiplayer.title", "\u00C7ok Oyunculu")}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-brand-600"
              }`}
            />
            <span className={`text-xs ${wsConnected ? "text-emerald-400" : "text-brand-500"}`}>
              {wsConnected
                ? t("room.connected", "Ba\u011Fl\u0131")
                : t("room.connecting", "Ba\u011Flan\u0131yor...")}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all duration-150 hover:scale-[1.02] shadow-lg shadow-emerald-900/30"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("multiplayer.createRoom", "Lobi Olu\u015Ftur")}
        </button>
      </div>

      {/* Game filter pills */}
      {gameNames.length >= 2 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setGameFilter("")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              !gameFilter
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                : "bg-brand-900 text-brand-400 border border-brand-800 hover:border-brand-600"
            }`}
          >
            {t("multiplayer.allGames", "T\u00FCm\u00FC")}
          </button>
          {gameNames.map((gn) => (
            <button
              key={gn}
              onClick={() => setGameFilter(gn === gameFilter ? "" : gn)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                gameFilter === gn
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "bg-brand-900 text-brand-400 border border-brand-800 hover:border-brand-600"
              }`}
            >
              {gn}
            </button>
          ))}
        </div>
      )}

      {/* Room list */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((room) => (
            <RoomTile
              key={room.id}
              room={room}
              currentUserId={user?.id}
              onClick={() => onNavigate("room", room.id)}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center mb-6">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-brand-700"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-brand-200 mb-2">
            {t("multiplayer.noRooms", "Hen\u00FCz lobi yok")}
          </h3>
          <p className="text-sm text-brand-500 mb-6 max-w-xs">
            {t(
              "multiplayer.noRoomsDesc",
              "Arkada\u015Flar\u0131nla oynamak i\u00E7in ilk lobiyi sen olu\u015Ftur!"
            )}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all duration-150 hover:scale-[1.02] shadow-lg shadow-emerald-900/30"
          >
            {t("multiplayer.createRoom", "Lobi Olu\u015Ftur")}
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

/* ---- Room tile (inline, lightweight) ---- */

function RoomTile({
  room,
  currentUserId,
  onClick,
}: {
  room: Room;
  currentUserId?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isWaiting = room.status === "WAITING";
  const initials = room.host.username.slice(0, 2).toUpperCase();
  const isMine =
    room.hostId === currentUserId ||
    room.players.some((p) => p.userId === currentUserId);

  const config = (room.config || {}) as Record<string, any>;
  const hasServer = Boolean(config.serverAddress);

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 p-4 rounded-xl border text-left w-full transition-all duration-150 hover:scale-[1.01] ${
        isMine
          ? "bg-indigo-500/[0.04] border-indigo-500/15 hover:border-indigo-500/30"
          : "bg-brand-950/60 border-brand-800/60 hover:border-brand-700"
      }`}
    >
      {/* Left: game cover or icon */}
      <div className="w-12 h-12 rounded-lg bg-brand-900/80 border border-brand-800/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {room.game?.coverImageUrl ? (
          <img src={room.game.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-brand-600"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M12 6V2M7 12h2M15 12h2M10 16h4" />
          </svg>
        )}
      </div>

      {/* Center: info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Game badge */}
          <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md truncate max-w-[120px]">
            {room.gameName}
          </span>
          {/* Status badge */}
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wide ${
              isWaiting
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {isWaiting
              ? t("room.status.waiting", "Bekliyor")
              : t("room.status.playing", "Oyunda")}
          </span>
          {/* Server indicator */}
          {hasServer && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-500 flex-shrink-0"
            >
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="18" r="1" fill="currentColor" />
            </svg>
          )}
        </div>

        {/* Lobby name */}
        <h3 className="text-sm font-bold text-brand-100 truncate mb-1">{room.name}</h3>

        {/* Meta row */}
        <div className="flex items-center gap-2.5 text-xs text-brand-500">
          {/* Player count */}
          <div className="flex items-center gap-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>
              {room.players.length}/{room.maxPlayers}
            </span>
          </div>
          <span className="text-brand-800">|</span>
          {/* Host */}
          <span className="text-brand-400 truncate">{room.host.username}</span>
        </div>
      </div>

      {/* Right: host avatar */}
      <div className="flex-shrink-0">
        {room.host.avatarUrl ? (
          <img
            src={room.host.avatarUrl}
            alt=""
            className="w-9 h-9 rounded-lg object-cover border border-brand-800/50"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600/30 to-brand-800 flex items-center justify-center text-brand-300 text-xs font-black border border-brand-800/50">
            {initials}
          </div>
        )}
      </div>

      {/* Chevron */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-brand-700 group-hover:text-brand-400 transition-colors flex-shrink-0"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
