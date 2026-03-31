import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { CommunityLinkModal } from "./CommunityLinkModal";
import type { CommunityLink } from "../lib/types";

interface CommunityLinksProps {
  slug: string;
  onNavigateToUser?: (username: string) => void;
}

export function CommunityLinks({ slug, onNavigateToUser }: CommunityLinksProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [links, setLinks] = useState<CommunityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.communityLinks.list(slug);
      setLinks(res.links);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleCreate = async (data: any) => {
    await api.communityLinks.create(slug, data);
    setShowModal(false);
    fetchLinks();
  };

  const handleVote = async (linkId: string, voteType: "UP" | "DOWN") => {
    if (!user) return;
    try {
      const res = await api.communityLinks.vote(slug, linkId, voteType);
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, score: res.score, userVote: res.userVote as "UP" | "DOWN" | null } : l)),
      );
    } catch {}
  };

  const handleReport = (linkId: string) => {
    if (!user) return;
    setConfirmAction({
      message: t("gameDetail.communityLinks.vote.reportConfirm"),
      onConfirm: async () => {
        try {
          const res = await api.communityLinks.report(slug, linkId);
          setLinks((prev) =>
            prev.map((l) => (l.id === linkId ? { ...l, virusReports: res.virusReports, hasReported: true } : l)),
          );
        } catch {}
        setConfirmAction(null);
      },
    });
  };

  const handleDelete = (linkId: string) => {
    setConfirmAction({
      message: t("gameDetail.communityLinks.deleteConfirm"),
      onConfirm: async () => {
        try {
          await api.communityLinks.delete(slug, linkId);
          setLinks((prev) => prev.filter((l) => l.id !== linkId));
        } catch {}
        setConfirmAction(null);
      },
    });
  };

  const handleOpenUrl = (url: string) => {
    openUrl(url).catch(() => window.open(url, "_blank"));
  };

  const formatDate = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("gameDetail.communityLinks.today");
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}mo`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4">{t("gameDetail.communityLinks.title")}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#12151a] border border-[#1e2128] rounded-lg p-4 mb-3 animate-pulse">
            <div className="h-5 bg-[#1a1d23] rounded w-1/3 mb-3" />
            <div className="h-4 bg-[#1a1d23] rounded w-2/3 mb-2" />
            <div className="h-4 bg-[#1a1d23] rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">{t("gameDetail.communityLinks.title")}</h2>
          {links.length > 0 && (
            <span className="text-xs text-gray-400 bg-[#1a1d23] px-2 py-1 rounded">
              {t("gameDetail.communityLinks.count", { count: links.length })}
            </span>
          )}
        </div>
        {user && !links.some((l) => l.user.username === user.username) && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#2a2d35] hover:bg-[#353840] text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold border border-[#3a3d45] transition-colors"
          >
            + {t("gameDetail.communityLinks.share")}
          </button>
        )}
      </div>

      {/* Empty state */}
      {links.length === 0 && (
        <div className="text-center py-12 bg-[#12151a] border border-[#1e2128] rounded-lg">
          <p className="text-gray-400 mb-2">{t("gameDetail.communityLinks.empty")}</p>
          {!user ? (
            <p className="text-gray-500 text-sm">{t("gameDetail.communityLinks.loginRequired")}</p>
          ) : !links.some((l) => l.user.username === user.username) ? (
            <button onClick={() => setShowModal(true)} className="text-gray-300 hover:underline text-sm">
              {t("gameDetail.communityLinks.emptyAction")}
            </button>
          ) : null}
        </div>
      )}

      {/* Link cards */}
      {links.map((link) => (
        <div
          key={link.id}
          className={`relative bg-[#12151a] rounded-lg p-4 mb-3 ${
            link.isAdminPost
              ? "border-2 border-[#d4a843]"
              : "border border-[#1e2128]"
          } ${link.isHidden ? "opacity-50" : ""}`}
        >
          {/* Admin badge */}
          {link.isAdminPost && (
            <div className="absolute -top-px right-4 bg-[#d4a843] text-[#0a0c10] text-[10px] font-bold px-3 py-0.5 rounded-b-md tracking-wider">
              {t("gameDetail.communityLinks.admin")}
            </div>
          )}

          {/* Hidden badge */}
          {link.isHidden && (
            <div className="absolute top-2 left-2 bg-red-900/50 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded">
              {t("gameDetail.communityLinks.hidden")}
            </div>
          )}

          {/* Top row: title + vote */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-white font-semibold text-[15px] truncate">{link.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                {link.size && (
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[11px] font-medium">{link.size} GB</span>
                )}
                {link.crackInfo && (
                  <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded text-[11px] font-medium">{link.crackInfo}</span>
                )}
                <span>•</span>
                <button
                  onClick={() => onNavigateToUser?.(link.user.username)}
                  className={`hover:underline ${link.isAdminPost ? "text-[#d4a843]" : "text-gray-300"}`}
                >
                  {link.user.username}
                </button>
                <span>•</span>
                <span>{formatDate(link.createdAt)}</span>
              </div>
            </div>

            {/* Vote widget */}
            <div className="flex items-center gap-2 bg-[#1a1d23] rounded-lg px-3 py-1.5 shrink-0">
              <button
                onClick={() => handleVote(link.id, "UP")}
                className={`text-sm transition-colors ${link.userVote === "UP" ? "text-emerald-400" : "text-gray-500 hover:text-emerald-400"}`}
                disabled={!user}
              >
                ▲
              </button>
              <span className="text-white font-bold text-sm min-w-[20px] text-center">{link.score}</span>
              <button
                onClick={() => handleVote(link.id, "DOWN")}
                className={`text-sm transition-colors ${link.userVote === "DOWN" ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
                disabled={!user}
              >
                ▼
              </button>
            </div>
          </div>

          {/* Description */}
          {link.description && (
            <p className="text-gray-400 text-sm mb-3 leading-relaxed">{link.description}</p>
          )}

          {/* Mirror buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {link.mirrors.map((mirror) => (
              <button
                key={mirror.id}
                onClick={() => handleOpenUrl(mirror.url)}
                className="flex items-center gap-2 bg-[#1e2128] hover:bg-[#282c34] border border-[#2e323a] text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:border-[#4a4e56] cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {mirror.sourceName}
              </button>
            ))}
          </div>

          {/* Footer: report + delete + download */}
          <div className="flex justify-between items-center pt-2 border-t border-[#1e2128]">
            <div className="flex items-center gap-3">
              {user && !link.hasReported && (
                <button
                  onClick={() => handleReport(link.id)}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-amber-400 text-xs font-medium transition-colors px-2 py-1 rounded hover:bg-amber-400/10"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {t("gameDetail.communityLinks.vote.report")}
                </button>
              )}
              {link.hasReported && (
                <span className="flex items-center gap-1.5 text-amber-600/60 text-xs font-medium px-2 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {t("gameDetail.communityLinks.vote.reported")}
                </span>
              )}
              {user && (user.username === link.user.username || user.isAdmin) && (
                <button
                  onClick={() => handleDelete(link.id)}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs font-medium transition-colors px-2 py-1 rounded hover:bg-red-400/10"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  {t("common.delete")}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Create Link Modal */}
      {showModal && <CommunityLinkModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#12151a] border border-[#1e2128] rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{confirmAction.message}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-400 bg-[#1a1d23] hover:bg-[#252830] border border-[#2a2d35] rounded-lg transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                {t("common.confirm", "Evet")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
