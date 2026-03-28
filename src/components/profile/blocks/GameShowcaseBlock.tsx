import { useTranslation } from "react-i18next";

interface LibraryItem {
  id: string;
  title: string;
  coverUrl?: string;
  playTime?: number;
}

interface BlockProps {
  config: { gameIds: string[]; layout: "grid" | "list" };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  libraryItems?: LibraryItem[];
}

function GameCard({ item, layout }: { item: LibraryItem; layout: "grid" | "list" }) {
  if (layout === "list") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0c10] border border-[#2a2e38] hover:border-[#1a9fff]/40 transition-colors">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161920] flex-shrink-0">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#2a2e38]" />
          )}
        </div>
        <span className="text-sm font-semibold text-white truncate flex-1">{item.title}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2e38] hover:border-[#1a9fff]/40 transition-colors group">
      <div className="aspect-[3/4] bg-[#0a0c10] relative">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#2a2e38]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-2 bg-[#161920]">
        <p className="text-xs font-semibold text-white truncate">{item.title}</p>
      </div>
    </div>
  );
}

export function GameShowcaseBlock({ config, isEditing, onConfigChange, libraryItems = [] }: BlockProps) {
  const { t } = useTranslation();
  const gameIds: string[] = config.gameIds ?? [];
  const layout = config.layout ?? "grid";

  function toggleGame(id: string) {
    const current = gameIds.includes(id)
      ? gameIds.filter((g) => g !== id)
      : gameIds.length < 4
      ? [...gameIds, id]
      : gameIds;
    onConfigChange({ ...config, gameIds: current });
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        {/* Layout toggle */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
            {t("profile.blocks.showcaseLayout", "Layout")}
          </p>
          <div className="flex gap-2">
            {(["grid", "list"] as const).map((l) => (
              <button
                key={l}
                onClick={() => onConfigChange({ ...config, layout: l })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  layout === l
                    ? "bg-[#1a9fff] text-white"
                    : "bg-[#0a0c10] border border-[#2a2e38] text-[#8f98a0] hover:border-[#5e6673]"
                }`}
              >
                {t(`profile.blocks.showcaseLayout${l.charAt(0).toUpperCase() + l.slice(1)}`, l)}
              </button>
            ))}
          </div>
        </div>

        {/* Game picker */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
            {t("profile.blocks.showcasePick", "Select Games")} ({gameIds.length}/4)
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {libraryItems.length === 0 ? (
              <p className="text-xs text-[#5e6673]">
                {t("profile.blocks.showcaseNoLibrary", "No games in library.")}
              </p>
            ) : (
              libraryItems.map((item) => {
                const selected = gameIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleGame(item.id)}
                    disabled={!selected && gameIds.length >= 4}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selected
                        ? "bg-[#1a9fff]/10 border border-[#1a9fff]/40"
                        : "bg-[#0a0c10] border border-[#2a2e38] hover:border-[#5e6673] disabled:opacity-40"
                    }`}
                  >
                    <div className="w-7 h-7 rounded overflow-hidden bg-[#2a2e38] flex-shrink-0">
                      {item.coverUrl && (
                        <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="text-sm text-white truncate flex-1">{item.title}</span>
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  const selectedGames = gameIds
    .map((id) => libraryItems.find((item) => item.id === id))
    .filter(Boolean) as LibraryItem[];

  if (selectedGames.length === 0) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.showcaseEmpty", "No games selected.")}
      </p>
    );
  }

  return layout === "grid" ? (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {selectedGames.map((item) => (
        <GameCard key={item.id} item={item} layout="grid" />
      ))}
    </div>
  ) : (
    <div className="space-y-2">
      {selectedGames.map((item) => (
        <GameCard key={item.id} item={item} layout="list" />
      ))}
    </div>
  );
}
