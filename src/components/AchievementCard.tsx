interface AchievementCardProps {
  achievement: {
    id: string;
    name: string;
    description: string;
    iconUrl?: string;
    unlocked: boolean;
    unlockedAt?: string;
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function AchievementCard({ achievement }: AchievementCardProps) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded bg-brand-900 border border-brand-800 font-sans transition-colors ${
        achievement.unlocked ? "hover:border-brand-700" : "opacity-40"
      }`}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded flex items-center justify-center bg-brand-950 border border-brand-800 flex-shrink-0">
        {achievement.iconUrl ? (
          <img
            src={achievement.iconUrl}
            alt={achievement.name}
            className={`w-8 h-8 object-contain ${!achievement.unlocked ? "grayscale" : ""}`}
          />
        ) : achievement.unlocked ? (
          <TrophyIcon />
        ) : (
          <LockIcon />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-brand-100 truncate">{achievement.name}</p>
        <p className="text-xs text-brand-400 mt-0.5 leading-relaxed line-clamp-2">
          {achievement.description}
        </p>
        {achievement.unlocked && achievement.unlockedAt && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mt-1.5">
            {formatDate(achievement.unlockedAt)}
          </p>
        )}
      </div>

      {/* Status indicator */}
      {achievement.unlocked && (
        <div className="flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
