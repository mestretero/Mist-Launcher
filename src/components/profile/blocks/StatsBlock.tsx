import { useTranslation } from "react-i18next";

interface BlockProps {
  config: { show: string[] };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  stats?: { games: number; hours: number; achievements: number };
}

const ALL_STATS = ["games", "hours", "achievements"] as const;
type StatKey = (typeof ALL_STATS)[number];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#0a0c10] border border-[#2a2e38]">
      <span className="text-2xl font-black text-white tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mt-1">
        {label}
      </span>
    </div>
  );
}

export function StatsBlock({ config, isEditing, onConfigChange, stats }: BlockProps) {
  const { t } = useTranslation();

  const shown: string[] = config.show ?? ALL_STATS.slice();

  function toggleStat(key: string) {
    const current = shown.includes(key)
      ? shown.filter((k) => k !== key)
      : [...shown, key];
    onConfigChange({ ...config, show: current });
  }

  const statLabels: Record<StatKey, string> = {
    games: t("profile.games", "Games"),
    hours: t("profile.hours", "Hours"),
    achievements: t("profile.blocks.achievements", "Achievements"),
  };

  if (isEditing) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-3">
          {t("profile.blocks.statsShow", "Show Stats")}
        </p>
        <div className="space-y-2">
          {ALL_STATS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  shown.includes(key)
                    ? "bg-[#1a9fff] border-[#1a9fff]"
                    : "bg-transparent border-[#2a2e38] group-hover:border-[#5e6673]"
                }`}
                onClick={() => toggleStat(key)}
              >
                {shown.includes(key) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline
                      points="1.5,5 4,7.5 8.5,2.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className="text-sm text-[#c6d4df]"
                onClick={() => toggleStat(key)}
              >
                {statLabels[key]}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  const displayStats = (stats
    ? ALL_STATS.filter((k) => shown.includes(k)).map((k) => ({
        key: k,
        label: statLabels[k],
        value: stats[k],
      }))
    : []);

  if (displayStats.length === 0) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.statsEmpty", "No stats selected.")}
      </p>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${displayStats.length}, minmax(0, 1fr))`,
      }}
    >
      {displayStats.map(({ key, label, value }) => (
        <StatCard key={key} label={label} value={value} />
      ))}
    </div>
  );
}
