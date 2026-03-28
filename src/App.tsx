import { useState, useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { useDownloadStore } from "./stores/downloadStore";
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
import { CollectionsPage } from "./pages/CollectionsPage";
import GameScannerPage from "./pages/GameScannerPage";
import UserProfilePage from "./pages/UserProfilePage";
import { ToastContainer } from "./components/ToastContainer";

function App() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const { initListener } = useDownloadStore();
  const [authPage, setAuthPage] = useState<"login" | "register">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Custom Router History
  const [history, setHistory] = useState<{page: string, slug?: string}[]>([{page: "store"}]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadSession();
    initListener();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      useNotificationStore.getState().startPolling();
      useCartStore.getState().fetch();
    }
    return () => { useNotificationStore.getState().stopPolling(); };
  }, [isAuthenticated]);

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
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onGoBack={goBack}
      onGoForward={goForward}
    >
      {page === "store" && <StorePage onGameClick={(slug) => navigate("game", slug)} />}
      {page === "game" && gameSlug && (
        <GameDetailPage slug={gameSlug} onBack={goBack} onNavigate={navigate} />
      )}
      {page === "library" && <LibraryPage onNavigate={navigate} />}
      {page === "wishlist" && <WishlistPage onGameClick={(slug) => navigate("game", slug)} />}
      {page === "cart" && <CartPage onGameClick={(slug) => navigate("game", slug)} onNavigate={navigate} />}
      {page === "collections" && <CollectionsPage />}
      {page === "scanner" && <GameScannerPage onNavigate={navigate} />}
      {page === "friends" && <FriendsPage />}
      {page === "settings" && <SettingsPage />}
      {page === "profile" && <ProfilePage onNavigate={navigate} />}
      {page === "user-profile" && gameSlug && (
        <UserProfilePage username={gameSlug} onNavigate={navigate} />
      )}
      <ToastContainer />
    </Layout>
  );
}

export default App;
