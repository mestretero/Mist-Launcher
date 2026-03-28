import { useTranslation } from "react-i18next";

interface LibraryItem {
  id: string;
  title: string;
  coverUrl?: string;
  playTime?: number;
}

interface BlockProps {
  config: { gameId: string };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  libraryItems?: LibraryItem[];
}

function formatHours(minutes?: number): string {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  return `${h}h`;
}

export function FavoriteGameBlock({ config, isEditing, onConfigChange, libraryItems = [] }: BlockProps) {
  const { t } = useTranslation();
  const selectedGame = libraryItems.find((item) => item.id === config.gameId);

  if (isEditing) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
          {t("profile.blocks.favoriteGamePick", "Select Favorite Game")}
        </p>
        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {libraryItems.length === 0 ? (
            <p className="text-xs text-[#5e6673]">
              {t("profile.blocks.favoriteGameNoLibrary", "No games in library.")}
            </p>
          ) : (
            libraryItems.map((item) => {
              const selected = config.gameId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onConfigChange({ ...config, gameId: item.id })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selected
                      ? "bg-[#1a9fff]/10 border border-[#1a9fff]/40"
                      : "bg-[#0a0c10] border border-[#2a2e38] hover:border-[#5e6673]"
                  }`}
                >
                  <div className="w-8 h-8 rounded overflow-hidden bg-[#2a2e38] flex-shrink-0">
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
    );
  }

  if (!selectedGame) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.favoriteGameEmpty", "No game selected.")}
      </p>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#2a2e38] group">
      {/* Background blurred cover */}
      {selectedGame.coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${selectedGame.coverUrl})`, filter: "blur(16px) brightness(0.3)" }}
        />
      )}
      {!selectedGame.coverUrl && (
        <div className="absolute inset-0 bg-[#0a0c10]" />
      )}

      {/* Content */}
      <div className="relative flex items-center gap-5 p-5">
        {/* Cover */}
        <div className="w-24 h-32 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 shadow-2xl">
          {selectedGame.coverUrl ? (
            <img src={selectedGame.coverUrl} alt={selectedGame.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#2a2e38] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9fff] mb-1">
            {t("profile.blocks.favoriteGame", "Favorite Game")}
          </p>
          <h3 className="text-xl font-black text-white leading-tight">{selectedGame.title}</h3>
          {selectedGame.playTime != null && (
            <p className="text-sm text-[#8f98a0] mt-2">
              {formatHours(selectedGame.playTime)}{" "}
              {t("profile.blocks.favoriteGamePlayed", "played")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
