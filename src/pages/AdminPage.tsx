import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";

type Tab = "users" | "reportedUsers" | "reportedLinks" | "gameRequests" | "games";

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<{ totalUsers: number; bannedUsers: number; openReports: number; reportedLinks: number; gameRequests: number; totalGames: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => {
    setConfirmDialog({ message, resolve });
  }), []);

  const refreshStats = useCallback(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return (
    <div className="min-h-screen bg-brand-950 text-brand-100 p-6 font-sans relative">
      <h1 className="text-xl font-black uppercase tracking-widest text-white mb-6">{t("admin.title")}</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: t("admin.totalUsers"), value: stats.totalUsers },
            { label: t("admin.bannedUsers"), value: stats.bannedUsers, red: true },
            { label: t("admin.openReports"), value: stats.openReports, red: stats.openReports > 0 },
            { label: t("admin.reportedLinksCount"), value: stats.reportedLinks, red: stats.reportedLinks > 0 },
            { label: t("admin.gameRequestsCount"), value: stats.gameRequests, red: stats.gameRequests > 0 },
            { label: t("admin.games.tab"), value: stats.totalGames },
          ].map((s) => (
            <div key={s.label} className="bg-brand-900 border border-brand-800 rounded-lg p-4 text-center">
              <p className={`text-2xl font-black ${s.red ? "text-red-400" : "text-white"}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-brand-800">
        {([
          { id: "games", label: t("admin.games.tab") },
          { id: "users", label: t("admin.users") },
          { id: "reportedUsers", label: t("admin.reportedUsers") },
          { id: "reportedLinks", label: t("admin.reportedLinks") },
          { id: "gameRequests", label: t("admin.gameRequests") },
        ] as { id: Tab; label: string }[]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors cursor-pointer ${
              tab === item.id ? "text-white border-[#1a9fff]" : "text-brand-500 border-transparent hover:text-brand-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "games" && <GamesTab onStatsChange={refreshStats} confirm={confirm} />}
      {tab === "users" && <UsersTab onStatsChange={refreshStats} confirm={confirm} />}
      {tab === "reportedUsers" && <ReportedUsersTab onStatsChange={refreshStats} confirm={confirm} />}
      {tab === "reportedLinks" && <ReportedLinksTab onStatsChange={refreshStats} confirm={confirm} />}
      {tab === "gameRequests" && <GameRequestsTab onStatsChange={refreshStats} confirm={confirm} />}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-brand-900 border border-brand-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-sm text-brand-100 font-medium">{confirmDialog.message}</p>
            </div>
            <div className="flex border-t border-brand-800">
              <button
                onClick={() => { confirmDialog.resolve(false); setConfirmDialog(null); }}
                className="flex-1 py-3 text-xs font-bold text-brand-400 hover:text-white hover:bg-brand-800 transition-colors uppercase tracking-widest cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <div className="w-px bg-brand-800" />
              <button
                onClick={() => { confirmDialog.resolve(true); setConfirmDialog(null); }}
                className="flex-1 py-3 text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/20 transition-colors uppercase tracking-widest cursor-pointer"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab({ onStatsChange, confirm }: { onStatsChange: () => void; confirm: (msg: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const res = await api.admin.listUsers(q || undefined, p, 20);
      setUsers(res.users);
      setTotal(res.total);
      setPage(p);
    } catch (err) { console.error("Admin load failed:", err); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, []);

  async function handleBan(id: string, isBanned: boolean) {
    if (!await confirm(isBanned ? t("admin.unban") + "?" : t("admin.confirmBan"))) return;
    try {
      if (isBanned) await api.admin.unbanUser(id);
      else await api.admin.banUser(id);
      load(page);
      onStatsChange();
    } catch (err) { console.error("Admin action failed:", err); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(1, search); }}
          placeholder={t("admin.search")}
          className="flex-1 px-3 py-2 bg-brand-900 border border-brand-800 rounded text-sm text-brand-100 placeholder:text-brand-600 focus:border-brand-600 outline-none"
        />
        <button onClick={() => load(1, search)} className="px-4 py-2 bg-brand-800 hover:bg-brand-700 rounded text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer">
          Search
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3 bg-brand-900 border border-brand-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-100 truncate">{user.username}</p>
                <p className="text-xs text-brand-500 truncate">{user.email}</p>
              </div>
              <p className="text-xs text-brand-600 shrink-0">{new Date(user.createdAt).toLocaleDateString()}</p>
              {user.isAdmin && <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1a9fff]/20 text-[#1a9fff] rounded shrink-0">ADMIN</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${user.isBanned ? "bg-red-400/20 text-red-400" : "bg-emerald-400/20 text-emerald-400"}`}>
                {user.isBanned ? t("admin.banned") : t("admin.active")}
              </span>
              {!user.isAdmin && (
                <button
                  onClick={() => handleBan(user.id, user.isBanned)}
                  className={`text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                    user.isBanned
                      ? "bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30"
                      : "bg-red-400/20 text-red-400 hover:bg-red-400/30"
                  }`}
                >
                  {user.isBanned ? t("admin.unban") : t("admin.ban")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}

// ── Reported Users Tab ─────────────────────────────────────────────────────

function ReportedUsersTab({ onStatsChange, confirm }: { onStatsChange: () => void; confirm: (msg: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Record<string, any[]>>({});

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.admin.reportedUsers(p, 20);
      setUsers(res.users);
      setTotal(res.total);
      setPage(p);
    } catch (err) { console.error("Admin load failed:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  async function loadReports(userId: string) {
    if (expandedReports[userId]) {
      setExpandedReports((prev) => { const n = { ...prev }; delete n[userId]; return n; });
      return;
    }
    const reports = await api.admin.getUserReports(userId);
    setExpandedReports((prev) => ({ ...prev, [userId]: reports }));
  }

  async function handleBan(userId: string) {
    if (!await confirm(t("admin.confirmBan"))) return;
    await api.admin.banUser(userId);
    load(page);
    onStatsChange();
  }

  async function handleDismissAll(_userId: string, reports: any[]) {
    await Promise.all(reports.map((r) => api.admin.resolveReport(r.id, "DISMISSED")));
    load(page);
    onStatsChange();
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-brand-900 border border-brand-800 rounded-lg overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-100">{user.username}</p>
                  {user.latestReason && <p className="text-xs text-brand-500 truncate mt-0.5">"{user.latestReason}"</p>}
                </div>
                <span className="text-xs font-black text-red-400 shrink-0">{user.openReportCount} {t("admin.openReports")}</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => loadReports(user.id)} className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer">
                    {t("admin.viewReports")}
                  </button>
                  <button onClick={() => handleBan(user.id)} className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer">
                    {t("admin.ban")}
                  </button>
                </div>
              </div>
              {expandedReports[user.id] && (
                <div className="border-t border-brand-800 px-4 py-3 space-y-2">
                  {expandedReports[user.id].map((r) => (
                    <div key={r.id} className="flex items-start gap-3 text-xs">
                      <span className="text-brand-600 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                      <span className="text-brand-400 flex-1">{r.reason}</span>
                      <span className="text-brand-600 shrink-0">by {r.reporter.username}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${r.status === "OPEN" ? "bg-yellow-400/20 text-yellow-400" : "bg-brand-800 text-brand-500"}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() => handleDismissAll(user.id, expandedReports[user.id])}
                    className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer mt-2"
                  >
                    {t("admin.dismiss")} All
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}

// ── Reported Links Tab ─────────────────────────────────────────────────────

function ReportedLinksTab({ onStatsChange, confirm }: { onStatsChange: () => void; confirm: (msg: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.admin.reportedLinks(p, 20);
      setLinks(res.links);
      setTotal(res.total);
      setPage(p);
    } catch (err) { console.error("Admin load failed:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  async function handleHide(linkId: string) {
    await api.admin.hideLink(linkId);
    load(page);
    onStatsChange();
  }

  async function handleDelete(linkId: string) {
    if (!await confirm(t("admin.confirmDelete"))) return;
    await api.admin.deleteLink(linkId);
    load(page);
    onStatsChange();
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="bg-brand-900 border border-brand-800 rounded-lg px-4 py-3">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-brand-100 truncate">{link.title}</p>
                    {link.isHidden && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-800 text-brand-500 rounded">HIDDEN</span>}
                  </div>
                  <p className="text-xs text-brand-500">
                    {link.game?.title} · by {link.user?.username} · {link.mirrors.length} mirror(s)
                  </p>
                  {link.mirrors.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {link.mirrors.map((m: any) => (
                        <p key={m.id} className="text-[10px] text-brand-600 truncate">{m.sourceName}: {m.url}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs font-black text-red-400">{link.virusReports} {t("admin.openReports")}</span>
                  <div className="flex gap-2">
                    {!link.isHidden && (
                      <button onClick={() => handleHide(link.id)} className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer">
                        {t("admin.hide")}
                      </button>
                    )}
                    <button onClick={() => handleDelete(link.id)} className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer">
                      {t("admin.delete")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────

function GamesTab({ onStatsChange, confirm }: { onStatsChange: () => void; confirm: (msg: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [search, setSearch] = useState("");
  const [games, setGames] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const res = await api.admin.listGames(q || undefined, p, 20);
      setGames(res.games);
      setTotal(res.total);
      setPage(p);
    } catch { } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, []);

  async function handleSync(type: string) {
    setSyncing(type);
    try {
      let res;
      if (type === "all") res = await api.admin.steamSyncAll();
      else if (type === "aaa") res = await api.admin.steamSyncAAA();
      else if (type === "most-played") res = await api.admin.steamSyncMostPlayed();
      else res = await api.admin.steamSyncFeatured();
      addToast(t("admin.games.syncDone", { count: res.totalAdded || res.added || 0 }), "success");
      load(1);
      onStatsChange();
    } catch (err: any) {
      addToast(err?.message || t("admin.games.syncFailed"), "error");
    } finally { setSyncing(null); }
  }

  async function handleAddByAppId() {
    const id = parseInt(appId);
    if (!id) return;
    try {
      await api.admin.addGameByAppId(id);
      addToast(t("admin.games.addSuccess"), "success");
      setAppId("");
      load(1);
      onStatsChange();
    } catch (err: any) {
      addToast(err?.message || t("admin.games.addFailed"), "error");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!await confirm(`"${title}" ${t("admin.games.deleteConfirm")}`)) return;
    try {
      await api.admin.deleteGame(id);
      addToast(`${title} ${t("admin.games.deleted")}`, "info");
      load(page);
      onStatsChange();
    } catch (err: any) {
      addToast(err?.message || t("admin.games.deleteFailed"), "error");
    }
  }

  return (
    <div>
      {/* Steam'den Oyun Çek */}
      <div className="bg-brand-900 border border-brand-800 rounded-lg p-5 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">{t("admin.games.steamSync")}</p>
        <p className="text-[11px] text-brand-600 mb-4">{t("admin.games.steamSyncDesc")}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: t("admin.games.syncAll"), desc: "AAA + Popüler + Öne Çıkan" },
            { id: "aaa", label: t("admin.games.syncAAA") },
            { id: "most-played", label: t("admin.games.syncMostPlayed") },
            { id: "featured", label: t("admin.games.syncFeatured") },
          ].map((btn) => (
            <button key={btn.id} onClick={() => handleSync(btn.id)} disabled={syncing !== null}
              className={`px-5 py-2.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 cursor-pointer ${
                btn.id === "all"
                  ? "bg-[#1a9fff] text-white hover:bg-[#1a9fff]/80"
                  : "bg-[#1a9fff]/10 border border-[#1a9fff]/30 text-[#1a9fff] hover:bg-[#1a9fff]/20"
              }`}>
              {syncing === btn.id ? t("admin.games.syncing") : btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* App ID ile Ekle */}
      <div className="bg-brand-900 border border-brand-800 rounded-lg p-5 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">{t("admin.games.addByAppId")}</p>
        <p className="text-[11px] text-brand-600 mb-3">{t("admin.games.addByAppIdDesc")}</p>
        <div className="flex gap-2">
          <input value={appId} onChange={(e) => setAppId(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddByAppId(); }}
            placeholder={t("admin.games.appIdPlaceholder")}
            className="flex-1 px-3 py-2.5 bg-brand-950 border border-brand-800 rounded-lg text-sm text-brand-100 placeholder:text-brand-600 focus:border-[#1a9fff] outline-none" />
          <button onClick={handleAddByAppId} disabled={!appId}
            className="px-5 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 rounded-lg text-xs font-bold text-white uppercase tracking-widest transition-colors disabled:opacity-40 cursor-pointer">
            {t("admin.games.addBtn")}
          </button>
        </div>
      </div>

      {/* Oyun Listesi */}
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(1, search); }}
          placeholder={t("admin.games.searchPlaceholder")}
          className="flex-1 px-3 py-2.5 bg-brand-900 border border-brand-800 rounded-lg text-sm text-brand-100 placeholder:text-brand-600 focus:border-brand-600 outline-none" />
        <button onClick={() => load(1, search)} className="px-5 py-2.5 bg-brand-800 hover:bg-brand-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer">
          {t("admin.search")}
        </button>
      </div>

      <p className="text-xs text-brand-500 mb-3">{t("admin.games.totalCount", { count: total })}</p>

      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("common.loading")}</div>
      ) : games.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.games.noGames")}</div>
      ) : (
        <div className="space-y-1">
          {games.map((game) => (
            <div key={game.id} className="flex items-center gap-3 px-3 py-2 bg-brand-900 border border-brand-800 rounded-lg hover:border-brand-700 transition-colors">
              {game.coverImageUrl && <img src={game.coverImageUrl} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-100 truncate">{game.title}</p>
                <p className="text-[10px] text-brand-600">{game.publisher?.name || "—"} · {game.steamAppId ? `ID: ${game.steamAppId}` : "—"}</p>
              </div>
              <button onClick={() => handleDelete(game.id, game.title)}
                className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer shrink-0">
                {t("admin.delete")}
              </button>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">&larr;</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">&rarr;</button>
        </div>
      )}
    </div>
  );
}

// ── Game Requests Tab ─────────────────────────────────────────────────────

function GameRequestsTab({ onStatsChange, confirm }: { onStatsChange: () => void; confirm: (msg: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.admin.gameRequests(p, 20);
      setRequests(res.requests);
      setTotal(res.total);
      setPage(p);
    } catch (err) { console.error("Admin load failed:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  async function handleResolve(id: string, status: "APPROVED" | "REJECTED") {
    await api.admin.resolveGameRequest(id, status);
    load(page);
    onStatsChange();
  }

  async function handleDelete(id: string) {
    if (!await confirm(t("admin.confirmDelete"))) return;
    await api.admin.deleteGameRequest(id);
    load(page);
    onStatsChange();
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-10 text-brand-500 text-sm">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 text-brand-500 text-sm">{t("admin.noResults")}</div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div key={req.id} className="bg-brand-900 border border-brand-800 rounded-lg px-4 py-3">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-white">{req.gameTitle}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      req.status === "PENDING" ? "bg-yellow-400/20 text-yellow-400" :
                      req.status === "APPROVED" ? "bg-emerald-400/20 text-emerald-400" :
                      "bg-red-400/20 text-red-400"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  {req.reason && <p className="text-xs text-brand-400 mt-0.5">"{req.reason}"</p>}
                  <p className="text-xs text-brand-600 mt-1">
                    {t("admin.requestedBy")} <span className="text-brand-400">{req.user?.username}</span> · {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {req.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleResolve(req.id, "APPROVED")}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30 transition-colors cursor-pointer font-bold"
                      >
                        {t("admin.approve")}
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, "REJECTED")}
                        className="text-xs px-3 py-1.5 rounded bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors cursor-pointer font-bold"
                      >
                        {t("admin.reject")}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(req.id)}
                    className="text-xs px-3 py-1.5 rounded bg-brand-800 hover:bg-brand-700 transition-colors cursor-pointer"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">←</button>
          <span className="text-xs text-brand-500 self-center">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 rounded bg-brand-800 text-xs disabled:opacity-30 cursor-pointer">→</button>
        </div>
      )}
    </div>
  );
}
