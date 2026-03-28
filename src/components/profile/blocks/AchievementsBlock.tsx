import { useTranslation } from "react-i18next";

interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  unlocked: boolean;
  unlockedAt?: string;
  rarity?: number; // 0-100, lower = rarer
}

interface BlockProps {
  config: { display: "recent" | "rarest"; count: number };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  achievements?: Achievement[];
}

function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function AchievementRow({ achievement }: { achievement: Achievement }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0c10] border border-[#2a2e38] hover:border-[#1a9fff]/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[#161920] border border-[#2a2e38] flex items-center justify-center flex-shrink-0">
        {achievement.iconUrl ? (
          <img src={achievement.iconUrl} alt={achievement.name} className="w-7 h-7 object-contain" />
        ) : (
          <TrophyIcon />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{achievement.name}</p>
        <p className="text-[11px] text-[#8f98a0] truncate">{achievement.description}</p>
      </div>
      {achievement.rarity != null && (
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673]">
            {achievement.rarity.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}

export function AchievementsBlock({ config, isEditing, onConfigChange, achievements = [] }: BlockProps) {
  const { t } = useTranslation();
  const display = config.display ?? "recent";
  const count = config.count ?? 5;

  if (isEditing) {
    return (
      <div className="space-y-4">
        {/* Display mode */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
            {t("profile.blocks.achievementsMode", "Display Mode")}
          </p>
          <div className="flex gap-2">
            {(["recent", "rarest"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onConfigChange({ ...config, display: mode })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  display === mode
                    ? "bg-[#1a9fff] text-white"
                    : "bg-[#0a0c10] border border-[#2a2e38] text-[#8f98a0] hover:border-[#5e6673]"
                }`}
              >
                {t(
                  `profile.blocks.achievementsMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
                  mode === "recent" ? "Recent" : "Rarest"
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Count slider */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
            {t("profile.blocks.achievementsCount", "Count")} ({count})
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={count}
            onChange={(e) => onConfigChange({ ...config, count: Number(e.target.value) })}
            className="w-full accent-[#1a9fff]"
          />
          <div className="flex justify-between text-[10px] text-[#5e6673] mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>
      </div>
    );
  }

  const unlockedAchievements = achievements.filter((a) => a.unlocked);

  const sorted =
    display === "recent"
      ? [...unlockedAchievements].sort(
          (a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime()
        )
      : [...unlockedAchievements].sort(
          (a, b) => (a.rarity ?? 100) - (b.rarity ?? 100)
        );

  const displayed = sorted.slice(0, count);

  if (displayed.length === 0) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.achievementsEmpty", "No achievements unlocked yet.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-3">
        {display === "recent"
          ? t("profile.blocks.achievementsRecent", "Recently Unlocked")
          : t("profile.blocks.achievementsRarest", "Rarest Achievements")}
      </p>
      {displayed.map((achievement) => (
        <AchievementRow key={achievement.id} achievement={achievement} />
      ))}
    </div>
  );
}
