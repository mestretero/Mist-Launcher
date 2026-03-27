import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import type { LibraryItem } from "../lib/types";

const THEMES = [
  { id: "default", nameKey: "profile.themeDarkGalaxy", url: "https://picsum.photos/seed/bg1/1920/1080" },
  { id: "cyber", nameKey: "profile.themeCyberNeon", url: "https://picsum.photos/seed/bg2/1920/1080" },
  { id: "nature", nameKey: "profile.themeMysticForest", url: "https://picsum.photos/seed/bg3/1920/1080" },
  { id: "mech", nameKey: "profile.themeMetallicWar", url: "https://picsum.photos/seed/bg4/1920/1080" }
];

interface ProfilePageProps {
  onNavigate?: (page: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [bgIndex, setBgIndex] = useState(() => {
    return user?.preferences?.profileThemeIndex ?? 0;
  });
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState(user?.bio || "");

  useEffect(() => {
    api.library.list().then((data) => {
      if (Array.isArray(data)) setLibraryItems(data);
    }).catch(() => {});
  }, []);

  // Sync theme index from preferences when user changes
  useEffect(() => {
    if (user?.preferences?.profileThemeIndex !== undefined) {
      setBgIndex(user.preferences.profileThemeIndex);
    }
  }, [user?.preferences?.profileThemeIndex]);

  if (!user) return null;
  const currentBg = THEMES[bgIndex].url;

  // Derive stats from real library data
  const totalGames = libraryItems.length;
  const totalPlayTimeMins = libraryItems.reduce((sum, item) => sum + (item.playTimeMins || 0), 0);
  const totalPlayTimeHours = Math.floor(totalPlayTimeMins / 60);

  // Find the most played game
  const favoriteItem = libraryItems.length > 0
    ? libraryItems.reduce((max, item) => (item.playTimeMins > max.playTimeMins) ? item : max, libraryItems[0])
    : null;

  // Recently played games (sorted by lastPlayedAt)
  const recentlyPlayed = [...libraryItems]
    .filter(item => item.lastPlayedAt)
    .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime())
    .slice(0, 4);

  const formatPlayTime = (mins: number) => {
    if (mins < 60) return t("library.minutesShort", { count: mins });
    return t("library.hoursMinutes", { hours: Math.floor(mins / 60), minutes: mins % 60 });
  };

