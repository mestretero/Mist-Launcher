import { useState } from "react";
import { useTranslation } from "react-i18next";

interface CreateRoomData {
  gameName: string;
  name: string;
  maxPlayers: number;
  visibility: "PUBLIC" | "FRIENDS" | "INVITE";
  serverAddress?: string;
  discordLink?: string;
  description?: string;
}

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (data: CreateRoomData) => void;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const { t } = useTranslation();

  const [gameName, setGameName] = useState("");
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [serverAddress, setServerAddress] = useState("");
  const [discordLink, setDiscordLink] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "FRIENDS" | "INVITE">("PUBLIC");

  const canSubmit = gameName.trim().length > 0 && name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onCreate({
      gameName: gameName.trim(),
      name: name.trim(),
      maxPlayers,
      visibility,
      serverAddress: serverAddress.trim() || undefined,
      discordLink: discordLink.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  const visibilityOptions: { key: "PUBLIC" | "FRIENDS" | "INVITE"; label: string }[] = [
    { key: "PUBLIC", label: t("room.visibility.public", "Herkes") },
    { key: "FRIENDS", label: t("room.visibility.friends", "Arkada\u015Flar") },
    { key: "INVITE", label: t("room.visibility.invite", "Davetli") },
  ];

  const inputCls =
    "w-full px-3 py-2.5 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 placeholder:text-brand-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-colors";

  const labelCls =
    "block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl bg-brand-950 border border-brand-800/60 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-1">
          <h2 className="text-lg font-bold text-brand-100">
            {t("multiplayer.createRoom", "Lobi Olu\u015Ftur")}
          </h2>
          <p className="text-xs text-brand-500 mt-0.5">
            {t("multiplayer.createRoomDesc", "Oyuncularla bulu\u015Fmak i\u00E7in yeni bir lobi olu\u015Ftur.")}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-3.5">
          {/* Row: Game name + Lobby name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t("multiplayer.gameName", "Oyun Ad\u0131")}
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className={inputCls}
                placeholder="Minecraft, Terraria..."
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("multiplayer.roomName", "Lobi Ad\u0131")}
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Survival oynayalim"
              />
            </div>
          </div>

          {/* Row: Max players + Server address */}
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div>
              <label className={labelCls}>{t("multiplayer.maxPlayers", "Max Oyuncu")}</label>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) =>
                  setMaxPlayers(Math.min(32, Math.max(2, Number(e.target.value) || 2)))
                }
                min={2}
                max={32}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("multiplayer.serverAddress", "Sunucu Adresi")}</label>
              <input
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                className={inputCls}
                placeholder="192.168.1.5:25565"
              />
            </div>
          </div>

          {/* Discord link */}
          <div>
            <label className={labelCls}>{t("multiplayer.discordLink", "Discord Linki")}</label>
            <input
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              className={inputCls}
              placeholder="https://discord.gg/..."
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>{t("multiplayer.description", "A\u00E7\u0131klama")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={300}
              className={`${inputCls} resize-none`}
              placeholder={t(
                "multiplayer.descriptionPlaceholder",
                "Level 10+ T\u00FCrk\u00E7e bilen aran\u0131yor"
              )}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className={labelCls}>
              {t("multiplayer.visibility", "Kimler Kat\u0131labilir?")}
            </label>
            <div className="flex gap-2">
              {visibilityOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVisibility(opt.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    visibility === opt.key
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                      : "bg-brand-900 text-brand-400 border border-brand-800 hover:border-brand-600 hover:text-brand-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-brand-800/40">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-brand-400 bg-brand-900 border border-brand-800 hover:border-brand-600 hover:text-brand-300 transition-colors"
          >
            {t("common.cancel", "\u0130ptal")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-600/25"
          >
            {t("multiplayer.create", "Olu\u015Ftur")}
          </button>
        </div>
      </div>
    </div>
  );
}
