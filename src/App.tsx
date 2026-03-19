import { useState, useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { useDownloadStore } from "./stores/downloadStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { StorePage } from "./pages/StorePage";
import { LibraryPage } from "./pages/LibraryPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const { initListener } = useDownloadStore();
  const [page, setPage] = useState("store");
  const [gameSlug, setGameSlug] = useState<string | null>(null);
  const [authPage, setAuthPage] = useState<"login" | "register">("login");

  useEffect(() => {
    loadSession();
    initListener();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authPage === "register") {
      return <RegisterPage onSwitch={() => setAuthPage("login")} />;
    }
    return <LoginPage onSwitch={() => setAuthPage("register")} />;
  }

  const navigate = (p: string, slug?: string) => {
    setPage(p);
    if (slug) setGameSlug(slug);
  };

  return (
    <Layout currentPage={page} onNavigate={(p) => navigate(p)}>
      {page === "store" && <StorePage onGameClick={(slug) => navigate("game", slug)} />}
      {page === "game" && gameSlug && (
        <GameDetailPage slug={gameSlug} onBack={() => navigate("store")} />
      )}
      {page === "library" && <LibraryPage />}
      {page === "settings" && <SettingsPage />}
    </Layout>
  );
}

export default App;
