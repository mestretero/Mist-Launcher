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
  useAuthStore(); // Keep auth context active
  const { rooms, fetchRooms, createRoom } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("");

  useEffect(() => {
    fetchRooms();
  }, []);

  // Unique game names for filter pills
  const gameNames = useMemo(
    () => [...new Set(rooms.map((r) => r.gameName))].sort(),
    [rooms]
  );

  const languages = useMemo(
    () => [...new Set(rooms.map((r) => (r.config as any)?.language).filter(Boolean))].sort() as string[],
    [rooms]
  );

  // Sorted list: newest first
  const filtered = useMemo(() => {
    let list = gameFilter ? rooms.filter((r) => r.gameName === gameFilter) : rooms;
    if (languageFilter) list = list.filter((r) => (r.config as any)?.language === languageFilter);
    if (visibilityFilter) list = list.filter((r) => r.visibility === visibilityFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rooms, gameFilter, languageFilter, visibilityFilter]);

  async function handleCreate(data: any) {
    const room = await createRoom(data);
    setShowCreate(false);
    onNavigate("room", room.id);
  }

  return (
    <div className="min-h-full bg-[#0f1115]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ============ HEADER ============ */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {t("multiplayer.title")}
            </h1>
            <p className="text-sm text-[#67707b] mt-1.5">
              {t("multiplayer.subtitle", "Arkadaşlarınla birlikte oyna")}
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/90 text-white text-sm font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-[#1a9fff]/20 hover:shadow-[#1a9fff]/30"
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
            {t("multiplayer.createRoom")}
          </button>
        </div>

        {/* ============ GAME FILTER PILLS ============ */}
        {gameNames.length >= 2 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setGameFilter("")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                !gameFilter
                  ? "bg-[#1a9fff]/15 text-[#1a9fff] border border-[#1a9fff]/30 shadow-sm shadow-[#1a9fff]/10"
                  : "bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] hover:border-[#8f98a0]/30 hover:text-[#c6d4df]"
              }`}
            >
              {t("multiplayer.allGames")}
            </button>
            {gameNames.map((gn) => (
              <button
                key={gn}
                onClick={() => setGameFilter(gn === gameFilter ? "" : gn)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  gameFilter === gn
                    ? "bg-[#1a9fff]/15 text-[#1a9fff] border border-[#1a9fff]/30 shadow-sm shadow-[#1a9fff]/10"
                    : "bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] hover:border-[#8f98a0]/30 hover:text-[#c6d4df]"
                }`}
              >
                {gn}
              </button>
            ))}
          </div>
        )}

        {/* ============ LANGUAGE FILTER PILLS ============ */}
        {languages.length >= 2 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button onClick={() => setLanguageFilter("")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${!languageFilter ? "bg-[#1a9fff]/15 text-[#1a9fff] border border-[#1a9fff]/30" : "bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] hover:border-[#8f98a0]/30"}`}>
              {t("multiplayer.allLanguages", "Tüm Diller")}
            </button>
            {languages.map((lang) => (
              <button key={lang} onClick={() => setLanguageFilter(lang === languageFilter ? "" : lang)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${languageFilter === lang ? "bg-[#1a9fff]/15 text-[#1a9fff] border border-[#1a9fff]/30" : "bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] hover:border-[#8f98a0]/30"}`}>
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* ============ VISIBILITY FILTER ============ */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {([
            { key: "", label: t("multiplayer.allGames") },
            { key: "PUBLIC", label: t("room.visibility.public") },
            { key: "FRIENDS", label: t("room.visibility.friends") },
            { key: "SCHEDULED", label: t("room.visibility.scheduled") },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setVisibilityFilter(opt.key === visibilityFilter ? "" : opt.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                visibilityFilter === opt.key
                  ? "bg-[#1a9fff]/15 text-[#1a9fff] border border-[#1a9fff]/30 shadow-sm shadow-[#1a9fff]/10"
                  : "bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38] hover:border-[#8f98a0]/30 hover:text-[#c6d4df]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ============ ROOM GRID ============ */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => onNavigate("room", room.id)}
              />
            ))}
          </div>
        ) : (
          /* ============ EMPTY STATE ============ */
          <div className="flex flex-col items-center pt-16 pb-10">
            {/* Hero */}
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-[#1a9fff]/10 border border-[#1a9fff]/20 flex items-center justify-center mb-5 mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[#1a9fff]">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t("multiplayer.noRooms")}
              </h3>
              <p className="text-sm text-[#67707b] max-w-sm mx-auto">
                {t("multiplayer.noFriendsHosting")}
              </p>
            </div>

            {/* How it works — 3 step cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-10">
              {[
                {
                  step: "1",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1a9fff]">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  ),
                  title: t("multiplayer.step1Title", "Lobi Oluştur"),
                  desc: t("multiplayer.step1Desc", "Oyun adını yaz, bilgilerini gir ve lobini aç."),
                },
                {
                  step: "2",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1a9fff]">
                      <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  ),
                  title: t("multiplayer.step2Title", "Paylaş"),
                  desc: t("multiplayer.step2Desc", "Arkadaşların lobiyi görsün veya oda kodunu paylaş."),
                },
                {
                  step: "3",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1a9fff]">
                      <path d="M6 9l6 6 6-6" /><circle cx="12" cy="12" r="10" />
                    </svg>
                  ),
                  title: t("multiplayer.step3Title", "Birlikte Oyna"),
                  desc: t("multiplayer.step3Desc", "Lobideki sunucu bilgisiyle oyuna bağlan."),
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="relative bg-[#1a1c23]/40 border border-[#2a2e38] rounded-xl p-5 text-center group hover:border-[#1a9fff]/20 transition-colors"
                >
                  <div className="absolute top-3 left-3 text-[10px] font-black text-[#2a2e38]">
                    {s.step}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#1a9fff]/10 flex items-center justify-center mx-auto mb-3">
                    {s.icon}
                  </div>
                  <h4 className="text-sm font-bold text-[#c6d4df] mb-1">{s.title}</h4>
                  <p className="text-xs text-[#67707b] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-7 py-3 bg-[#1a9fff] hover:bg-[#1a9fff]/90 text-white text-sm font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-[#1a9fff]/20"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("multiplayer.createRoom")}
            </button>
          </div>
        )}

        {/* ============ CREATE MODAL ============ */}
        {showCreate && (
          <CreateRoomModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Room Card                                                         */
/* ------------------------------------------------------------------ */

function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const { t } = useTranslation();
  const isWaiting = room.status === "WAITING";
  const config = (room.config || {}) as Record<string, any>;
  const hasServer = Boolean(config.serverAddress);
  const initials = room.host.username.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group relative text-left w-full bg-[#1a1c23]/40 backdrop-blur border border-[#2a2e38] rounded-xl p-4 hover:border-[#1a9fff]/30 hover:bg-[#1a1c23]/60 transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-lg hover:shadow-[#1a9fff]/5"
    >
      {/* Top row: game badge + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="bg-[#1a9fff]/10 text-[#1a9fff] text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[140px]">
            {room.gameName}
          </span>
          {config.language && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1a1c23] text-[#8f98a0] border border-[#2a2e38]">
              {config.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasServer && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-emerald-400/60"
            >
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="18" r="1" fill="currentColor" />
            </svg>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                isWaiting
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                  : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]"
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wide ${
                isWaiting ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isWaiting
                ? t("room.status.waiting")
                : t("room.status.playing")}
            </span>
          </div>
        </div>
      </div>

      {/* Lobby name */}
      <h3 className="text-[15px] font-bold text-white truncate mb-2.5 group-hover:text-[#1a9fff] transition-colors">
        {room.name}
      </h3>

      {/* Scheduled time */}
      {config.scheduledStart && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-amber-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {new Date(config.scheduledStart as string).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {config.scheduledEnd && ` — ${new Date(config.scheduledEnd as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </div>
      )}

      {/* Description */}
      {config.description && (
        <p className="text-[11px] text-[#67707b] italic truncate mb-2">{config.description}</p>
      )}

      {/* Bottom row: players + host */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-[#8f98a0]">
          {/* Player count */}
          <div className="flex items-center gap-1.5">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[#67707b]"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>
              {room.players.length}/{room.maxPlayers}
            </span>
          </div>

          <span className="text-[#2a2e38]">&bull;</span>

          {/* Host info */}
          <div className="flex items-center gap-1.5">
            {room.host.avatarUrl ? (
              <img
                src={room.host.avatarUrl}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[7px] font-black text-[#c6d4df]">
                {initials}
              </div>
            )}
            <span className="text-[#8f98a0] truncate max-w-[100px]">
              {room.host.username}
            </span>
          </div>
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
          className="text-[#2a2e38] group-hover:text-[#1a9fff]/60 transition-colors flex-shrink-0"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}
