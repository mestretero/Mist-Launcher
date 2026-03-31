import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface CreateRoomData {
  gameName: string;
  name: string;
  maxPlayers: number;
  visibility: "PUBLIC" | "FRIENDS" | "SCHEDULED";
  serverAddress?: string;
  discordLink?: string;
  description?: string;
  durationHours: number;
  language: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (data: CreateRoomData) => void;
}

const DURATION_OPTIONS = [1, 2, 4, 8, 24];

const LANGUAGE_OPTIONS = ["TR", "EN", "ES", "DE", "FR", "RU", "PT", "JP", "KR", "ZH"];

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const { t } = useTranslation();

  const [gameName, setGameName] = useState("");
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [serverAddress, setServerAddress] = useState("");
  const [discordLink, setDiscordLink] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "FRIENDS" | "SCHEDULED">("PUBLIC");
  const [durationHours, setDurationHours] = useState(4);
  const [language, setLanguage] = useState("TR");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  const canSubmit = gameName.trim().length > 0 && name.trim().length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
      durationHours,
      language,
      scheduledStart: visibility === "SCHEDULED" && scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
      scheduledEnd: visibility === "SCHEDULED" && scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
    });
  }

  const visibilityOptions: { key: "PUBLIC" | "FRIENDS" | "SCHEDULED"; label: string }[] = [
    { key: "PUBLIC", label: t("room.visibility.public", "Herkes") },
    { key: "FRIENDS", label: t("room.visibility.friends", "Arkadaşlar") },
    { key: "SCHEDULED", label: t("room.visibility.scheduled", "Randevu") },
  ];

  const inputCls =
    "w-full px-3 py-2.5 bg-[#20232c]/80 border border-[#3d4450] rounded-lg text-sm text-[#c6d4df] placeholder:text-[#67707b] focus:border-[#1a9fff] focus:ring-1 focus:ring-[#1a9fff]/20 outline-none transition-colors";

  const labelCls =
    "block text-[10px] font-black uppercase tracking-widest text-[#67707b] mb-1.5";

  const activePillCls =
    "bg-[#1a9fff]/20 border border-[#1a9fff]/40 text-[#1a9fff] shadow-sm shadow-[#1a9fff]/10";

  const inactivePillCls =
    "bg-[#20232c]/80 border border-[#3d4450] text-[#8f98a0] hover:border-[#67707b] hover:text-[#c6d4df]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg mx-4 bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl shadow-xl ring-1 ring-white/5 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-1 shrink-0">
          <h2 className="text-lg font-bold text-[#c6d4df]">
            {t("multiplayer.createRoom", "Lobi Oluştur")}
          </h2>
          <p className="text-xs text-[#67707b] mt-0.5">
            {t("multiplayer.createRoomDesc", "Oyuncularla buluşmak için yeni bir lobi oluştur.")}
          </p>
        </div>

        {/* Form — scrollable */}
        <div className="px-6 py-4 space-y-3.5 overflow-y-auto min-h-0">
          {/* Row 1: Game name + Lobby name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t("multiplayer.gameName", "Oyun Adı")}
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
                {t("multiplayer.roomName", "Lobi Adı")}
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

          {/* Row 2: Max players + Server address */}
          <div className="flex gap-3">
            <div className="w-[100px] shrink-0">
              <label className={labelCls}>{t("multiplayer.maxPlayers", "Kişi")}</label>
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
            <div className="flex-1 min-w-0">
              <label className={labelCls}>{t("multiplayer.serverAddress", "Sunucu Adresi")}</label>
              <input
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                className={inputCls}
                placeholder="192.168.1.5:25565"
              />
            </div>
          </div>

          {/* Row 3: Discord link */}
          <div>
            <label className={labelCls}>{t("multiplayer.discordLink", "Discord Linki")}</label>
            <input
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              className={inputCls}
              placeholder="https://discord.gg/..."
            />
          </div>

          {/* Row 4: Description */}
          <div>
            <label className={labelCls}>{t("multiplayer.description", "Açıklama")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className={`${inputCls} resize-none`}
              placeholder={t(
                "multiplayer.descriptionPlaceholder",
                "Level 10+ Türkçe bilen aranıyor"
              )}
            />
          </div>

          {/* Row 5: Language selector */}
          <div>
            <label className={labelCls}>{t("multiplayer.language", "Dil")}</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#3d4450] scrollbar-track-transparent">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 ${
                    language === lang ? activePillCls : inactivePillCls
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Row 6: Duration selector */}
          <div>
            <label className={labelCls}>{t("multiplayer.duration", "Süre")}</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-150 ${
                    durationHours === h ? activePillCls : inactivePillCls
                  }`}
                >
                  {h}{t("multiplayer.hours", "s")}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#67707b] mt-1">
              {t("multiplayer.durationHint", "Lobi bu süre sonunda otomatik kapanır.")}
            </p>
          </div>

          {/* Row 7: Visibility / Type selector */}
          <div>
            <label className={labelCls}>
              {t("multiplayer.lobbyType", "Tür")}
            </label>
            <div className="flex gap-2">
              {visibilityOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVisibility(opt.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    visibility === opt.key ? activePillCls : inactivePillCls
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 8: Scheduled time fields (conditional) */}
          {visibility === "SCHEDULED" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t("multiplayer.scheduledStart", "Başlangıç")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t("multiplayer.scheduledEnd", "Bitiş")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 9: Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-[#2a2e38] shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#20232c]/80 border border-[#3d4450] text-[#8f98a0] hover:text-white hover:border-[#1a9fff]/40 transition-colors"
          >
            {t("common.cancel", "İptal")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1a9fff] hover:bg-[#1a9fff]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#1a9fff]/20"
          >
            {t("multiplayer.create", "Oluştur")}
          </button>
        </div>
      </div>
    </div>
  );
}
