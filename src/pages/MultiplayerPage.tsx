import { useState, useEffect } from "react";
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

  // Get unique game names for filter dropdown
  const gameNames = [...new Set(rooms.map((r) => r.gameName))].sort();

  const filtered = gameFilter
    ? rooms.filter((r) => r.gameName === gameFilter)
    : rooms;

  const myRooms = filtered.filter(
    (r) =>
      r.hostId === user?.id ||
      r.players.some((p) => p.userId === user?.id),
  );
  const friendRooms = filtered.filter(
    (r) =>
      r.hostId !== user?.id &&
      !r.players.some((p) => p.userId === user?.id),
  );

  async function handleCreate(data: any) {
    const room = await createRoom(data);
    setShowCreate(false);
    onNavigate("room", room.id);
  }

  const allEmpty = myRooms.length === 0 && friendRooms.length === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t("multiplayer.title")}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <div className={`flex items-center gap-1.5 text-xs ${wsConnected ? "text-emerald-400" : "text-gray-500"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-gray-600"}`} />
              {wsConnected ? "Online" : "Offline"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-emerald-900/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("multiplayer.createRoom")}
        </button>
      </div>

      {/* Game Filter */}
      {gameNames.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setGameFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !gameFilter ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800 hover:border-brand-600"
            }`}
          >
            {t("multiplayer.allGames", "Tümü")}
          </button>
          {gameNames.map((name) => (
            <button
              key={name}
              onClick={() => setGameFilter(name === gameFilter ? "" : name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                gameFilter === name ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800 hover:border-brand-600"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {allEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#12151a] border border-[#1e2128] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2a2e38" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{t("multiplayer.noRooms")}</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            {t("multiplayer.noFriendsHosting")}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-[#1e2128] hover:bg-[#282c34] text-gray-200 text-sm font-semibold rounded-xl border border-[#2e323a] transition-colors"
          >
            {t("multiplayer.createRoom")}
          </button>
        </div>
      )}

      {/* My Rooms */}
      {myRooms.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-500 mb-4">
            {t("multiplayer.myRooms")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isOwn
                onClick={() => onNavigate("room", room.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Friends Hosting */}
      {friendRooms.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-500 mb-4">
            {t("multiplayer.friendsHosting")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {friendRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => onNavigate("room", room.id)}
              />
            ))}
          </div>
        </section>
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function RoomCard({ room, onClick, isOwn }: { room: Room; onClick: () => void; isOwn?: boolean }) {
  const { t } = useTranslation();
  const isWaiting = room.status === "WAITING";
  const initials = room.host.username.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all text-left w-full hover:scale-[1.01] ${
        isOwn
          ? "bg-emerald-500/[0.03] border-emerald-500/10 hover:border-emerald-500/25"
          : "bg-[#0c0e14] border-[#1e2128] hover:border-[#3a3e48]"
      }`}
    >
      {/* Game Cover */}
      <div className="w-14 h-14 rounded-lg bg-[#12151a] flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden border border-[#1e2128]">
        {room.game?.coverImageUrl ? (
          <img
            src={room.game.coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2a2e38" strokeWidth="1.5">
            <path d="M6 12h4m4 0h4M6 12a6 6 0 1112 0 6 6 0 01-12 0zm0 0H2m20 0h-2" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold text-white truncate">{room.name}</span>
          <span
            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider ${
              isWaiting
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {isWaiting ? t("room.status.waiting", "Waiting") : t("room.status.playing", "In Game")}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-gray-400">{room.gameName}</span>
          <span className="text-[#1e2128]">|</span>
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>
              {room.players.length}/{room.maxPlayers}
            </span>
          </div>
          {room.port && (
            <>
              <span className="text-[#1e2128]">|</span>
              <span>:{room.port}</span>
            </>
          )}
        </div>
      </div>

      {/* Host Avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right mr-1 hidden sm:block">
          <span className="text-[10px] text-gray-600 block">host</span>
          <span className="text-xs text-gray-400 font-medium">{room.host.username}</span>
        </div>
        {room.host.avatarUrl ? (
          <img
            src={room.host.avatarUrl}
            alt=""
            className="w-9 h-9 rounded-lg object-cover border border-[#1e2128]"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2a2e38] to-[#1e2128] flex items-center justify-center text-gray-400 text-xs font-black">
            {initials}
          </div>
        )}
      </div>

      {/* Join arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-gray-600 group-hover:text-gray-300 transition-colors flex-shrink-0"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
