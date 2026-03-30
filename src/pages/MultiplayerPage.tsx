import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { CreateRoomModal } from "../components/CreateRoomModal";
import type { Room } from "../lib/types";

interface Props { onNavigate: (page: string, slug?: string) => void; }

export default function MultiplayerPage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { rooms, fetchRooms, createRoom } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchRooms(); }, []);

  const myRooms = rooms.filter((r) => r.hostId === user?.id || r.players.some((p) => p.userId === user?.id));
  const friendRooms = rooms.filter((r) => r.hostId !== user?.id && !r.players.some((p) => p.userId === user?.id));

  async function handleCreate(data: any) {
    const room = await createRoom(data);
    setShowCreate(false);
    onNavigate("room", room.id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-brand-100">{t("multiplayer.title")}</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors">
          + {t("multiplayer.createRoom")}
        </button>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-3">{t("multiplayer.myRooms")}</h2>
        {myRooms.length === 0 ? (
          <p className="text-sm text-brand-600">{t("multiplayer.noRooms")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myRooms.map((room) => <RoomCard key={room.id} room={room} onClick={() => onNavigate("room", room.id)} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-500 mb-3">{t("multiplayer.friendsHosting")}</h2>
        {friendRooms.length === 0 ? (
          <p className="text-sm text-brand-600">{t("multiplayer.noFriendsHosting")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {friendRooms.map((room) => <RoomCard key={room.id} room={room} onClick={() => onNavigate("room", room.id)} />)}
          </div>
        )}
      </section>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const { t } = useTranslation();
  const statusColor = room.status === "WAITING" ? "text-green-400" : "text-yellow-400";
  const statusBg = room.status === "WAITING" ? "bg-green-400/10" : "bg-yellow-400/10";
  const initials = room.host.username.slice(0, 2).toUpperCase();

  return (
    <button onClick={onClick} className="flex items-center gap-4 p-4 bg-brand-950 border border-brand-800 rounded-xl hover:border-brand-600 transition-colors text-left w-full">
      <div className="w-12 h-12 rounded-lg bg-brand-900 flex items-center justify-center text-xl flex-shrink-0">
        {room.game?.coverImageUrl ? <img src={room.game.coverImageUrl} alt="" className="w-full h-full rounded-lg object-cover" /> : "🎮"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-brand-100 truncate">{room.name}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusBg} ${statusColor}`}>{room.status}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-500">
          <span>{room.gameName}</span><span>•</span>
          <span>{t("room.playerCount", { current: room.players.length, max: room.maxPlayers })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {room.host.avatarUrl ? <img src={room.host.avatarUrl} alt="" className="w-8 h-8 rounded-md object-cover" /> :
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-black">{initials}</div>}
      </div>
    </button>
  );
}
