import { useTranslation } from "react-i18next";

interface RecentlyPlayedItem {
  title: string;
  coverUrl?: string;
  playTime: number;
  lastPlayed: string;
}

interface BlockProps {
  config: { count: number };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  recentlyPlayed?: RecentlyPlayedItem[];
}

function formatRelativeTime(dateStr: string, t: (k: string, fb: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return t("profile.blocks.activityDaysAgo", "{{count}} days ago", { count: days });
  if (hours > 0) return t("profile.blocks.activityHoursAgo", "{{count}}h ago", { count: hours });
  return t("profile.blocks.activityJustNow", "Just now");
}

function formatHours(minutes: number, t: (k: string, fb: string, opts?: any) => string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("profile.blocks.activityHoursMin", "{{h}}h {{m}}m", { h, m });
  return t("profile.blocks.activityMinutes", "{{m}}m", { m });
}

export function ActivityBlock({ config, isEditing, onConfigChange, recentlyPlayed = [] }: BlockProps) {
  const { t } = useTranslation();
  const count = config.count ?? 5;

  if (isEditing) {
    return (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5e6673] mb-2">
          {t("profile.blocks.activityCount", "Items to show")} ({count})
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
    );
  }

  const items = recentlyPlayed.slice(0, count);

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#5e6673] italic">
        {t("profile.blocks.activityEmpty", "No recent activity.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 group">
          {/* Timeline dot */}
          <div className="relative flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1a9fff] ring-2 ring-[#1a9fff]/20 flex-shrink-0" />
            {i < items.length - 1 && (
              <div className="w-px flex-1 bg-[#2a2e38] absolute top-3 bottom-0 translate-y-1" style={{ height: "calc(100% + 12px)" }} />
            )}
          </div>

          {/* Cover */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#0a0c10] border border-[#2a2e38] flex-shrink-0">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
            <p className="text-[11px] text-[#8f98a0]">
              {formatHours(item.playTime, t as any)} &middot; {formatRelativeTime(item.lastPlayed, t as any)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
