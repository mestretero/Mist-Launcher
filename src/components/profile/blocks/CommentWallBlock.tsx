import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getAvatarUrl } from "../../../lib/avatar";

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

interface BlockProps {
  config: any;
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  // Extra props
  username?: string;
  profileOwnerId?: string;
  comments?: Comment[];
  allowComments?: boolean;
  currentUserId?: string;
  onAddComment?: (content: string) => void;
  onDeleteComment?: (id: string) => void;
}

function formatRelativeTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return t("profile.blocks.commentDaysAgo", { count: days });
  if (hours > 0) return t("profile.blocks.commentHoursAgo", { count: hours });
  if (minutes > 0) return t("profile.blocks.commentMinutesAgo", { count: minutes });
  return t("profile.blocks.commentJustNow");
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = (name || "??").slice(0, 2).toUpperCase();
  if (avatarUrl) {
    const src = getAvatarUrl(avatarUrl) || "";
    return (
      <img
        src={src}
        alt={name}
        className="w-9 h-9 rounded-full object-cover border border-[#2a2e38] flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#1a9fff]/20 border border-[#1a9fff]/30 flex items-center justify-center text-[#1a9fff] font-black text-xs flex-shrink-0">
      {initials}
    </div>
  );
}

export function CommentWallBlock({
  config: _config,
  isEditing,
  onConfigChange: _onConfigChange,
  username: _username,
  profileOwnerId,
  comments = [],
  allowComments = true,
  currentUserId,
  onAddComment,
  onDeleteComment,
}: BlockProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddComment?.(draft.trim());
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  // Edit mode just shows a note
  if (isEditing) {
    return (
      <div className="p-4 rounded-xl bg-[#0a0c10] border border-[#2a2e38] text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="1.5" className="mx-auto mb-2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-sm text-[#8f98a0]">
          {t("profile.blocks.commentWallEditNote", "Comment wall — visitors can leave comments here.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Write comment form */}
      {allowComments && currentUserId ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("profile.blocks.writeComment", "Write a comment...")}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2.5 rounded-xl bg-[#0a0c10] border border-[#2a2e38] text-white text-sm placeholder-[#5e6673] focus:outline-none focus:border-[#1a9fff] transition-colors resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#5e6673]">{draft.length}/500</span>
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-[#1a9fff] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#1a9fff]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? t("profile.blocks.sendCommentSending", "Sending...")
                : t("profile.blocks.sendComment", "Send")}
            </button>
          </div>
        </div>
      ) : !allowComments ? (
        <div className="p-3 rounded-xl bg-[#0a0c10] border border-[#2a2e38] text-center">
          <p className="text-sm text-[#5e6673]">
            {t("profile.blocks.commentsDisabled", "Comments are disabled for this profile.")}
          </p>
        </div>
      ) : null}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-[#5e6673] italic text-center py-4">
          {t("profile.blocks.noComments", "No comments yet. Be the first!")}
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isOwn = !!currentUserId && comment.authorId === currentUserId;
            const isProfileOwner = !!currentUserId && currentUserId === profileOwnerId;

            return (
              <div
                key={comment.id}
                className="flex gap-3 p-3 rounded-xl bg-[#0a0c10] border border-[#2a2e38] group"
              >
                <Avatar name={comment.authorName} avatarUrl={comment.authorAvatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{comment.authorName}</span>
                      <span className="text-[10px] text-[#5e6673]">
                        {formatRelativeTime(comment.createdAt, t)}
                      </span>
                    </div>
                    {(isOwn || isProfileOwner) && onDeleteComment && (
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5e6673] hover:text-red-400 p-1 rounded"
                        title={t("profile.blocks.deleteComment", "Delete")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[#c6d4df] leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
