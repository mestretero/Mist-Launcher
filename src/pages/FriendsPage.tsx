import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";
import type { Friend } from "../lib/types";

type Tab = "friends" | "pending" | "search";

export function FriendsPage() {
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
      const data = await api.friends.list();
      setFriends(Array.isArray(data) ? data : []);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const data = await api.friends.pending();
      setPending(Array.isArray(data) ? data : []);
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
      const data = await api.friends.search(searchQuery.trim());
      setSearchResults(Array.isArray(data) ? data : []);
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

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const containerClass = "max-w-[1400px] mx-auto px-10";

  const tabs: { id: Tab; label: string }[] = [
    { id: "friends", label: t("friends.tabFriends") },
    { id: "pending", label: t("friends.tabPending") },
    { id: "search", label: t("friends.tabSearch") },
  ];

  return (
    <div className="bg-brand-950 font-sans pb-20 mt-4 min-h-[calc(100vh-48px)]">
      <div className={containerClass}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 border-b border-brand-800 pb-2">
          <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">
            {t("friends.title")}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-brand-800 pb-1 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm font-bold uppercase tracking-widest pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-brand-100 border-brand-200"
                  : "text-brand-500 border-transparent hover:text-brand-200"
              }`}
            >
              {tab.label}
              {tab.id === "pending" && pending.length > 0 && (
                <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded bg-brand-200 text-brand-950">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
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
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.friendshipId}
                    className="flex items-center gap-4 bg-brand-900 border border-brand-800 rounded p-4 hover:border-brand-600 transition-colors"
                  >
                    {/* Avatar */}
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-sm font-bold text-brand-200">
                        {getInitials(friend.username)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-brand-100 truncate">
                        {friend.username}
                      </h4>
                      {friend.bio && (
                        <p className="text-xs text-brand-500 truncate mt-0.5">
                          {friend.bio}
                        </p>
                      )}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveFriend(friend.friendshipId)}
                      disabled={removingId === friend.friendshipId}
                      className="px-4 py-2 text-xs font-bold text-brand-500 hover:text-red-400 bg-brand-800 hover:bg-brand-800/80 rounded transition-colors uppercase tracking-widest disabled:opacity-50"
                    >
                      {t("friends.remove")}
                    </button>
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
                    {/* Avatar */}
                    {req.avatarUrl ? (
                      <img
                        src={req.avatarUrl}
                        alt={req.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-sm font-bold text-brand-200">
                        {getInitials(req.username)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-brand-100 truncate">
                        {req.username}
                      </h4>
                      <p className="text-[10px] text-brand-500 font-medium uppercase tracking-widest mt-0.5">
                        {t("friends.friendRequest")}
                      </p>
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
                  className="w-full pl-12 pr-4 py-3 rounded bg-brand-900 border border-brand-800 text-brand-100 text-sm font-medium focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-600"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="px-6 py-3 rounded text-sm font-bold bg-brand-200 text-brand-950 hover:bg-white transition-colors uppercase tracking-widest disabled:opacity-50"
              >
                {searchLoading ? t("friends.searching") : t("friends.search")}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 bg-brand-900 border border-brand-800 rounded p-4 hover:border-brand-600 transition-colors"
                  >
                    {/* Avatar */}
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center text-sm font-bold text-brand-200">
                        {getInitials(user.username)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-brand-100 truncate">
                        {user.username}
                      </h4>
                      {user.bio && (
                        <p className="text-xs text-brand-500 truncate mt-0.5">
                          {user.bio}
                        </p>
                      )}
                    </div>

                    {/* Add friend */}
                    <button
                      onClick={() => handleSendRequest(user.username)}
                      disabled={sendingTo === user.username}
                      className="px-4 py-2 text-xs font-bold bg-brand-200 text-brand-950 hover:bg-white rounded transition-colors uppercase tracking-widest disabled:opacity-50"
                    >
                      {sendingTo === user.username
                        ? t("friends.sending")
                        : t("friends.addFriend")}
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
