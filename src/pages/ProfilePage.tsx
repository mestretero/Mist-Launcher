import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import type { LibraryItem } from "../lib/types";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { BlockRenderer } from "../components/profile/BlockRenderer";
import { BlockWrapper } from "../components/profile/BlockWrapper";
import { EditToolbar } from "../components/profile/EditToolbar";
import { BlockAddMenu } from "../components/profile/BlockAddMenu";

interface ProfileBlock {
  id: string;
  type: string;
  config: any;
  visible: boolean;
  order: number;
}

interface ProfileData {
  visibility: string;
  bannerTheme: string;
  allowComments: boolean;
  customStatus?: string;
  blocks: ProfileBlock[];
}

interface ProfilePageProps {
  onNavigate?: (page: string, slug?: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  // Server state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editBlocks, setEditBlocks] = useState<ProfileBlock[]>([]);
  const [editVisibility, setEditVisibility] = useState("PUBLIC");
  const [editAllowComments, setEditAllowComments] = useState(false);
  const [editBannerTheme, setEditBannerTheme] = useState("default");
  const [saving, setSaving] = useState(false);

  // Load profile + library on mount
  useEffect(() => {
    Promise.all([
      api.profiles.getMe(),
      api.library.list().catch(() => []),
    ])
      .then(([profileData, libraryData]) => {
        setProfile(profileData);
        setEditVisibility(profileData.visibility ?? "PUBLIC");
        setEditAllowComments(profileData.allowComments ?? false);
        setEditBannerTheme(profileData.bannerTheme ?? "default");
        if (Array.isArray(libraryData)) setLibraryItems(libraryData);
      })
      .catch(() => addToast(t("profile.loadError", "Failed to load profile"), "error"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch comments for comment wall
  const fetchComments = useCallback(async () => {
    if (!user?.username) return;
    try {
      const data = await api.profiles.getComments(user.username);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {
      // ignore silently
    }
  }, [user?.username]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Derived library data
  const totalHours = Math.floor(
    libraryItems.reduce((s, i) => s + (i.playTimeMins || 0), 0) / 60
  );

  const recentlyPlayed = [...libraryItems]
    .filter((i) => i.lastPlayedAt)
    .sort(
      (a, b) =>
        new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime()
    )
    .slice(0, 6);

  // --- Edit mode handlers ---
  const handleStartEdit = () => {
    if (!profile) return;
    setEditBlocks(profile.blocks.map((b) => ({ ...b })));
    setEditVisibility(profile.visibility ?? "PUBLIC");
    setEditAllowComments(profile.allowComments ?? false);
    setEditBannerTheme(profile.bannerTheme ?? "default");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) {
      setEditBlocks(profile.blocks.map((b) => ({ ...b })));
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await Promise.all([
        api.profiles.updateMe({
          visibility: editVisibility,
          allowComments: editAllowComments,
          bannerTheme: editBannerTheme,
        }),
        api.profiles.saveBlocks(editBlocks),
      ]);
      // Re-fetch to get authoritative server state
      const freshProfile = await api.profiles.getMe();
      setProfile(freshProfile);
      setIsEditing(false);
      addToast(t("profile.saved", "Profile saved"), "success");
    } catch {
      addToast(t("profile.saveError", "Failed to save profile"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditBlocks((blocks) => {
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);
        return arrayMove(blocks, oldIndex, newIndex);
      });
    }
  };

  const handleBlockConfigChange = (blockId: string, config: any) => {
    setEditBlocks((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, config } : b))
    );
  };

  const handleToggleBlockVisible = (blockId: string) => {
    setEditBlocks((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b))
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    setEditBlocks((blocks) => blocks.filter((b) => b.id !== blockId));
  };

  const handleAddBlock = async (type: string) => {
    try {
      const newBlock = await api.profiles.addBlock(type, {});
      setEditBlocks((blocks) => [...blocks, newBlock]);
    } catch {
      // Fallback: add a local block with a temp id so the user can still arrange it
      const tempBlock: ProfileBlock = {
        id: `temp-${Date.now()}`,
        type,
        config: {},
        visible: true,
        order: editBlocks.length,
      };
      setEditBlocks((blocks) => [...blocks, tempBlock]);
    }
  };

  // Comment wall handlers (own profile)
  const handleAddComment = async (content: string) => {
    if (!user?.username) return;
    try {
      await api.profiles.addComment(user.username, content);
      await fetchComments();
    } catch {
      addToast(t("profile.commentError", "Failed to add comment"), "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user?.username) return;
    try {
      await api.profiles.deleteComment(user.username, commentId);
      await fetchComments();
    } catch {
      addToast(t("profile.commentDeleteError", "Failed to delete comment"), "error");
    }
  };

  // Build extra props per block type
  const getExtraProps = (blockType: string): Record<string, any> => {
    switch (blockType) {
      case "STATS":
        return {
          stats: {
            games: libraryItems.length,
            hours: totalHours,
            achievements: 0,
          },
        };
      case "ACTIVITY":
        return { recentlyPlayed };
      case "GAME_SHOWCASE":
      case "FAVORITE_GAME":
        return { libraryItems };
      case "ACHIEVEMENTS":
        return { achievements: [] };
      case "COMMENT_WALL":
        return {
          username: user?.username,
          comments,
          allowComments: isEditing ? editAllowComments : (profile?.allowComments ?? false),
          currentUserId: user?.id,
          onAddComment: handleAddComment,
          onDeleteComment: handleDeleteComment,
        };
      default:
        return {};
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0f1115]">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin text-[#1a9fff]"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-[#8f98a0] text-sm font-semibold">
            {t("common.loading", "Loading...")}
          </span>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const activeBlocks = isEditing ? editBlocks : profile.blocks;
  const activeProfile = isEditing
    ? {
        visibility: editVisibility,
        allowComments: editAllowComments,
        bannerTheme: editBannerTheme,
        customStatus: profile.customStatus,
      }
    : profile;

  return (
    <div className="flex flex-col h-full bg-[#0f1115] overflow-hidden">
      {/* Sticky edit toolbar */}
      {isEditing && (
        <EditToolbar
          visibility={editVisibility}
          allowComments={editAllowComments}
          bannerTheme={editBannerTheme}
          onVisibilityChange={setEditVisibility}
          onAllowCommentsChange={setEditAllowComments}
          onBannerThemeChange={setEditBannerTheme}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          saving={saving}
        />
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ProfileHeader
          user={{
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            isStudent: user.isStudent,
            createdAt: user.createdAt,
          }}
          profile={activeProfile}
          isOwnProfile={true}
          isEditing={isEditing}
          onEditToggle={handleStartEdit}
          onNavigate={onNavigate}
        />

        {/* Blocks */}
        <div className="max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
          {isEditing ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={editBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {editBlocks.map((block) => (
                  <BlockWrapper
                    key={block.id}
                    block={block}
                    isEditing={true}
                    onToggleVisible={() => handleToggleBlockVisible(block.id)}
                    onDelete={() => handleDeleteBlock(block.id)}
                  >
                    <BlockRenderer
                      block={block}
                      isEditing={true}
                      onConfigChange={(config) =>
                        handleBlockConfigChange(block.id, config)
                      }
                      extraProps={getExtraProps(block.type)}
                    />
                  </BlockWrapper>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            activeBlocks
              .filter((b) => b.visible)
              .map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  isEditing={false}
                  onConfigChange={() => {}}
                  extraProps={getExtraProps(block.type)}
                />
              ))
          )}

          {/* Block add menu — edit mode only */}
          {isEditing && (
            <div className="mt-4">
              <BlockAddMenu
                onAddBlock={handleAddBlock}
                currentBlockCount={editBlocks.length}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
