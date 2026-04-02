import { useTranslation } from "react-i18next";

interface PerfectGame {
  id: string;
  title: string;
  coverImageUrl: string;
  totalAchievements: number;
  completedAt: string | null;
}

interface BlockProps {
  config: { layout?: "grid" | "list" };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  perfectGames?: PerfectGame[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PerfectBadge() {
  return (
    <div className="absolute top-1.5 right-1.5 bg-yellow-500/90 text-black text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg">
      100%
    </div>
  );
}

export function PerfectGamesBlock({ config, isEditing, onConfigChange, perfectGames = [] }: BlockProps) {
  const { t } = useTranslation();
  const layout = config.layout ?? "grid";

  if (isEditing) {
    return (
      <div className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
          {t("profile.blocks.perfectGamesLayout", "Layout")}
        </p>
        <div className="flex gap-2">
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onConfigChange({ ...config, layout: mode })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                layout === mode
                  ? "bg-[#1a9fff] text-white"
                  : "bg-[#0a0c10] border border-[#2a2e38] text-[#8f98a0] hover:border-[#5e6673]"
              }`}
            >
              {mode === "grid" ? t("profile.blocks.grid", "Grid") : t("profile.blocks.list", "List")}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#5e6673]">
          {t("profile.blocks.perfectGamesHint", "Games where you've unlocked every achievement.")}
        </p>
      </div>
    );
  }

  if (perfectGames.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-3xl mb-2">🏆</div>
        <p className="text-sm text-[#5e6673] italic">
          {t("profile.blocks.perfectGamesEmpty", "No perfect games yet. Unlock all achievements in a game to showcase it here!")}
        </p>
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/70 mb-3">
          {t("profile.blocks.perfectGamesTitle", "Perfect Games")} — {perfectGames.length}
        </p>
        {perfectGames.map((game) => (
          <div key={game.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0c10] border border-[#2a2e38] hover:border-yellow-500/30 transition-colors">
            <img
              src={game.coverImageUrl}
              alt={game.title}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{game.title}</p>
              <p className="text-[11px] text-[#8f98a0]">
                {game.totalAchievements} {t("library.achievements", "achievements")}
                {game.completedAt && ` · ${formatDate(game.completedAt)}`}
              </p>
            </div>
            <div className="flex-shrink-0 bg-yellow-500/20 text-yellow-400 text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded">
              100%
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid layout
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/70 mb-3">
        {t("profile.blocks.perfectGamesTitle", "Perfect Games")} — {perfectGames.length}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {perfectGames.map((game) => (
          <div key={game.id} className="group relative">
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#2a2e38] hover:border-yellow-500/40 transition-colors">
              <img
                src={game.coverImageUrl}
                alt={game.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <PerfectBadge />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div>
                  <p className="text-xs font-bold text-white leading-tight">{game.title}</p>
                  <p className="text-[10px] text-yellow-400 font-bold mt-0.5">
                    {game.totalAchievements} ★
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
