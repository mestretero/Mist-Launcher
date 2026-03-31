import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { BlockRenderer } from "../components/profile/BlockRenderer";
import { BlockWrapper } from "../components/profile/BlockWrapper";
import { BlockAddMenu } from "../components/profile/BlockAddMenu";
import { EditToolbar } from "../components/profile/EditToolbar";

import { API_URL } from "../lib/api";

interface ProfilePageProps {
  onNavigate?: (page: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("midnight-bus-stop");
  const [isMirrored, setIsMirrored] = useState(false);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [allThemes, setAllThemes] = useState<any[]>([]);
  const [ownedThemeIds, setOwnedThemeIds] = useState<string[]>([]);
  const [librarySummary, setLibrarySummary] = useState<any>(null);
  const [editBio, setEditBio] = useState(user?.bio || "");
  const [savedBio, setSavedBio] = useState(user?.bio || "");
  const [editUsername, setEditUsername] = useState(user?.username || "");
  const [editCustomStatus, setEditCustomStatus] = useState("");

  // Block system state
  const [profileData, setProfileData] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [isEditingBlocks, setIsEditingBlocks] = useState(false);
  const [editVisibility, setEditVisibility] = useState("PUBLIC");
  const [editAllowComments, setEditAllowComments] = useState(true);
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    // Ensure we have the latest user data (avatarUrl, bio, etc.)
    useAuthStore.getState().loadSession();

    // Fetch library summary (merged store + local games)
    if (user?.username) {
      api.profiles.getLibrarySummary(user.username)
        .then((data: any) => setLibrarySummary(data))
        .catch(() => {});
    }

    // Fetch profile blocks
    api.profiles.getMe().then((data: any) => {
      setProfileData(data);
      setBlocks(data.blocks || []);
      setEditVisibility(data.visibility || "PUBLIC");
      setEditAllowComments(data.allowComments ?? true);
      setEditCustomStatus(data.customStatus || "");
      if (data.bannerTheme) setSelectedThemeId(data.bannerTheme);
      if (data.bannerMirrored) setIsMirrored(true);
    }).catch(() => {});

    // Fetch themes + owned list
    Promise.all([
      api.marketplace.getThemes(),
      api.marketplace.getMyThemes(),
    ]).then(([themes, owned]) => {
      setAllThemes(Array.isArray(themes) ? themes : []);
      setOwnedThemeIds(Array.isArray(owned) ? owned : []);
    }).catch(() => {});

    // Fetch comments for comment wall
    if (user?.username) {
      api.profiles.getComments(user.username).then((data: any) => {
        setComments(data.comments || []);
      }).catch(() => {});
    }
  }, []);

  if (!user) return null;
  const currentTheme = allThemes.find((t) => t.id === selectedThemeId);
  const currentBg = currentTheme ? (currentTheme.imageUrl.startsWith("http") ? currentTheme.imageUrl : `${API_URL}${currentTheme.imageUrl}`) : `${API_URL}/public/themes/midnight-bus-stop.jpeg`;

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
    if (block.type === "STATS") {
      extras.stats = librarySummary?.stats || { games: 0, hours: 0, achievements: 0 };
    }
    if (block.type === "ACTIVITY") {
      extras.recentlyPlayed = librarySummary?.recentlyPlayed || [];
    }
    if (block.type === "GAME_SHOWCASE" || block.type === "FAVORITE_GAME") {
      extras.libraryItems = librarySummary?.libraryItems || [];
    }
    if (block.type === "ACHIEVEMENTS") extras.achievements = [];
    if (block.type === "REFERRAL") extras.referralCode = user?.referralCode;
    if (block.type === "COMMENT_WALL") {
      extras.username = user?.username;
      extras.profileOwnerId = user?.id;
      extras.comments = comments;
      extras.allowComments = profileData?.allowComments ?? true;
      extras.currentUserId = user?.id;
      extras.onAddComment = handleAddComment;
      extras.onDeleteComment = handleDeleteComment;
    }
    return extras;
  };


  return (
    <div className="relative h-full font-sans bg-[#0f1115] overflow-hidden flex flex-col">
      {/* Absolute Background Wrapper */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
        style={{ backgroundImage: `url(${currentBg})`, filter: "brightness(0.4) saturate(1.3)", transform: isMirrored ? "scaleX(-1)" : undefined }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1115]/70 via-[#0f1115]/40 to-transparent z-0" />

      {/* Quick Theme Selector */}
      <div className="absolute top-6 right-8 z-50 flex items-center gap-2">
        <button
          onClick={() => {
            const newVal = !isMirrored;
            setIsMirrored(newVal);
            api.profiles.updateMe({ bannerMirrored: newVal } as any).catch(() => {});
          }}
          className={`p-2 backdrop-blur border rounded-full transition-colors shadow-lg ${isMirrored ? "bg-[#1a9fff]/20 border-[#1a9fff]/40 text-[#1a9fff]" : "bg-[#20232c]/80 border-[#3d4450] text-[#c6d4df] hover:bg-[#2a2e38]"}`}
          title={t("profile.mirrorBg")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 3v18"/></svg>
        </button>
        <button
          onClick={() => setIsEditingBg(!isEditingBg)}
          className="flex items-center gap-2 px-4 py-2 bg-[#20232c]/80 hover:bg-[#2a2e38] backdrop-blur border border-[#3d4450] text-[#c6d4df] rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 7h20M2 11h20"/></svg>
          {t("profile.chooseTheme")}
        </button>

        {isEditingBg && (
          <div className="absolute top-12 right-0 w-72 bg-[#161920]/95 backdrop-blur-md border border-[#2a2e38] rounded-xl shadow-2xl p-2 max-h-80 overflow-y-auto custom-scrollbar">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#67707b] mb-2 px-2">{t("profile.libraryThemes")}</h4>
            <div className="flex flex-col gap-1">
              {allThemes.map((theme) => {
                const owned = ownedThemeIds.includes(theme.id);
                const imgUrl = theme.imageUrl.startsWith("http") ? theme.imageUrl : `${API_URL}${theme.imageUrl}`;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (!owned) { onNavigate?.("marketplace"); setIsEditingBg(false); return; }
                      setSelectedThemeId(theme.id);
                      setIsEditingBg(false);
                      api.profiles.updateMe({ bannerTheme: theme.id }).catch(() => {});
                    }}
                    className={`flex items-center gap-3 text-left px-2 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      selectedThemeId === theme.id ? "bg-[#1a9fff]/20 text-white ring-1 ring-[#1a9fff]/40" :
                      owned ? "text-[#8f98a0] hover:bg-[#2a2e38] hover:text-[#c6d4df]" :
                      "text-[#5e6673] opacity-60"
                    }`}
                  >
                    <img src={imgUrl} alt={theme.name} className="w-10 h-6 rounded object-cover flex-shrink-0" />
                    <span className="truncate flex-1">{theme.name}</span>
                    {!owned && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modern Split Layout */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row h-full max-w-[1400px] mx-auto w-full p-4 lg:p-8 gap-6 lg:gap-10 overflow-y-auto lg:overflow-hidden">

        {/* Left Sidebar - Profile Identity Card */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar pb-20">

          {/* Identity Box */}
          <div className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-8 flex flex-col items-center shadow-2xl ring-1 ring-white/5 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#47bfff]/20 to-transparent" />

            <div className="relative mb-6">
              <div className="w-32 h-32 bg-[#2a2e38] border-2 border-[#47bfff] rounded-full shadow-[0_0_20px_rgba(71,191,255,0.2)] overflow-hidden flex items-center justify-center relative z-10">
                {user.avatarUrl ? (
                  <img src={`http://localhost:3001${user.avatarUrl}`} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-[#8f98a0]">{user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#47bfff] rounded-full border-4 border-[#1a1c23] z-20" title={t("profile.online")} />
              {isEditingBlocks && (
                <button
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  className="absolute top-0 left-0 w-32 h-32 rounded-full bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-30 cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>
              )}
              <input
                id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { addToast(t("profile.avatarTooLarge"), "error"); return; }
                  try {
                    const updatedUser = await api.auth.uploadAvatar(file);
                    // Directly update user state with returned data
                    if (updatedUser?.avatarUrl) {
                      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, avatarUrl: updatedUser.avatarUrl } : s.user }));
                    }
                    await useAuthStore.getState().loadSession();
                    addToast(t("profile.avatarUpdated"), "success");
                  } catch (err: any) {
                    addToast(err?.message || t("common.error"), "error");
                  }
                  e.target.value = "";
                }}
              />
            </div>

            {isEditingBlocks ? (
              /* Edit mode — identity fields */
              <div className="w-full space-y-3 mb-4">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("auth.usernamePlaceholder")}</label>
                  <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#20232c] border border-[#3d4450] rounded text-sm text-white text-center focus:outline-none focus:border-[#47bfff] transition-colors"
                    minLength={3} maxLength={30} />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.customStatus")}</label>
                  <input type="text" value={editCustomStatus} onChange={(e) => setEditCustomStatus(e.target.value)}
                    placeholder={t("profile.customStatusPlaceholder")}
                    className="w-full px-3 py-2 bg-[#20232c] border border-[#3d4450] rounded text-xs text-[#c6d4df] placeholder-[#67707b] focus:outline-none focus:border-[#47bfff] transition-colors"
                    maxLength={100} />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e6673] mb-1 block">{t("profile.bio")}</label>
                  <textarea value={editBio} onChange={(e) => setEditBio(e.target.value.slice(0, 80))}
                    placeholder={t("profile.bioPlaceholder")}
                    className="w-full px-3 py-2 bg-[#20232c] border border-[#3d4450] rounded text-sm text-[#c6d4df] placeholder-[#67707b] focus:outline-none focus:border-[#47bfff] transition-colors resize-none"
                    rows={2} maxLength={80} />
                  <p className={`text-[9px] mt-1 text-right ${editBio.length > 65 ? "text-yellow-400" : "text-[#3d4450]"}`}>{editBio.length}/80</p>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-md text-center">{user.username}</h1>
                {profileData?.customStatus && <p className="text-xs text-[#47bfff] font-medium mb-3 italic">{profileData.customStatus}</p>}
                {user.isStudent && (
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#47bfff]/10 text-[#47bfff] border border-[#47bfff]/30 mb-4 uppercase tracking-widest">{t("profile.student")}</span>
                )}
                {(user.bio || savedBio) ? (
                  <p className="text-xs font-medium text-[#c6d4df] text-center leading-relaxed italic mb-6 border-y border-[#2a2e38]/50 py-3 w-full break-words overflow-hidden">
                    "{user.bio || savedBio}"
                  </p>
                ) : null}
              </>
            )}

            {/* Single edit button — toggles everything */}
            {!isEditingBlocks && (
              <button
                onClick={() => {
                  setIsEditingBlocks(true);
                  setIsEditingBlocks(true);
                  setEditBlocks([...blocks]);
                  setEditUsername(user?.username || "");
                  setEditBio(user?.bio || savedBio || "");
                  setEditCustomStatus(profileData?.customStatus || "");
                }}
                className="w-full py-2.5 bg-[#1a9fff]/10 hover:bg-[#1a9fff]/20 text-[#1a9fff] text-[11px] font-black uppercase tracking-widest rounded transition-all border border-[#1a9fff]/30"
              >
                {t("profile.editProfile")}
              </button>
            )}
            <button
              onClick={() => onNavigate?.("settings")}
              className="w-full py-2 mt-2 text-[#67707b] hover:text-[#c6d4df] text-[10px] font-bold uppercase tracking-widest rounded transition-colors"
            >
              {t("nav.settings")}
            </button>
          </div>

          {/* Sidebar Blocks */}
          {(() => {
            const sidebarBlocks = (isEditingBlocks ? editBlocks : blocks).filter((b: any) => b.config?.zone === "sidebar" && (b.visible || isEditingBlocks));
            return (
              <>
                {sidebarBlocks.map((block: any) => (
                  <div key={block.id} className="bg-[#1a1c23]/60 backdrop-blur-md border border-[#2a2e38] rounded-xl p-4 shadow-xl ring-1 ring-white/5">
                    {isEditingBlocks && (
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-black text-[#5e6673] uppercase tracking-widest">{t("profile.blocks.sidebarBlock")}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            const updated = editBlocks.map((b: any) => b.id === block.id ? { ...b, config: { ...b.config, zone: "main" } } : b);
                            setEditBlocks(updated);
                          }} className="text-[9px] text-[#5e6673] hover:text-[#1a9fff] uppercase tracking-widest transition-colors">
                            {t("profile.blocks.moveToMain", "Move to main")}
                          </button>
                          <button onClick={() => {
                            setEditBlocks((prev: any[]) => prev.filter((b: any) => b.id !== block.id));
                          }} className="text-[#5e6673] hover:text-red-400 transition-colors p-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                    <BlockRenderer block={block} isEditing={isEditingBlocks} onConfigChange={(cfg: any) => {
                      setEditBlocks((prev: any[]) => prev.map((b: any) => b.id === block.id ? { ...b, config: { ...cfg, zone: "sidebar" } } : b));
                    }} extraProps={getExtraProps(block)} />
                  </div>
                ))}
                {isEditingBlocks && sidebarBlocks.length < 2 && (
                  <BlockAddMenu
                    onAddBlock={async (type: string) => {
                      try {
                        const block = await api.profiles.addBlock(type, { zone: "sidebar" });
                        setEditBlocks((prev: any[]) => [...prev, block]);
                        setBlocks((prev: any[]) => [...prev, block]);
                      } catch (err: any) {
                        addToast(err?.message || t("common.error"), "error");
                      }
                    }}
                    currentBlockCount={sidebarBlocks.length}
                  />
                )}
              </>
            );
          })()}

        </div>

        {/* Right Dashboard Area */}
        <div className="flex-1 lg:overflow-y-auto lg:pr-4 custom-scrollbar pb-20 min-w-0">
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
                  />
                )}

                {isEditingBlocks ? (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={editBlocks.filter(b => b.config?.zone !== "sidebar").map(b => b.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 mt-4">
                        {editBlocks.filter(b => b.config?.zone !== "sidebar").map((block) => (
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
                    {blocks.filter(b => b.visible && b.config?.zone !== "sidebar").map((block) => (
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

      {/* Floating Save/Cancel bar */}
      {isEditingBlocks && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#161920]/95 backdrop-blur-md border-t border-[#2a2e38] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 lg:px-8 py-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1a9fff] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1a9fff]">{t("profile.blocks.editProfile")}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsEditingBlocks(false);
                  setIsEditingBlocks(false);
                  setEditBlocks([]);
                  setEditBio(user?.bio || savedBio || "");
                  setEditUsername(user?.username || "");
                }}
                className="px-5 py-2 rounded border border-[#3d4450] text-[#8f98a0] hover:text-white text-[11px] font-bold uppercase tracking-widest transition-colors"
              >
                {t("profile.blocks.cancelEdit")}
              </button>
              <button
                onClick={async () => {
                  setSavingBlocks(true);
                  try {
                    // Save everything in parallel
                    const blockData = editBlocks.map((b, i) => ({ id: b.id, type: b.type, position: i, config: b.config, visible: b.visible }));
                    await Promise.all([
                      api.profiles.saveBlocks(blockData),
                      api.profiles.updateMe({ visibility: editVisibility as any, allowComments: editAllowComments }),
                      api.auth.updateProfile({ bio: editBio }),
                      api.auth.updatePreferences({ customStatus: editCustomStatus || null }),
                      (editUsername !== user?.username && editUsername.trim().length >= 3)
                        ? api.auth.updateProfile({ username: editUsername.trim() } as any)
                        : Promise.resolve(),
                    ]);
                    if (profileData) {
                      await api.profiles.updateMe({ customStatus: editCustomStatus || undefined });
                    }
                    // Refresh
                    const fresh = await api.profiles.getMe();
                    setProfileData(fresh);
                    setBlocks(fresh.blocks || []);
                    setIsEditingBlocks(false);
                    setSavedBio(editBio);
                    await useAuthStore.getState().loadSession();
                    addToast(t("profile.updated"), "success");
                  } catch (err: any) {
                    addToast(err?.message || t("common.error"), "error");
                  } finally {
                    setSavingBlocks(false);
                  }
                }}
                disabled={savingBlocks}
                className="flex items-center gap-2 px-6 py-2 rounded bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-[#1a9fff]/20 transition-all disabled:opacity-60"
              >
                {savingBlocks && <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                {t("profile.blocks.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
