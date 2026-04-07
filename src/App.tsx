import { useState, useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
// import { useDownloadStore } from "./stores/downloadStore"; // disabled: download system not active
import { useNotificationStore } from "./stores/notificationStore";
import { useCartStore } from "./stores/cartStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { StorePage } from "./pages/StorePage";
import { LibraryPage } from "./pages/LibraryPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WishlistPage } from "./pages/WishlistPage";
import { CartPage } from "./pages/CartPage";
import { FriendsPage } from "./pages/FriendsPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import GameScannerPage from "./pages/GameScannerPage";
import UserProfilePage from "./pages/UserProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import MultiplayerPage from "./pages/MultiplayerPage";
import RoomPage from "./pages/RoomPage";
import { ToastContainer } from "./components/ToastContainer";
import { ChatPanel } from "./components/ChatPanel";
import { AchievementNotification } from "./components/AchievementNotification";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { useTranslation } from "react-i18next";

function App() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, pendingEmailVerification, loadSession } = useAuthStore();
  const { update, phase: updatePhase, progress: updateProgress, isBlocking: updateBlocking } = useAutoUpdate();
  const [changelog, setChangelog] = useState<{ version: string; notes: string } | null>(null);
  // const { initListener } = useDownloadStore(); // disabled: download system not active
  const [authPage, setAuthPage] = useState<"login" | "register">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Custom Router History
  const [history, setHistory] = useState<{page: string, slug?: string}[]>([{page: "store"}]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Show changelog modal once per version after a successful update
  useEffect(() => {
    if (updateBlocking) return; // wait until any in-progress update finishes
    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const current = await getVersion();
        const lastSeen = localStorage.getItem("lastSeenVersion");
        if (lastSeen === current) return;

        // First launch ever — record but don't show
        if (!lastSeen) {
          localStorage.setItem("lastSeenVersion", current);
          return;
        }

        // Version changed — fetch release notes from server
        const { API_URL } = await import("./lib/api");
        const res = await fetch(`${API_URL}/public/updates/latest.json`);
        if (!res.ok) {
          localStorage.setItem("lastSeenVersion", current);
          return;
        }
        const data = await res.json();
        if (data?.version === current && data?.notes) {
          setChangelog({ version: current, notes: data.notes });
        }
        localStorage.setItem("lastSeenVersion", current);
      } catch (err) {
        console.error("[changelog] failed:", err);
      }
    })();
  }, [updateBlocking]);

  useEffect(() => {
    loadSession();
    // initListener(); // disabled: download system not active

    // Listen for game close events to sync play time to server
    let unlistenGameStatus: (() => void) | undefined;
    let unlistenAchievement: (() => void) | undefined;

    Promise.all([
      import("@tauri-apps/api/event"),
      import("./stores/localGameStore"),
    ]).then(([{ listen }, { useLocalGameStore }]) => {
      listen<{ game_id: string; status: string; play_time_secs: number }>("game-status", (event) => {
        if (event.payload.status === "stopped" && event.payload.play_time_secs > 0) {
          const store = useLocalGameStore.getState();
          const game = store.games.find((g) => g.id === event.payload.game_id);
          if (game) {
            store.syncSingleGame(game.exe_path, Math.floor(game.play_time / 60), game.title);
          }
        }
      }).then((fn) => { unlistenGameStatus = fn; });

      // Listen for achievement unlocks detected by the local watcher
      listen<{ game_id: string; api_name: string; unlocked_at: number }>("achievement-unlocked", async (event) => {
        const { game_id, api_name, unlocked_at } = event.payload;
        try {
          const { api } = await import("./lib/api");
          const { useAchievementNotifStore } = await import("./stores/achievementNotifStore");
          const result = await api.achievements.unlock(game_id, api_name, unlocked_at);
          if (result?.data) {
            useAchievementNotifStore.getState().show({
              name: result.data.achievement?.name ?? api_name,
              description: result.data.achievement?.description,
              iconUrl: result.data.achievement?.iconUrl,
            });
          }
        } catch {
          // Achievement not in DB yet or already unlocked — silently ignore
        }
      }).then((fn) => { unlistenAchievement = fn; });
    }).catch(() => {});

    return () => {
      unlistenGameStatus?.();
      unlistenAchievement?.();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      useNotificationStore.getState().fetch();
      useCartStore.getState().fetch();
      // Connect WebSocket for multiplayer
      import("./lib/api").then(({ getAccessToken }) => {
        getAccessToken().then((token) => {
          if (token) {
            import("./stores/roomStore").then(({ useRoomStore }) => {
              useRoomStore.getState().connect(token);
            });
          }
        });
      }).catch(() => {});
      // Sync local games to server for profile display
      import("./stores/localGameStore").then(({ useLocalGameStore }) => {
        useLocalGameStore.getState().loadGames().then(() => {
          useLocalGameStore.getState().syncToServer();
        });
      }).catch(() => {});
    } else {
      // Disconnect WebSocket on logout
      import("./stores/roomStore").then(({ useRoomStore }) => {
        useRoomStore.getState().disconnect();
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  // ─── Blocking update screen — Steam-style forced update ──────────────
  if (updateBlocking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#030712] text-white font-sans select-none" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        <div className="flex flex-col items-center gap-8 max-w-md px-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#1a9fff]/10 border border-[#1a9fff]/30 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={updatePhase === "installing" ? "" : "animate-pulse"}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
              {update ? `MIST ${update.version}` : "MIST"}
            </h1>
            <p className="text-sm text-[#8f98a0] leading-relaxed">
              {updatePhase === "downloading" && t("updater.downloadingFull")}
              {updatePhase === "installing" && t("updater.installingFull")}
              {updatePhase === "ready" && t("updater.restarting")}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden border border-white/[0.04]">
              <div
                className="h-full bg-gradient-to-r from-[#1a9fff] to-[#0077e6] rounded-full transition-all duration-300"
                style={{ width: `${updatePhase === "downloading" ? updateProgress : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-[#5e6673] mt-2 font-mono tracking-wider">
              {updatePhase === "downloading" ? `${updateProgress}%` : "100%"}
            </p>
          </div>

          <p className="text-[10px] text-[#3d4450] uppercase tracking-widest font-bold">
            {t("updater.doNotClose")}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-950 text-brand-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded flex items-center justify-center bg-brand-800">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div className="text-sm font-medium text-brand-400 tracking-wider uppercase">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (pendingEmailVerification) {
      return <><VerifyEmailPage /><ToastContainer /></>;
    }
    if (showForgotPassword) {
      return <><ForgotPasswordPage onBack={() => setShowForgotPassword(false)} /><ToastContainer /></>;
    }
    if (authPage === "register") {
      return <><RegisterPage onSwitch={() => setAuthPage("login")} /><ToastContainer /></>;
    }
    return <><LoginPage onSwitch={() => setAuthPage("register")} onForgotPassword={() => setShowForgotPassword(true)} /><ToastContainer /></>;
  }

  const navigate = (p: string, slug?: string) => {
    // Navigating to the same page shouldn't push a new history state
    const current = history[currentIndex];
    if (current.page === p && current.slug === slug) return;

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push({ page: p, slug });
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const goBack = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const goForward = () => {
    if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;
  const currentRoute = history[currentIndex];
  const { page, slug: gameSlug } = currentRoute;

  return (
    <Layout
      currentPage={page}
      onNavigate={navigate}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onGoBack={goBack}
      onGoForward={goForward}
    >
      {page === "store" && <StorePage key={refreshKey} onGameClick={(slug) => navigate("game", slug)} />}
      {page === "game" && gameSlug && (
        <GameDetailPage slug={gameSlug} onBack={goBack} onNavigate={navigate} />
      )}
      {page === "library" && <LibraryPage key={refreshKey} onNavigate={navigate} />}
      {page === "wishlist" && <WishlistPage key={refreshKey} onGameClick={(slug) => navigate("game", slug)} />}
      {page === "cart" && <CartPage onGameClick={(slug) => navigate("game", slug)} onNavigate={navigate} />}
      {page === "collections" && <CollectionsPage key={refreshKey} />}
      {page === "scanner" && <GameScannerPage onNavigate={navigate} />}
      {page === "multiplayer" && <MultiplayerPage onNavigate={navigate} />}
      {page === "room" && gameSlug && <RoomPage roomId={gameSlug} onNavigate={navigate} />}
      {page === "marketplace" && <MarketplacePage key={refreshKey} />}
      {page === "friends" && <FriendsPage key={refreshKey} onNavigate={navigate} />}
      {page === "settings" && <SettingsPage />}
      {page === "profile" && <ProfilePage key={refreshKey} onNavigate={navigate} />}
      {page === "user-profile" && gameSlug && (
        <UserProfilePage username={gameSlug} onNavigate={navigate} />
      )}
      {page === "admin" && <AdminPage onNavigate={navigate} />}
      <ToastContainer />
      <ChatPanel onNavigate={navigate} />
      <AchievementNotification />
      {/* Changelog modal — shown once after a successful update */}
      {changelog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setChangelog(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-4 bg-[#0f1923] border border-[#1a9fff]/30 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1a9fff]/15 border border-[#1a9fff]/30 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a9fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9fff]">{t("updater.whatsNew")}</p>
                <h2 className="text-xl font-black text-white tracking-tight">MIST {changelog.version}</h2>
              </div>
            </div>
            <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-[#c6d4df] leading-relaxed whitespace-pre-wrap">{changelog.notes}</p>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.01]">
              <button
                onClick={() => setChangelog(null)}
                className="w-full py-3 bg-gradient-to-r from-[#1a9fff] to-[#0077e6] hover:from-[#3dafff] hover:to-[#1a9fff] text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer"
              >
                {t("updater.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
