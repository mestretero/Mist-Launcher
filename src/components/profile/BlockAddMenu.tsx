import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

const BLOCK_TYPES = [
  {
    type: "GAME_SHOWCASE",
    icon: "🎮",
    nameKey: "profile.blocks.gameShowcase",
    descKey: "profile.blocks.gameShowcaseDesc",
  },
  {
    type: "FAVORITE_GAME",
    icon: "⭐",
    nameKey: "profile.blocks.favoriteGame",
    descKey: "profile.blocks.favoriteGameDesc",
  },
  {
    type: "ACHIEVEMENTS",
    icon: "🏆",
    nameKey: "profile.blocks.achievements",
    descKey: "profile.blocks.achievementsDesc",
  },
  {
    type: "ACTIVITY",
    icon: "📊",
    nameKey: "profile.blocks.activity",
    descKey: "profile.blocks.activityDesc",
  },
  {
    type: "TEXT",
    icon: "📝",
    nameKey: "profile.blocks.text",
    descKey: "profile.blocks.textDesc",
  },
  {
    type: "SCREENSHOTS",
    icon: "📸",
    nameKey: "profile.blocks.screenshots",
    descKey: "profile.blocks.screenshotsDesc",
  },
  {
    type: "SOCIAL_LINKS",
    icon: "🔗",
    nameKey: "profile.blocks.socialLinks",
    descKey: "profile.blocks.socialLinksDesc",
  },
  {
    type: "STATS",
    icon: "📈",
    nameKey: "profile.blocks.stats",
    descKey: "profile.blocks.statsDesc",
  },
  {
    type: "COMMENT_WALL",
    icon: "💬",
    nameKey: "profile.blocks.commentWall",
    descKey: "profile.blocks.commentWallDesc",
  },
  {
    type: "REFERRAL",
    icon: "🎟️",
    nameKey: "profile.referralCode",
    descKey: "profile.blocks.referralDesc",
  },
];

interface BlockAddMenuProps {
  onAddBlock: (type: string) => void;
  currentBlockCount: number;
}

export function BlockAddMenu({ onAddBlock, currentBlockCount }: BlockAddMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxReached = currentBlockCount >= 20;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleAdd(type: string) {
    onAddBlock(type);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => !maxReached && setOpen((v) => !v)}
        disabled={maxReached}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
          maxReached
            ? "bg-[#1a1c23]/60 border border-dashed border-[#2a2e38] text-[#5e6673] cursor-not-allowed"
            : open
            ? "bg-[#1a9fff]/20 border border-[#1a9fff]/60 text-[#1a9fff]"
            : "bg-[#20232c]/80 border border-dashed border-[#3d4450] text-[#8f98a0] hover:border-[#1a9fff]/50 hover:text-[#1a9fff] hover:bg-[#1a9fff]/10"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-45" : ""}`}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {maxReached
          ? t("profile.blocks.maxBlocks")
          : t("profile.blocks.addBlock")}
      </button>

      {/* Dropdown */}
      {open && !maxReached && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-[#0f1115]/98 backdrop-blur-xl border border-[#2a2e38] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1a1c23] bg-[#161920]/80">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5e6673]">
              {t("profile.blocks.addBlock")}
            </p>
            <p className="text-[10px] text-[#3d4450] mt-0.5">
              {currentBlockCount} / 20
            </p>
          </div>

          {/* Block list */}
          <div className="max-h-80 overflow-y-auto py-1.5 custom-scrollbar">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                onClick={() => handleAdd(bt.type)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-[#1a9fff]/10 hover:text-white text-left transition-colors group"
              >
                <span className="text-xl flex-shrink-0 leading-none mt-0.5" role="img" aria-hidden>
                  {bt.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#c6d4df] group-hover:text-white transition-colors leading-tight">
                    {t(bt.nameKey)}
                  </p>
                  <p className="text-[11px] text-[#5e6673] group-hover:text-[#8f98a0] transition-colors mt-0.5 leading-snug">
                    {t(bt.descKey)}
                  </p>
                </div>
                {/* Chevron on hover */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[#1a9fff] ml-auto"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-[#1a1c23] bg-[#0a0c10]/60">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#3d4450]">
              {20 - currentBlockCount} {t("profile.blocks.addBlock").toLowerCase()} remaining
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
