import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import type { LibraryItem } from "../lib/types";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { BlockRenderer } from "../components/profile/BlockRenderer";
import { BlockWrapper } from "../components/profile/BlockWrapper";
import { BlockAddMenu } from "../components/profile/BlockAddMenu";
import { EditToolbar } from "../components/profile/EditToolbar";

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

  // Block system state
  const [profileData, setProfileData] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [isEditingBlocks, setIsEditingBlocks] = useState(false);
  const [editVisibility, setEditVisibility] = useState("PUBLIC");
  const [editAllowComments, setEditAllowComments] = useState(true);
  const [editBannerTheme, setEditBannerTheme] = useState("default");
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    api.library.list().then((data) => {
      if (Array.isArray(data)) setLibraryItems(data);
    }).catch(() => {});

    // Fetch profile blocks
    api.profiles.getMe().then((data: any) => {
      setProfileData(data);
      setBlocks(data.blocks || []);
      setEditVisibility(data.visibility || "PUBLIC");
      setEditAllowComments(data.allowComments ?? true);
      setEditBannerTheme(data.bannerTheme || "default");
    }).catch(() => {});

    // Fetch comments for comment wall
    if (user?.username) {
      api.profiles.getComments(user.username).then((data: any) => {
        setComments(data.comments || []);
      }).catch(() => {});
    }
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

  // Recently played games (sorted by lastPlayedAt)
  const recentlyPlayed = [...libraryItems]
    .filter(item => item.lastPlayedAt)
    .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime())
    .slice(0, 4);

  const cancelEditingBlocks = () => {
    setEditBlocks([]);
    setIsEditingBlocks(false);
  };

  const saveBlocks = async () => {
    setSavingBlocks(true);
    try {
      const blockData = editBlocks.map((b, i) => ({ id: b.id, type: b.type, position: i, config: b.config, visible: b.visible }));
      await Promise.all([
        api.profiles.saveBlocks(blockData),
        api.profiles.updateMe({ visibility: editVisibility as any, allowComments: editAllowComments, bannerTheme: editBannerTheme }),
      ]);
      const fresh = await api.profiles.getMe();
      setProfileData(fresh);
      setBlocks(fresh.blocks || []);
      setIsEditingBlocks(false);
      addToast(t("profile.blocks.saveChanges"), "success");
    } catch (err: any) {
      addToast(err?.message || t("common.error"), "error");
    } finally {
      setSavingBlocks(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditBlocks((prev) => {
        const oldIdx = prev.findIndex((b) => b.id === active.id);
        const newIdx = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleAddBlock = async (type: string) => {
    try {
      const block = await api.profiles.addBlock(type, {});
      setEditBlocks((prev) => [...prev, block]);
      setBlocks((prev) => [...prev, block]);
    } catch (err: any) {
      addToast(err?.message || t("common.error"), "error");
    }
  };

  const handleAddComment = async (content: string) => {
    if (!user?.username) return;
    try {
      const comment = await api.profiles.addComment(user.username, content);
      setComments((prev) => [comment, ...prev]);
    } catch (err: any) {
      addToast(err?.message || t("common.error"), "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user?.username) return;
    try {
      await api.profiles.deleteComment(user.username, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      addToast(err?.message || t("common.error"), "error");
    }
  };

  const getExtraProps = (block: any) => {
    const extras: any = {};
    if (block.type === "STATS") extras.stats = { games: totalGames, hours: totalPlayTimeHours, achievements: 0 };
    if (block.type === "ACTIVITY") extras.recentlyPlayed = recentlyPlayed.map((i) => ({ title: i.game.title, coverUrl: i.game.coverImageUrl, playTime: i.playTimeMins, lastPlayed: i.lastPlayedAt }));
    if (block.type === "GAME_SHOWCASE" || block.type === "FAVORITE_GAME") {
      extras.libraryItems = libraryItems.map((i) => ({
        id: i.gameId || i.id,
        title: i.game.title,
        coverUrl: i.game.coverImageUrl,
        playTime: i.playTimeMins,
      }));
    }
    if (block.type === "ACHIEVEMENTS") extras.achievements = [];
    if (block.type === "COMMENT_WALL") {
      extras.username = user?.username;
      extras.comments = comments;
      extras.allowComments = profileData?.allowComments ?? true;
      extras.currentUserId = user?.id;
      extras.onAddComment = handleAddComment;
      extras.onDeleteComment = handleDeleteComment;
    }
    return extras;
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
              onClick={() => {
                const next = !isEditingBlocks;
                setIsEditingBlocks(next);
                if (next) { setEditBlocks([...blocks]); }
                else { setEditBlocks([]); }
              }}
              className="w-full py-2.5 bg-[#2a2e38]/80 hover:bg-[#3d4450] text-white text-[11px] font-black uppercase tracking-widest rounded transition-all shadow-md"
            >
              {isEditingBlocks ? t("profile.blocks.cancelEdit") : t("profile.editProfile")}
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

            {/* Profile Blocks Section — all content is blocks */}
            {(blocks.length > 0 || isEditingBlocks) && (
              <section className="mt-4">
                {isEditingBlocks && (
                  <EditToolbar
                    visibility={editVisibility}
                    allowComments={editAllowComments}
                    onVisibilityChange={setEditVisibility}
                    onAllowCommentsChange={setEditAllowComments}
                    onSave={saveBlocks}
                    onCancel={cancelEditingBlocks}
                    saving={savingBlocks}
                  />
                )}

                {isEditingBlocks ? (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={editBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 mt-4">
                        {editBlocks.map((block) => (
                          <BlockWrapper
                            key={block.id}
                            block={block}
                            isEditing={true}
                            onToggleVisible={() => setEditBlocks(prev => prev.map(b => b.id === block.id ? { ...b, visible: !b.visible } : b))}
                            onDelete={() => setEditBlocks(prev => prev.filter(b => b.id !== block.id))}
                          >
                            <BlockRenderer
                              block={block}
                              isEditing={true}
                              onConfigChange={(config) => setEditBlocks(prev => prev.map(b => b.id === block.id ? { ...b, config } : b))}
                              extraProps={getExtraProps(block)}
                            />
                          </BlockWrapper>
                        ))}
                      </div>
                    </SortableContext>
                    <div className="mt-4">
                      <BlockAddMenu onAddBlock={handleAddBlock} currentBlockCount={editBlocks.length} />
                    </div>
                  </DndContext>
                ) : (
                  <div className="space-y-4">
                    {blocks.filter(b => b.visible).map((block) => (
                      <div key={block.id} className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-6 shadow-xl">
                        <BlockRenderer
                          block={block}
                          isEditing={false}
                          onConfigChange={() => {}}
                          extraProps={getExtraProps(block)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
