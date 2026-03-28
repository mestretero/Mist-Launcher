import { useTranslation } from "react-i18next";

const THEMES: Record<string, string> = {
  default: "https://picsum.photos/seed/bg1/1920/1080",
  cyber: "https://picsum.photos/seed/bg2/1920/1080",
  nature: "https://picsum.photos/seed/bg3/1920/1080",
  mech: "https://picsum.photos/seed/bg4/1920/1080",
};

interface ProfileHeaderProps {
  user: {
    username: string;
    email?: string;
    avatarUrl?: string;
    bio?: string;
    isStudent?: boolean;
    createdAt?: string;
  };
  profile: {
    visibility: string;
    bannerTheme: string;
    customStatus?: string;
    allowComments: boolean;
  };
  isOwnProfile: boolean;
  isEditing: boolean;
  onEditToggle?: () => void;
  onNavigate?: (page: string, slug?: string) => void;
}

function MemberSince({ dateStr }: { dateStr?: string }) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" });
  return (
    <span className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest">
      {month} {year}
    </span>
  );
}

export function ProfileHeader({
  user,
  profile,
  isOwnProfile,
  isEditing,
  onEditToggle,
  onNavigate,
}: ProfileHeaderProps) {
  const { t } = useTranslation();

  const bannerUrl = THEMES[profile.bannerTheme] ?? THEMES.default;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative w-full flex-shrink-0">
      {/* Banner */}
      <div
        className="w-full relative overflow-hidden"
        style={{ height: "250px" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: `url(${bannerUrl})`,
            filter: "brightness(0.35) saturate(1.3) blur(2px)",
            transform: "scale(1.05)",
          }}
        />
        {/* Dark gradient overlay — heavier at bottom so avatar area is readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-[#0f1115]/90" />
        {/* Subtle left vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1115]/60 to-transparent" />
      </div>

      {/* Avatar + Identity row — overlaps banner bottom */}
      <div className="relative z-10 -mt-16 px-8 pb-0">
        <div className="flex items-end gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-full border-4 border-[#0f1115] bg-[#1a1c23] shadow-[0_0_24px_rgba(71,191,255,0.25)] overflow-hidden flex items-center justify-center ring-2 ring-[#47bfff]/40">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `http://localhost:3001${user.avatarUrl}`}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-[#8f98a0] select-none">
                  {initials}
                </span>
              )}
            </div>
            {/* Online indicator */}
            <div
              className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-[#47bfff] rounded-full border-4 border-[#0f1115] shadow-[0_0_8px_rgba(71,191,255,0.6)]"
              title={t("profile.online")}
            />
          </div>

          {/* Name + meta */}
          <div className="flex-1 pb-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white tracking-wider uppercase drop-shadow leading-tight truncate">
                {user.username}
              </h1>
              {user.isStudent && (
                <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-[#47bfff]/10 text-[#47bfff] border border-[#47bfff]/30 uppercase tracking-widest flex-shrink-0">
                  {t("profile.student")}
                </span>
              )}
            </div>

            {/* Custom status */}
            {profile.customStatus && (
              <p className="text-sm text-[#8f98a0] italic mb-1 truncate">
                {profile.customStatus}
              </p>
            )}

            {/* Bio (short excerpt) */}
            {user.bio && (
              <p className="text-xs text-[#67707b] leading-relaxed line-clamp-2 mb-1 max-w-xl">
                {user.bio}
              </p>
            )}

            <MemberSince dateStr={user.createdAt} />
          </div>

          {/* Action buttons — right side */}
          {isOwnProfile && (
            <div className="flex items-center gap-2 pb-3 flex-shrink-0">
              {!isEditing && (
                <button
                  onClick={onEditToggle}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-[#1a9fff]/20 active:scale-95"
                >
                  {/* Pencil icon */}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {t("profile.blocks.editProfile")}
                </button>
              )}
              <button
                onClick={() => onNavigate?.("user-profile", user.username)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#20232c]/80 hover:bg-[#2a2e38] border border-[#3d4450] text-[#c6d4df] hover:text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                {/* Eye icon */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {t("profile.blocks.viewPublicProfile")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thin bottom separator line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#2a2e38] to-transparent mx-8 mt-4" />
    </div>
  );
}