  const formatRelativeDate = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t("library.today");
    if (days === 1) return t("library.yesterday");
    if (days < 7) return t("library.daysAgo", { count: days });
    if (days < 30) return t("library.weeksAgo", { count: Math.floor(days / 7) });
    return t("library.monthsAgo", { count: Math.floor(days / 30) });
  };

  const handleSaveProfile = async () => {
    try {
      await api.auth.updateProfile({ bio: editBio });
      addToast(t("profile.updated"), "success");
      setIsEditing(false);
    } catch { addToast(t("profile.updateError"), "error"); }
  };

  return (
    <div className="relative h-full font-sans bg-[#0f1115] overflow-hidden flex flex-col">
      {/* Absolute Background Wrapper */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
        style={{ backgroundImage: `url(${currentBg})`, filter: "brightness(0.3) saturate(1.2)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1115] via-[#0f1115]/80 to-transparent z-0" />

      {/* Quick Theme Selector */}
      <div className="absolute top-6 right-8 z-50">
        <button
          onClick={() => setIsEditingBg(!isEditingBg)}
          className="flex items-center gap-2 px-4 py-2 bg-[#20232c]/80 hover:bg-[#2a2e38] backdrop-blur border border-[#3d4450] text-[#c6d4df] rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          {t("profile.chooseTheme")}
        </button>

        {isEditingBg && (
          <div className="absolute top-12 right-0 w-64 bg-[#161920]/95 backdrop-blur-md border border-[#2a2e38] rounded shadow-2xl p-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#67707b] mb-2 px-2">{t("profile.libraryThemes")}</h4>
            <div className="flex flex-col gap-1">
              {THEMES.map((theme, idx) => (
                <button
                  key={theme.id}
                  onClick={() => { setBgIndex(idx); setIsEditingBg(false); api.auth.updatePreferences({ profileThemeIndex: idx }).catch(() => {}); }}
                  className={`text-left px-3 py-2 text-sm font-semibold rounded transition-colors ${bgIndex === idx ? "bg-[#3d4450] text-white" : "text-[#8f98a0] hover:bg-[#2a2e38] hover:text-[#c6d4df]"}`}
                >
                  {t(theme.nameKey)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modern Split Layout */}
      <div className="relative z-10 flex-1 flex h-full max-w-[1400px] mx-auto w-full p-8 gap-10 overflow-hidden">

        {/* Left Sidebar - Profile Identity Card */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

          {/* Identity Box */}
          <div className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 flex flex-col items-center shadow-2xl ring-1 ring-white/5 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#47bfff]/20 to-transparent" />

            <div className="relative mb-6">
              <div className="w-32 h-32 bg-[#2a2e38] border-2 border-[#47bfff] rounded-full shadow-[0_0_20px_rgba(71,191,255,0.2)] overflow-hidden flex items-center justify-center relative z-10">
                <span className="text-4xl font-black text-[#8f98a0]">{user.username.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#47bfff] rounded-full border-4 border-[#1a1c23] z-20" title={t("profile.online")} />
            </div>

            <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-md text-center">
              {user.username}
            </h1>
            <p className="text-xs text-[#67707b] font-medium mb-4">{user.email}</p>

            {user.isStudent && (
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#47bfff]/10 text-[#47bfff] border border-[#47bfff]/30 mb-4 uppercase tracking-widest">
                {t("profile.student")}
              </span>
            )}

            {isEditing ? (
              <div className="w-full mb-8 border-y border-[#2a2e38]/50 py-4">
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={t("profile.bioPlaceholder")}
                  className="w-full px-3 py-2 bg-[#20232c] border border-[#3d4450] rounded text-sm text-[#c6d4df] placeholder-[#67707b] focus:outline-none focus:border-[#47bfff] transition-colors resize-none"
                  rows={3}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveProfile}
                    className="flex-1 py-2 bg-[#47bfff] hover:bg-[#47bfff]/80 text-[#0f1115] text-[11px] font-black uppercase tracking-widest rounded transition-colors"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditBio(user?.bio || ""); }}
                    className="flex-1 py-2 bg-[#2a2e38]/80 hover:bg-[#3d4450] text-white text-[11px] font-black uppercase tracking-widest rounded transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <p
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-[#c6d4df] text-center leading-relaxed italic mb-8 border-y border-[#2a2e38]/50 py-4 cursor-pointer hover:text-white transition-colors"
              >
                {user.bio ? `"${user.bio}"` : `"${t("profile.defaultBio")}"`}
              </p>
            )}

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="w-full py-2.5 bg-[#2a2e38]/80 hover:bg-[#3d4450] text-white text-[11px] font-black uppercase tracking-widest rounded transition-all shadow-md"
            >
              {isEditing ? t("common.cancel") : t("profile.editProfile")}
            </button>
            <button
              onClick={() => onNavigate?.("settings")}
              className="w-full py-2 mt-2 text-[#67707b] hover:text-[#c6d4df] text-[10px] font-bold uppercase tracking-widest rounded transition-colors"
            >
              {t("nav.settings")}
            </button>
          </div>

          {/* Stats Widget */}
          <div className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-6 shadow-xl ring-1 ring-white/5">
            <h3 className="text-[10px] font-black text-[#8f98a0] uppercase tracking-widest mb-4">{t("profile.playerStats")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                <div className="text-2xl font-black text-white">{totalGames}</div>
                <div className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest">{t("profile.games")}</div>
              </div>
              <div className="bg-[#20232c]/50 p-4 rounded-lg border border-[#2a2e38]">
                <div className="text-2xl font-black text-white">{totalPlayTimeHours}</div>
                <div className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest">{t("profile.hours")}</div>
              </div>
            </div>
          </div>

          {/* Referral Code Widget */}
          <div className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-6 shadow-xl ring-1 ring-white/5 mb-8">
            <h3 className="text-[10px] font-black text-[#8f98a0] uppercase tracking-widest mb-4">{t("profile.referralCode")}</h3>
            <div className="flex items-center justify-between p-3 rounded bg-[#20232c]/50 border border-[#2a2e38]">
              <span className="text-sm font-black text-[#47bfff] tracking-widest">{user.referralCode}</span>
              <button
                onClick={() => navigator.clipboard.writeText(user.referralCode)}
                className="text-[10px] font-bold text-[#8f98a0] hover:text-white uppercase tracking-widest transition-colors"
              >
                {t("profile.copy")}
              </button>
            </div>
          </div>

        </div>

        {/* Right Dashboard Area */}
        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar pb-20">
          <div className="flex flex-col gap-10">

            {/* Spotlight Banner: Favorite Game */}
            {favoriteItem && (
              <section>
                <h2 className="text-[11px] font-black text-[#8f98a0] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#47bfff]"></span>
                  {t("profile.spotlight")}
                </h2>

                <div className="relative rounded-xl overflow-hidden border border-[#2a2e38] shadow-2xl group h-[280px]">
                  <img src={favoriteItem.game.coverImageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />

                  <div className="absolute top-0 bottom-0 left-0 p-10 flex flex-col justify-center w-2/3">
                    <span className="text-[10px] font-black text-[#47bfff] bg-[#47bfff]/10 px-2 py-1 rounded inline-block w-max mb-3 uppercase tracking-widest border border-[#47bfff]/20">
                      {favoriteItem.game.publisher.name}
                    </span>
                    <h3 className="text-4xl font-black text-white tracking-widest uppercase mb-4 drop-shadow-md">{favoriteItem.game.title}</h3>

                    <div className="flex gap-10 mb-6">
                      <div>
                        <div className="text-3xl font-black text-white drop-shadow">{formatPlayTime(favoriteItem.playTimeMins)}</div>
                        <div className="text-[10px] font-bold text-[#8f98a0] uppercase tracking-widest">{t("library.playTime")}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Recently Played Games */}
            {recentlyPlayed.length > 0 && (
              <section>
                <h2 className="text-[11px] font-black text-[#8f98a0] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                  {t("profile.recentlyPlayed")}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {recentlyPlayed.map((item) => (
                    <div key={item.id} className="relative rounded-xl overflow-hidden border border-[#2a2e38] group shadow-xl h-[140px]">
                      <img src={item.game.coverImageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.game.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1115] via-[#0f1115]/40 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-4">
                        <span className="text-xs font-black text-white uppercase tracking-widest drop-shadow-md block">{item.game.title}</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-bold text-[#47bfff]">{formatPlayTime(item.playTimeMins)}</span>
                          <span className="text-[10px] font-bold text-[#67707b]">{formatRelativeDate(item.lastPlayedAt!)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Activity Timeline */}
            <section>
              <h2 className="text-[11px] font-black text-[#8f98a0] uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c6d4df]"></span>
                {t("profile.timeline")}
              </h2>

              <div className="bg-[#1a1c23]/60 backdrop-blur-md rounded-xl border border-[#2a2e38] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute left-[39px] top-6 bottom-6 w-px bg-[#2a2e38]"></div>

                {recentlyPlayed.slice(0, 3).map((item, i) => (
                  <div key={item.id} className={`flex gap-6 ${i < recentlyPlayed.length - 1 ? "mb-8" : ""} relative z-10`}>
                    <div className={`w-8 h-8 rounded border-2 ${i === 0 ? "border-[#47bfff] shadow-[0_0_10px_rgba(71,191,255,0.2)]" : "border-[#67707b]"} bg-[#2a2e38] flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                      <img src={item.game.coverImageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="bg-[#20232c]/80 p-4 rounded-lg border border-[#2a2e38] flex-1 hover:border-[#3d4450] transition-colors">
                      <div className="text-[10px] font-bold text-[#8f98a0] uppercase tracking-widest mb-1">{formatRelativeDate(item.lastPlayedAt!)}</div>
                      <p className="text-sm font-medium text-[#c6d4df]">
                        {t("profile.playedActivity", { title: item.game.title, time: formatPlayTime(item.playTimeMins) })}
                      </p>
                    </div>
                  </div>
                ))}

                {recentlyPlayed.length === 0 && (
                  <p className="text-sm text-[#67707b] font-medium relative z-10">{t("library.noActivity")}</p>
                )}
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  );
}
