import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
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

  const handleReport = async (linkId: string) => {
    if (!user) return;
    if (!confirm(t("gameDetail.communityLinks.vote.reportConfirm"))) return;
    try {
      const res = await api.communityLinks.report(slug, linkId);
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, virusReports: res.virusReports, hasReported: true } : l)),
      );
    } catch {}
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm(t("gameDetail.communityLinks.deleteConfirm"))) return;
    try {
      await api.communityLinks.delete(slug, linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {}
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, "_blank");
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
        {user && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {t("gameDetail.communityLinks.share")}
          </button>
        )}
      </div>

      {/* Empty state */}
      {links.length === 0 && (
        <div className="text-center py-12 bg-[#12151a] border border-[#1e2128] rounded-lg">
          <p className="text-gray-400 mb-2">{t("gameDetail.communityLinks.empty")}</p>
          {user ? (
            <button onClick={() => setShowModal(true)} className="text-[#1a9fff] hover:underline text-sm">
              {t("gameDetail.communityLinks.emptyAction")}
            </button>
          ) : (
            <p className="text-gray-500 text-sm">{t("gameDetail.communityLinks.loginRequired")}</p>
          )}
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
                  <span className="bg-[#1a9fff22] text-[#1a9fff] px-2 py-0.5 rounded text-[11px]">{link.size}</span>
                )}
                {link.crackInfo && (
                  <span className="bg-[#1a9fff11] text-[#1a9fff99] px-2 py-0.5 rounded text-[11px]">{link.crackInfo}</span>
                )}
                <span>•</span>
                <button
                  onClick={() => onNavigateToUser?.(link.user.username)}
                  className={`hover:underline ${link.isAdminPost ? "text-[#d4a843]" : "text-[#1a9fff]"}`}
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
                className={`text-sm transition-colors ${link.userVote === "UP" ? "text-[#1a9fff]" : "text-gray-500 hover:text-[#1a9fff]"}`}
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
          <div className="flex flex-wrap gap-2 mb-3">
            {link.mirrors.map((mirror) => (
              <button
                key={mirror.id}
                onClick={() => handleOpenUrl(mirror.url)}
                className="bg-[#1a1d23] hover:bg-[#252830] border border-[#2a2d35] text-[#1a9fff] px-3 py-1.5 rounded-md text-sm transition-colors"
              >
                {mirror.sourceName}
              </button>
            ))}
          </div>

          {/* Footer: report + delete + download */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {user && !link.hasReported && (
                <button
                  onClick={() => handleReport(link.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  ⚠️ {t("gameDetail.communityLinks.vote.report")}
                </button>
              )}
              {link.hasReported && (
                <span className="text-gray-600 text-xs">⚠️ {t("gameDetail.communityLinks.vote.reported")}</span>
              )}
              {user && (user.username === link.user.username || user.isAdmin) && (
                <button
                  onClick={() => handleDelete(link.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  🗑️
                </button>
              )}
            </div>
            <button
              onClick={() => handleOpenUrl(link.mirrors[0]?.url)}
              className="bg-[#1a9fff] hover:bg-[#1580d0] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors"
            >
              ⬇ {t("gameDetail.communityLinks.download")}
            </button>
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && <CommunityLinkModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />}
    </div>
  );
}
