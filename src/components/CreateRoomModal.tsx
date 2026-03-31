import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { GameHostingProfile } from "../lib/types";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (data: { gameName: string; name: string; maxPlayers: number; hostType: "LAN_HOST" | "DEDICATED"; port?: number; visibility?: "FRIENDS" | "INVITE" | "PUBLIC"; hostLaunchArgs?: string; clientLaunchArgs?: string; }) => void;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<GameHostingProfile[]>([]);
  const [gameName, setGameName] = useState("");
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [hostType, setHostType] = useState<"LAN_HOST" | "DEDICATED">("LAN_HOST");
  const [port, setPort] = useState<number | undefined>();
  const [visibility, setVisibility] = useState<"FRIENDS" | "INVITE" | "PUBLIC">("FRIENDS");
  const [selectedProfile, setSelectedProfile] = useState<GameHostingProfile | null>(null);

  useEffect(() => { api.hostingProfiles.list().then(setProfiles).catch(() => {}); }, []);

  function handleProfileSelect(profile: GameHostingProfile) {
    setSelectedProfile(profile);
    setGameName(profile.gameName);
    setPort(profile.port);
    setHostType(profile.hostType);
    setName(`${profile.gameName} Lobby`);
  }

  function handleSubmit() {
    if (!gameName.trim() || !name.trim()) return;
    onCreate({
      gameName: gameName.trim(),
      name: name.trim(),
      maxPlayers,
      hostType,
      port,
      visibility,
      hostLaunchArgs: selectedProfile?.hostLaunchArgs || undefined,
      clientLaunchArgs: selectedProfile?.clientLaunchArgs || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-brand-950 border border-brand-800 p-6">
        <h2 className="text-lg font-bold text-brand-100 mb-4">{t("multiplayer.createRoom")}</h2>

        {/* Quick select profiles */}
        {profiles.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">{t("multiplayer.selectGame")}</label>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button key={p.id} onClick={() => handleProfileSelect(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${selectedProfile?.id === p.id ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-300 border border-brand-800 hover:border-brand-600"}`}>
                  {p.gameName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game name */}
        <div className="mb-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.gameName")}</label>
          <input value={gameName} onChange={(e) => setGameName(e.target.value)}
            className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none" placeholder="Minecraft, Terraria..." />
        </div>

        {/* Room name */}
        <div className="mb-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.roomName")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none" placeholder="Survival birlikte oynayalım" />
        </div>

        {/* Max players + Port */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.maxPlayers")}</label>
            <input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} min={2} max={32}
              className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.port")}</label>
            <input type="number" value={port || ""} onChange={(e) => setPort(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 focus:border-indigo-500 outline-none" placeholder="25565" />
          </div>
        </div>

        {/* Host type */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.hostType")}</label>
          <div className="flex gap-2">
            <button onClick={() => setHostType("LAN_HOST")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${hostType === "LAN_HOST" ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800"}`}>
              {t("room.hostType.lan")}
            </button>
            <button onClick={() => setHostType("DEDICATED")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${hostType === "DEDICATED" ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800"}`}>
              {t("room.hostType.dedicated")}
            </button>
          </div>
        </div>

        {/* Visibility */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">{t("multiplayer.visibility", "Kimler Katılabilir?")}</label>
          <div className="flex gap-2">
            <button onClick={() => setVisibility("PUBLIC")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${visibility === "PUBLIC" ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800"}`}>
              {t("room.visibility.public", "Herkes")}
            </button>
            <button onClick={() => setVisibility("FRIENDS")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${visibility === "FRIENDS" ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800"}`}>
              {t("room.visibility.friends", "Arkadaşlar")}
            </button>
            <button onClick={() => setVisibility("INVITE")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${visibility === "INVITE" ? "bg-indigo-600 text-white" : "bg-brand-900 text-brand-400 border border-brand-800"}`}>
              {t("room.visibility.invite", "Davetli")}
            </button>
          </div>
        </div>

        {/* Setup instructions */}
        {selectedProfile?.setupInstructions && (
          <div className="mb-4 p-3 bg-brand-900/50 border border-brand-800 rounded-lg">
            <p className="text-xs text-brand-400">{selectedProfile.setupInstructions}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-brand-400 bg-brand-900 border border-brand-800 hover:border-brand-600 transition-colors">
            {t("common.cancel")}
          </button>
          <button onClick={handleSubmit} disabled={!gameName.trim() || !name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {t("multiplayer.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
