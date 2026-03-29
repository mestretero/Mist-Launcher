import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import { BlockRenderer } from "../components/profile/BlockRenderer";

const THEMES = [
  { id: "default", url: "https://picsum.photos/seed/bg1/1920/1080" },
  { id: "cyber", url: "https://picsum.photos/seed/bg2/1920/1080" },
  { id: "nature", url: "https://picsum.photos/seed/bg3/1920/1080" },
  { id: "mech", url: "https://picsum.photos/seed/bg4/1920/1080" },
];

interface UserProfilePageProps {
  username: string;
  onNavigate: (page: string, slug?: string) => void;
}

export default function UserProfilePage({ username, onNavigate }: UserProfilePageProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [profileData, setProfileData] = useState<any>(null); // { user, profile }
  const [restricted, setRestricted] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setProfileData(null);
    setRestricted(null);
    api.profiles.get(username)
      .then((data: any) => {
        if (data?.restricted) {
          setRestricted(data.restricted);
        } else {
          // API returns { user: {...}, profile: { blocks: [...] } } OR { profile: {...} }
          setProfileData({
            user: data.user || data.profile?.user || {},
            profile: data.profile || data,
          });
        }
      })
      .catch(() => addToast(t("common.error"), "error"))
      .finally(() => setLoading(false));
  }, [username]);

  const profile = profileData?.profile;
  const profileUser = profileData?.user;

  const fetchComments = useCallback(async () => {
    if (!profile?.allowComments) return;
    try {
      const data = await api.profiles.getComments(username);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {}
  }, [username, profile]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleAddComment = async (content: string) => {
    try {
      await api.profiles.addComment(username, content);
      await fetchComments();
    } catch { addToast(t("common.error"), "error"); }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.profiles.deleteComment(username, commentId);
      await fetchComments();
    } catch { addToast(t("common.error"), "error"); }
  };

  // For blocks that need library data — we don't have access to other user's library
  // So game_showcase and favorite_game blocks will show titles from config only

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0f1115]">
        <svg className="animate-spin text-[#1a9fff]" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
    );
  }

  if (restricted) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0f1115]">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-full bg-[#1a1c23] border border-[#2a2e38] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#67707b" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-widest">
            {restricted === "friends_only" ? t("profile.blocks.restrictedFriends") : t("profile.blocks.restrictedPrivate")}
          </h2>
          <button onClick={() => onNavigate("friends")}
            className="px-6 py-2.5 rounded-lg bg-[#1a9fff] text-white text-[11px] font-black uppercase tracking-widest">
            {t("friends.addFriend")}
          </button>
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  const user = profileUser || {};
  const blocks = (profile?.blocks || []).filter((b: any) => b.visible);
  const bgTheme = THEMES.find(t => t.id === profile?.bannerTheme) || THEMES[0];
  const avatarUrl = user.avatarUrl ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `http://localhost:3001${user.avatarUrl}`) : null;

  const getExtraProps = (block: any) => {
    const extras: any = {};
    if (block.type === "COMMENT_WALL") {
      extras.username = username;
      extras.comments = comments.map((c: any) => ({
        id: c.id, authorName: c.author?.username || "?", authorAvatar: c.author?.avatarUrl,
        content: c.content, createdAt: c.createdAt,
      }));
      extras.allowComments = profile?.allowComments ?? false;
      extras.currentUserId = currentUser?.id;
      extras.onAddComment = handleAddComment;
      extras.onDeleteComment = handleDeleteComment;
    }
    if (block.type === "STATS") extras.stats = { games: 0, hours: 0, achievements: 0 };
    if (block.type === "ACTIVITY") extras.recentlyPlayed = [];
    if (block.type === "GAME_SHOWCASE" || block.type === "FAVORITE_GAME") extras.libraryItems = [];
    if (block.type === "ACHIEVEMENTS") extras.achievements = [];
    return extras;
  };

  return (
    <div className="relative h-full font-sans bg-[#0f1115] overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${bgTheme.url})`, filter: "brightness(0.3) saturate(1.2)" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1115] via-[#0f1115]/80 to-transparent z-0" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row h-full max-w-[1400px] mx-auto w-full p-4 lg:p-8 gap-6 lg:gap-10 overflow-y-auto lg:overflow-hidden">

        {/* Left Sidebar */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-6 lg:overflow-y-auto lg:pr-2">

          {/* Identity Card */}
          <div className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 flex flex-col items-center shadow-2xl ring-1 ring-white/5 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#47bfff]/20 to-transparent" />
            <div className="relative mb-6">
              <div className="w-32 h-32 bg-[#2a2e38] border-2 border-[#47bfff] rounded-full shadow-[0_0_20px_rgba(71,191,255,0.2)] overflow-hidden flex items-center justify-center relative z-10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-[#8f98a0]">{(user.username || "??").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#47bfff] rounded-full border-4 border-[#1a1c23] z-20" />
            </div>

            <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-md text-center">{user.username}</h1>
            {profile?.customStatus && <p className="text-xs text-[#47bfff] font-medium mb-3 italic">{profile.customStatus}</p>}
            {user.isStudent && (
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#47bfff]/10 text-[#47bfff] border border-[#47bfff]/30 mb-4 uppercase tracking-widest">{t("profile.student")}</span>
            )}
            {user.bio && (
              <p className="text-xs font-medium text-[#c6d4df] text-center leading-relaxed italic mb-4 border-y border-[#2a2e38]/50 py-3 w-full break-words overflow-hidden">
                "{user.bio}"
              </p>
            )}
            {user.createdAt && (
              <p className="text-[10px] text-[#5e6673] font-medium uppercase tracking-widest">
                {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        {/* Right Panel — Blocks */}
        <div className="flex-1 lg:overflow-y-auto lg:pr-4 pb-20 min-w-0">
          <div className="flex flex-col gap-6">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3d4450" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                <p className="text-sm text-[#5e6673]">{t("profile.blocks.noBlocks", "No profile blocks yet.")}</p>
              </div>
            ) : (
              blocks.map((block: any) => (
                <div key={block.id} className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-6 shadow-xl">
                  <BlockRenderer block={block} isEditing={false} onConfigChange={() => {}} extraProps={getExtraProps(block)} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
