import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { api } from "../lib/api";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { BlockRenderer } from "../components/profile/BlockRenderer";

interface ProfileBlock {
  id: string;
  type: string;
  config: any;
  visible: boolean;
  order: number;
}

interface RemoteProfile {
  user: {
    username: string;
    email?: string;
    avatarUrl?: string;
    bio?: string;
    isStudent?: boolean;
    createdAt?: string;
  };
  visibility: string;
  bannerTheme: string;
  allowComments: boolean;
  customStatus?: string;
  blocks: ProfileBlock[];
}

interface UserProfilePageProps {
  username: string;
  onNavigate: (page: string, slug?: string) => void;
}

export default function UserProfilePage({ username, onNavigate }: UserProfilePageProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [restricted, setRestricted] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load the other user's profile
  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setRestricted(null);

    api.profiles
      .get(username)
      .then((data) => {
        if (data?.restricted) {
          setRestricted(data.restricted);
        } else {
          setProfile(data);
        }
      })
      .catch(() => {
        addToast(t("profile.loadError", "Failed to load profile"), "error");
      })
      .finally(() => setLoading(false));
  }, [username]);

  // Fetch comments when profile is loaded and allows comments
  const fetchComments = useCallback(async () => {
    if (!profile?.allowComments) return;
    const hasCommentWall = profile.blocks.some(
      (b) => b.type === "COMMENT_WALL" && b.visible
    );
    if (!hasCommentWall) return;
    try {
      const data = await api.profiles.getComments(username);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {
      // ignore silently
    }
  }, [username, profile?.allowComments, profile?.blocks]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (content: string) => {
    try {
      await api.profiles.addComment(username, content);
      await fetchComments();
    } catch {
      addToast(t("profile.commentError", "Failed to add comment"), "error");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.profiles.deleteComment(username, commentId);
      await fetchComments();
    } catch {
      addToast(t("profile.commentDeleteError", "Failed to delete comment"), "error");
    }
  };

  // Build extra props per block type (no library items for other users)
  const getExtraProps = (blockType: string): Record<string, any> => {
    switch (blockType) {
      case "COMMENT_WALL":
        return {
          username,
          comments,
          allowComments: profile?.allowComments ?? false,
          currentUserId: currentUser?.id,
          onAddComment: handleAddComment,
          onDeleteComment: handleDeleteComment,
          onNavigateToUser: (authorUsername: string) =>
            onNavigate("user-profile", authorUsername),
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

  // Restriction states
  if (restricted) {
    const isFriendsOnly = restricted === "friends_only";

    return (
      <div className="flex items-center justify-center h-full bg-[#0f1115]">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
          {/* Lock icon */}
          <div className="w-16 h-16 rounded-full bg-[#1a1c23] border border-[#2a2e38] flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#67707b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-2">
              {isFriendsOnly
                ? t("profile.blocks.restrictedFriends", "Friends Only")
                : t("profile.blocks.restrictedPrivate", "Private Profile")}
            </h2>
            <p className="text-sm text-[#67707b] leading-relaxed">
              {isFriendsOnly
                ? t(
                    "profile.blocks.restrictedFriendsDesc",
                    "This profile is only visible to friends."
                  )
                : t(
                    "profile.blocks.restrictedPrivateDesc",
                    "This profile is set to private."
                  )}
            </p>
          </div>

          {isFriendsOnly ? (
            <button
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-[#1a9fff]/20 active:scale-95"
              onClick={() => {
                // TODO: wire up add-friend action when friends API is available
                addToast(t("friends.requestSent", "Friend request sent"), "success");
              }}
            >
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              {t("friends.addFriend", "Add Friend")}
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#20232c] hover:bg-[#2a2e38] border border-[#3d4450] text-[#c6d4df] hover:text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
              onClick={() => onNavigate("store")}
            >
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
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              {t("common.goBack", "Go Back")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const visibleBlocks = profile.blocks.filter((b) => b.visible);

  return (
    <div className="flex flex-col h-full bg-[#0f1115] overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Profile header — read-only */}
        <ProfileHeader
          user={profile.user}
          profile={{
            visibility: profile.visibility,
            bannerTheme: profile.bannerTheme,
            allowComments: profile.allowComments,
            customStatus: profile.customStatus,
          }}
          isOwnProfile={false}
          isEditing={false}
          onNavigate={onNavigate}
        />

        {/* Blocks — view only, no edit, no DnD */}
        <div className="max-w-4xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
          {visibleBlocks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3d4450"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6M9 12h6M9 15h4" />
              </svg>
              <p className="text-sm text-[#5e6673] font-semibold">
                {t("profile.blocks.noBlocks", "No profile blocks yet.")}
              </p>
            </div>
          ) : (
            visibleBlocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                isEditing={false}
                onConfigChange={() => {}}
                extraProps={getExtraProps(block.type)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
