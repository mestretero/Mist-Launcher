import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";
import { getAvatarUrl } from "../lib/avatar";
import type { Friend } from "../lib/types";

type Tab = "friends" | "pending" | "search";

export function FriendsPage({ onNavigate }: { onNavigate?: (page: string, slug?: string) => void }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<Tab>("friends");

  // Friends tab
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Pending tab
  const [pending, setPending] = useState<Friend[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Search tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (activeTab === "pending") loadPending();
  }, [activeTab]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const raw = await api.friends.list();
      const data = (Array.isArray(raw) ? raw : []).map((f: any) => ({
        id: f.friend?.id || f.id,
        friendshipId: f.friendshipId || f.id,
        username: f.friend?.username || f.username,
        avatarUrl: f.friend?.avatarUrl || f.avatarUrl,
        bio: f.friend?.bio || f.bio,
        status: "ACCEPTED" as const,
        createdAt: f.since || f.createdAt,
      }));
      setFriends(data);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const raw = await api.friends.pending();
      const data = (Array.isArray(raw) ? raw : []).map((f: any) => ({
        id: f.sender?.id || f.senderId,
        friendshipId: f.id,
        username: f.sender?.username,
        avatarUrl: f.sender?.avatarUrl,
        bio: f.sender?.bio,
        status: "PENDING" as const,
        createdAt: f.createdAt,
      }));
      setPending(data);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleRemoveFriend = async (id: string) => {
    setRemovingId(id);
    try {
      await api.friends.remove(id);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== id));
      addToast(t("friends.removed"), "success");
    } catch {
      addToast(t("friends.removeError"), "error");
    } finally {
      setRemovingId(null);
    }
  };

  const handleBlockUser = async (id: string) => {
    setRemovingId(id);
    try {
      await api.friends.block(id);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== id));
      addToast(t("friends.blocked"), "success");
    } catch {
      addToast(t("friends.blockError"), "error");
    } finally {
      setRemovingId(null);
    }
  };

  const handleAccept = async (id: string) => {
    setProcessingId(id);
    try {
      await api.friends.accept(id);
      setPending((prev) => prev.filter((f) => f.friendshipId !== id));
      addToast(t("friends.requestAccepted"), "success");
      loadFriends();
    } catch {
      addToast(t("friends.acceptError"), "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await api.friends.reject(id);
      setPending((prev) => prev.filter((f) => f.friendshipId !== id));
      addToast(t("friends.requestRejected"), "info");
    } catch {
      addToast(t("friends.rejectError"), "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const raw = await api.friends.search(searchQuery.trim());
      const data = (Array.isArray(raw) ? raw : []).map((u: any) => ({
        id: u.id,
        friendshipId: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        status: "PENDING" as const,
        createdAt: "",
      }));
      setSearchResults(data);
    } catch {
      setSearchResults([]);
      addToast(t("friends.searchError"), "error");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (username: string) => {
    setSendingTo(username);
    try {
      await api.friends.request(username);
      addToast(t("friends.requestSent", { username }), "success");
    } catch {
      addToast(t("friends.requestSendError"), "error");
    } finally {
      setSendingTo(null);
    }
  };

  const getInitials = (name?: string | null) => {
    return (name || "??").slice(0, 2).toUpperCase();
  };

  const containerClass = "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10";

  const tabs: { id: Tab; label: string }[] = [
    { id: "friends", label: t("friends.tabFriends") },
    { id: "pending", label: t("friends.tabPending") },
    { id: "search", label: t("friends.tabSearch") },
  ];

  return (
    <div className="bg-brand-950 font-sans pb-20 mt-4 min-h-[calc(100vh-48px)]">
      <div className={containerClass}>
        {/* Header + Tabs */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-6">
            {t("friends.title")}
          </h2>
          <div className="flex items-center gap-1 bg-[#0a0c10]/40 rounded-xl p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? "text-white bg-[#1a9fff]/20 shadow-[0_0_12px_rgba(26,159,255,0.1)]"
                    : "text-[#5e6673] hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
                {tab.id === "pending" && pending.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-black px-1 rounded-full bg-[#1a9fff] text-white flex items-center justify-center">
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Friends Tab */}
        {activeTab === "friends" && (
          <>
            {friendsLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg
                  className="animate-spin text-brand-400"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <svg
                  className="mb-6 text-brand-800"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <h3 className="text-lg font-black text-brand-400 uppercase tracking-widest mb-2">
                  {t("friends.noFriends")}
                </h3>
                <p className="text-sm text-brand-500 font-medium max-w-sm">
                  {t("friends.noFriendsHint")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {friends.map((friend) => (
                  <div
                    key={friend.friendshipId}
                    className="group flex items-center gap-4 bg-[#1a1c23]/60 border border-white/[0.04] rounded-xl p-4 hover:bg-[#1a1c23] hover:border-white/[0.08] transition-all duration-200"
                  >
                    {/* Avatar with online dot */}
                    <div
                      className="relative cursor-pointer flex-shrink-0"
                      onClick={() => onNavigate?.("user-profile", friend.username)}
                    >
                      {friend.avatarUrl ? (
                        <img
                          src={getAvatarUrl(friend.avatarUrl) || ""}
                          alt={friend.username}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/[0.06]"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a9fff]/20 to-[#1a1c23] ring-2 ring-white/[0.06] flex items-center justify-center text-sm font-black text-[#c6d4df]">
                          {getInitials(friend.username)}
                        </div>
                      )}
                      {friend.online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-[2.5px] border-[#1a1c23]" />
                      )}
                    </div>

                    {/* Info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onNavigate?.("user-profile", friend.username)}
                    >
                      <span className="text-sm font-bold text-white truncate block group-hover:text-[#1a9fff] transition-colors">
                        {friend.username}
                      </span>
                      <p className="text-[11px] truncate mt-0.5">
                        {friend.online ? (
                          <span className="text-emerald-400 font-medium">{t("chat.online")}</span>
                        ) : friend.bio ? (
                          <span className="text-[#5e6673]">{friend.bio}</span>
                        ) : (
                          <span className="text-[#3d4450]">{t("chat.offline")}</span>
                        )}
                      </p>
                    </div>

                    {/* Actions — visible on hover */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.friendshipId); }}
                        disabled={removingId === friend.friendshipId}
                        className="p-2 rounded-lg text-[#5e6673] hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
                        title={t("friends.remove")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBlockUser(friend.friendshipId); }}
                        disabled={removingId === friend.friendshipId}
                        className="p-2 rounded-lg text-[#5e6673] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        title={t("friends.block")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pending Tab */}
        {activeTab === "pending" && (
          <>
            {pendingLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg
                  className="animate-spin text-brand-400"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <svg
                  className="mb-6 text-brand-800"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3 className="text-lg font-black text-brand-400 uppercase tracking-widest mb-2">
                  {t("friends.noPending")}
                </h3>
                <p className="text-sm text-brand-500 font-medium max-w-sm">
                  {t("friends.noPendingHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center gap-4 bg-brand-900 border border-brand-800 rounded p-4 hover:border-brand-600 transition-colors"
                  >
                    {/* Avatar + Info — clickable to profile */}
                    <div
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => onNavigate?.("user-profile", req.username)}
                    >
                      {req.avatarUrl ? (
                        <img
                          src={getAvatarUrl(req.avatarUrl) || ""}
                          alt={req.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-sm font-bold text-brand-200">
                          {getInitials(req.username)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-brand-100 truncate hover:text-[#1a9fff] transition-colors">
                          {req.username}
                        </h4>
                        <p className="text-[10px] text-brand-500 font-medium uppercase tracking-widest mt-0.5">
                          {t("friends.friendRequest")}
                        </p>
                      </div>
                    </div>

                    {/* Accept / Reject */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(req.friendshipId)}
                        disabled={processingId === req.friendshipId}
                        className="px-4 py-2 text-xs font-bold bg-brand-200 text-brand-950 hover:bg-white rounded transition-colors uppercase tracking-widest disabled:opacity-50"
                      >
                        {t("friends.accept")}
                      </button>
                      <button
                        onClick={() => handleReject(req.friendshipId)}
                        disabled={processingId === req.friendshipId}
                        className="px-4 py-2 text-xs font-bold text-brand-500 hover:text-red-400 bg-brand-800 hover:bg-brand-800/80 rounded transition-colors uppercase tracking-widest disabled:opacity-50"
                      >
                        {t("friends.reject")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <div className="relative flex-1 max-w-xl">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 pointer-events-none"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder={t("friends.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0a0c10]/60 border border-white/[0.06] text-white text-sm font-medium focus:outline-none focus:border-[#1a9fff]/40 focus:bg-[#0a0c10]/80 transition-all placeholder-[#3d4450]"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="px-6 py-3.5 rounded-xl text-sm font-bold bg-[#1a9fff] text-white hover:bg-[#3dafff] transition-all uppercase tracking-wider disabled:opacity-50 shadow-[0_2px_12px_rgba(26,159,255,0.2)]"
              >
                {searchLoading ? (
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : t("friends.search")}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="group flex items-center gap-4 bg-[#1a1c23]/60 border border-white/[0.04] rounded-xl p-4 hover:bg-[#1a1c23] hover:border-white/[0.08] transition-all duration-200"
                  >
                    {/* Avatar — clickable */}
                    <div
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => onNavigate?.("user-profile", user.username)}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={getAvatarUrl(user.avatarUrl) || ""}
                          alt={user.username}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/[0.06]"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a9fff]/20 to-[#1a1c23] ring-2 ring-white/[0.06] flex items-center justify-center text-sm font-black text-[#c6d4df]">
                          {getInitials(user.username)}
                        </div>
                      )}
                    </div>

                    {/* Info — clickable */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onNavigate?.("user-profile", user.username)}
                    >
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-[#1a9fff] transition-colors">
                        {user.username}
                      </h4>
                      {user.bio ? (
                        <p className="text-[11px] text-[#5e6673] truncate mt-0.5">{user.bio}</p>
                      ) : (
                        <p className="text-[11px] text-[#3d4450] mt-0.5">{t("chat.offline")}</p>
                      )}
                    </div>

                    {/* Add friend */}
                    <button
                      onClick={() => handleSendRequest(user.username)}
                      disabled={sendingTo === user.username}
                      className="px-4 py-2 text-xs font-bold bg-[#1a9fff] text-white hover:bg-[#3dafff] rounded-lg transition-all disabled:opacity-50 uppercase tracking-wider shadow-[0_2px_8px_rgba(26,159,255,0.2)]"
                    >
                      {sendingTo === user.username ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery && !searchLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-brand-500 font-bold uppercase tracking-widest">
                  {t("friends.noSearchResults")}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
