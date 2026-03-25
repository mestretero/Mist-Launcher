import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import { useDownloadStore } from "../stores/downloadStore";
import { useToastStore } from "../stores/toastStore";
import { DownloadProgress } from "../components/DownloadProgress";
import { AddToCollectionDropdown } from "../components/AddToCollectionDropdown";
import type { LibraryItem } from "../lib/types";

type LibTab = "overview" | "dlc" | "community" | "discussions" | "workshop" | "guides" | "support";

export function LibraryPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { downloads, startDownload } = useDownloadStore();
  const addToast = useToastStore((s) => s.addToast);
  const [sortBy, setSortBy] = useState<"name" | "recent" | "playtime">("name");
  const [activeTab, setActiveTab] = useState<LibTab>("overview");
  const [uninstallConfirm, setUninstallConfirm] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [achievementStats, setAchievementStats] = useState({ total: 0, unlocked: 0 });

  useEffect(() => {
    api.library.list()
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
          if (data.length > 0) setSelectedItem(data[0]);
        }
      })
      .catch(err => addToast("Kütüphane verileri yüklenemedi: " + err.message, "error"));
  }, []);

  // Fetch achievement stats for selected game
  useEffect(() => {
    if (selectedItem) {
      api.achievements.forLibraryItem(selectedItem.id).then((res: any) => {
        if (res) setAchievementStats(res);
      }).catch(() => setAchievementStats({ total: 0, unlocked: 0 }));
    }
  }, [selectedItem?.id]);

  // Reset tab when selecting a different game
  useEffect(() => { setActiveTab("overview"); setUninstallConfirm(null); }, [selectedItem?.id]);

  const handleDownload = async (item: LibraryItem) => {
    const destDir = await getDownloadDir();
    const destPath = `${destDir}/${item.game.slug}.zip`;
    try {
      const space = await invoke<{ free_bytes: number; total_bytes: number }>("get_disk_space", { path: destDir });
      const needed = item.game.downloadSize || 0;
      if (needed > 0 && space.free_bytes < needed) {
        const freeGB = (space.free_bytes / (1024 ** 3)).toFixed(1);
        const needGB = (needed / (1024 ** 3)).toFixed(1);
        addToast(`Yetersiz disk alanı! Gereken: ${needGB} GB, Boş: ${freeGB} GB`, "error");
        return;
      }
    } catch { /* proceed anyway */ }
    const { url } = await api.library.download(item.id);
    await startDownload(item.gameId, url, destPath);
  };

  const handleLaunch = async (item: LibraryItem) => {
    try {
      await invoke("launch_game", {
        gameId: item.gameId,
        exePath: item.installPath || `C:/Games/Stealike/${item.game.slug}/game.exe`,
      });
      addToast(`${item.game.title} başlatılıyor...`, "info");
    } catch (err: any) {
      addToast("Oyun başlatılamadı: " + (err?.message || err), "error");
    }
  };

  const handleVerifyFiles = async (item: LibraryItem) => {
    const path = item.installPath || `C:/Games/Stealike/${item.game.slug}`;
    const hash = item.game.fileHash || "";
    setVerifying(true);
    addToast("Dosya doğrulama başlatıldı...", "info");
    try {
      const valid = await invoke<boolean>("verify_game_files", { gameId: item.gameId, path, expectedHash: hash });
      addToast(valid ? "Tüm dosyalar doğrulandı!" : "Dosya bütünlüğü bozuk. Yeniden indirmeniz önerilir.", valid ? "success" : "error");
    } catch (err: any) {
      addToast("Doğrulama başarısız: " + (err?.message || err), "error");
    } finally {
      setVerifying(false);
    }
  };

  const handleUninstall = async (item: LibraryItem) => {
    const path = item.installPath || `C:/Games/Stealike/${item.game.slug}`;
    try {
      await invoke("uninstall_game", { gameId: item.gameId, path });
      addToast(`${item.game.title} kaldırıldı.`, "success");
      setUninstallConfirm(null);
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, installPath: null } : i));
    } catch (err: any) {
      addToast("Kaldırma başarısız: " + (err?.message || err), "error");
    }
  };

  const handlePause = async (gameId: string) => {
    const dl = downloads[gameId];
    if (!dl) return;
    try {
      await invoke("pause_download", { downloadId: dl.downloadId });
      addToast("İndirme duraklatıldı", "info");
    } catch {
      addToast("Duraklatma henüz desteklenmiyor", "info");
    }
  };

  const handleResume = async (gameId: string) => {
    const dl = downloads[gameId];
    if (!dl) return;
    try {
      await invoke("resume_download", { downloadId: dl.downloadId });
      addToast("İndirme devam ediyor", "info");
    } catch {
      addToast("Devam ettirme henüz desteklenmiyor", "info");
    }
  };

  const formatPlayTime = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return "Hiç oynanmadı";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Bugün";
    if (days === 1) return "Dün";
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    return `${Math.floor(days / 30)} ay önce`;
  };

  const filteredItems = items
    .filter(item => item.game.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "recent") {
        const aDate = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
        const bDate = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
        return bDate - aDate;
      }
      if (sortBy === "playtime") return b.playTimeMins - a.playTimeMins;
      return a.game.title.localeCompare(b.game.title);
    });

  const tabs: { id: LibTab; label: string }[] = [
    { id: "overview", label: "Genel Bakış" },
    { id: "dlc", label: "DLC'ler" },
    { id: "community", label: "Topluluk" },
    { id: "discussions", label: "Tartışmalar" },
    { id: "workshop", label: "Atölye" },
    { id: "guides", label: "Rehberler" },
    { id: "support", label: "Destek" },
  ];

  const renderTabPlaceholder = (title: string, description: string, icon: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#2a2e38] flex items-center justify-center mb-4 text-[#67707b]" dangerouslySetInnerHTML={{ __html: icon }} />
      <h3 className="text-lg font-black text-[#8f98a0] uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-sm text-[#67707b] font-medium max-w-md">{description}</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-48px)] bg-[#1a1c23] font-sans text-[#c6d4df] overflow-hidden">
      {/* Left Sidebar - Game List */}
      <div className="w-[300px] flex-shrink-0 bg-[#161920] border-r border-[#2a2e38] flex flex-col">
        <div className="p-3 border-b border-[#2a2e38] flex flex-col gap-2">
          <div className="flex gap-1">
            {([["name", "A-Z"], ["recent", "Son"], ["playtime", "Süre"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded transition-colors ${
                  sortBy === key ? "text-white bg-[#2a2e38] shadow-sm" : "text-[#8f98a0] hover:text-white hover:bg-[#2a2e38]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative mt-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#67707b]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Arama yap..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#20232c] border border-[#2a2e38] text-[#c6d4df] text-sm pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#3d4450] transition-colors rounded shadow-inner"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-2">
          <div className="px-3 pb-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] px-2 mb-1 flex items-center justify-between">
              <span>Tüm Oyunlar</span>
              <span>{filteredItems.length}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            {filteredItems.map(item => {
              const isSelected = selectedItem?.id === item.id;
              const dl = downloads[item.gameId];
              const isDownloading = dl && dl.percent < 100;
              const isDownloaded = dl && dl.percent >= 100;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer select-none
                    ${isSelected ? "bg-[#3d4450] text-white shadow-inner" : "hover:bg-[#2a2e38] text-[#8f98a0] hover:text-white"}`}
                >
                  <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center overflow-hidden
                    ${isDownloaded ? "brightness-100" : isDownloading ? "grayscale opacity-80" : "grayscale opacity-50"}`}>
                    <img src={item.game.coverImageUrl} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-sm truncate font-medium
                    ${isSelected ? "text-white font-bold" : isDownloaded ? "text-[#c6d4df]" : ""}`}>
                    {item.game.title}
                  </span>
                  {isDownloading && (
                    <span className="ml-auto text-[10px] font-bold text-[#47bfff]">{dl.percent.toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative flex flex-col bg-[#1a1c23] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="mb-6 text-[#3d4450]" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <h2 className="text-2xl font-black text-[#8f98a0] tracking-widest uppercase mb-2">Henüz Oyun Yok</h2>
            <p className="text-[#67707b] text-sm font-medium max-w-sm">Mağazadan yeni bir oyun bularak kütüphanenizi oluşturmaya başlayabilirsiniz.</p>
          </div>
        ) : selectedItem ? (
          <>
            {/* Hero */}
            <div className="relative w-full h-[360px] flex-shrink-0 group overflow-hidden">
              <img src={selectedItem.game.coverImageUrl} alt={selectedItem.game.title} className="absolute inset-0 w-full h-full object-cover opacity-80" style={{ filter: "blur(4px) brightness(0.6)" }} />
              <img src={selectedItem.game.coverImageUrl} alt={selectedItem.game.title} className="absolute left-1/2 -translate-x-1/2 top-0 h-full object-cover shadow-2xl z-10 aspect-video ring-1 ring-black/50" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1a1c23] to-transparent z-10" />
              <div className="absolute bottom-20 left-10 z-30 pointer-events-none">
                <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-lg break-words max-w-2xl" style={{ textShadow: "0px 4px 12px rgba(0,0,0,0.8)" }}>
                  {selectedItem.game.title}
                </h1>
              </div>
            </div>

            <div className="px-10 pb-20 relative z-20 -mt-10">
              {/* Action Bar */}
              <div className="w-full bg-[#161a20]/80 backdrop-blur border border-[#2a2e38] rounded shadow-lg mb-8 flex items-center pr-6 h-20">
                <div className="flex items-center gap-4 pl-6 border-r border-[#2a2e38]/50 h-full pr-8">
                  {downloads[selectedItem.gameId]?.percent !== undefined && downloads[selectedItem.gameId].percent < 100 ? (
                    <div className="flex items-center gap-3">
                      <div className="w-48">
                        <DownloadProgress
                          percent={downloads[selectedItem.gameId].percent}
                          speedBps={downloads[selectedItem.gameId].speedBps}
                          etaSecs={downloads[selectedItem.gameId].etaSecs}
                        />
                      </div>
                      <button onClick={() => handlePause(selectedItem.gameId)} className="p-1.5 rounded hover:bg-[#2a2e38] text-[#8f98a0] hover:text-white transition-colors" title="Duraklat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      </button>
                      <button onClick={() => handleResume(selectedItem.gameId)} className="p-1.5 rounded hover:bg-[#2a2e38] text-[#8f98a0] hover:text-white transition-colors" title="Devam Et">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </button>
                    </div>
                  ) : downloads[selectedItem.gameId]?.percent >= 100 ? (
                    <button onClick={() => handleLaunch(selectedItem)} className="px-8 py-2.5 rounded text-white font-black text-xl uppercase tracking-widest shadow-md transition-all hover:scale-105" style={{ background: "linear-gradient(to right, #47bfff, #1a70cb)", textShadow: "0px 2px 4px rgba(0,0,0,0.3)" }}>
                      Oyna
                    </button>
                  ) : (
                    <button onClick={() => handleDownload(selectedItem)} className="px-8 py-2.5 rounded text-white font-black text-lg uppercase tracking-widest shadow-md transition-all hover:scale-105 hover:brightness-110" style={{ background: "linear-gradient(to right, #799905, #536904)", textShadow: "0px 2px 4px rgba(0,0,0,0.3)" }}>
                      Yükle
                    </button>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-12 ml-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest mb-1">Son Oynama</span>
                    <span className="text-sm font-semibold text-white">{formatRelativeDate(selectedItem.lastPlayedAt)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest mb-1">Oynama Süresi</span>
                    <span className="text-sm font-semibold text-white">{formatPlayTime(selectedItem.playTimeMins)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest mb-1">Bulut Durumu</span>
                    <span className="text-sm font-semibold text-white flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                      Güncel
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#67707b] uppercase tracking-widest mb-1">Başarımlar</span>
                    <span className="text-sm font-semibold text-white">
                      {achievementStats.unlocked} / {achievementStats.total}
                      <div className="w-24 h-1.5 bg-[#2a2e38] rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-[#47bfff] h-full shadow-[0_0_10px_#47bfff]" style={{ width: achievementStats.total > 0 ? `${(achievementStats.unlocked / achievementStats.total) * 100}%` : "0%" }} />
                      </div>
                    </span>
                  </div>
                </div>

                {/* Utility icons */}
                <div className="ml-auto flex items-center gap-2 text-[#67707b]">
                  <button
                    onClick={() => handleVerifyFiles(selectedItem)}
                    disabled={verifying}
                    className="p-1.5 hover:text-white transition-colors disabled:opacity-50"
                    title="Dosya Doğrula"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </button>
                  <button
                    onClick={() => setUninstallConfirm(uninstallConfirm === selectedItem.id ? null : selectedItem.id)}
                    className="p-1.5 hover:text-red-400 transition-colors"
                    title="Kaldır"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                  <button className="p-1.5 hover:text-white transition-colors" title="Ayarlar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                </div>
              </div>

              {/* Uninstall Confirmation */}
              {uninstallConfirm === selectedItem.id && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded flex items-center justify-between">
                  <p className="text-sm text-red-400 font-bold">
                    {selectedItem.game.title} kaldırılsın mı? Bu işlem geri alınamaz.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setUninstallConfirm(null)} className="px-4 py-1.5 text-xs font-bold text-[#8f98a0] hover:text-white bg-[#2a2e38] rounded transition-colors uppercase tracking-widest">
                      İptal
                    </button>
                    <button onClick={() => handleUninstall(selectedItem)} className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors uppercase tracking-widest">
                      Kaldır
                    </button>
                  </div>
                </div>
              )}

              {/* Sub Navigation Tabs */}
              <div className="flex items-center gap-6 border-b border-[#2a2e38] pb-1 mb-6 text-sm font-bold text-[#8f98a0]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`transition-colors hover:text-white ${activeTab === tab.id ? "text-white" : ""}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-[1fr_320px] gap-6">
                  <div className="space-y-6">
                    {/* Friends Playing */}
                    <div className="bg-[#1a1c23] border border-[#2a2e38] rounded">
                      <div className="px-4 py-3 border-b border-[#2a2e38]">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bu oyunu oynayan arkadaşlarınız</h3>
                      </div>
                      <div className="p-4">
                        <button onClick={() => onNavigate?.("friends")} className="text-sm text-[#47bfff] hover:text-[#66ccff] transition-colors font-medium">
                          Arkadaşlarını Gör →
                        </button>
                      </div>
                    </div>

                    {/* Achievements */}
                    <div className="bg-[#1a1c23] border border-[#2a2e38] rounded">
                      <div className="px-4 py-3 border-b border-[#2a2e38] flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Başarımlar</h3>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-12 h-12 rounded bg-[#2a2e38] border border-[#3d4450] flex items-center justify-center text-xs font-black text-[#5e6673]">+</div>
                          ))}
                        </div>
                        <div className="flex flex-col items-end border-l border-[#2a2e38] pl-6 ml-6">
                          <span className="text-[10px] uppercase font-bold text-[#67707b] mb-1">Kilitli Olanlar</span>
                          <span className="text-sm font-bold text-white">+{achievementStats.total - achievementStats.unlocked}</span>
                        </div>
                      </div>
                    </div>

                    {/* Activity */}
                    <div className="bg-[#1a1c23] border border-[#2a2e38] rounded">
                      <div className="px-4 py-3 border-b border-[#2a2e38]">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Etkinlikleriniz</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        {selectedItem?.lastPlayedAt ? (
                          <div className="flex items-center gap-3 text-sm text-[#8f98a0]">
                            <span>Son oynama: {new Date(selectedItem.lastPlayedAt).toLocaleDateString("tr-TR")}</span>
                            <span>·</span>
                            <span>{Math.round((selectedItem.playTimeMins || 0) / 60)} saat oynandı</span>
                          </div>
                        ) : (
                          <p className="text-sm text-[#5e6673]">Henüz etkinlik yok</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-[#8f98a0] uppercase tracking-wider mb-2">Geliştirici Etkinliği</h3>
                    <div className="bg-[#1a1c23] border border-[#2a2e38] rounded p-6 flex flex-col items-center justify-center text-center">
                      <svg className="mb-3 text-[#3d4450]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      <p className="text-sm text-[#5e6673] font-medium">Geliştirici güncellemesi yok</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "dlc" && renderTabPlaceholder(
                "DLC Bulunamadı",
                "Bu oyun için henüz ek içerik paketi yayınlanmamış.",
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
              )}

              {activeTab === "community" && renderTabPlaceholder(
                "Topluluk",
                "Oyuncu topluluğu, ekran görüntüleri ve paylaşımlar çok yakında burada olacak.",
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
              )}

              {activeTab === "discussions" && renderTabPlaceholder(
                "Tartışmalar",
                "Oyuncuların strateji paylaştığı, sorunları tartıştığı forumlar çok yakında aktif olacak.",
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
              )}

              {activeTab === "workshop" && renderTabPlaceholder(
                "Atölye",
                "Topluluk tarafından oluşturulan modlar, haritalar ve içerikler çok yakında burada paylaşılacak.",
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
              )}

              {activeTab === "guides" && renderTabPlaceholder(
                "Rehberler",
                "Oyuncu rehberleri, ipuçları ve tam çözüm yolları çok yakında eklenecek.",
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
              )}

              {activeTab === "support" && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2a2e38] flex items-center justify-center mb-4 text-[#67707b]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <h3 className="text-lg font-black text-[#8f98a0] uppercase tracking-widest mb-2">Destek</h3>
                  <p className="text-sm text-[#67707b] font-medium max-w-md mb-6">Sorun mu yaşıyorsunuz? Aşağıdaki seçeneklerden birini kullanarak yardım alabilirsiniz.</p>
                  <div className="flex gap-4">
                    <button className="px-6 py-2.5 rounded bg-[#2a2e38] hover:bg-[#3d4450] text-white text-xs font-bold uppercase tracking-widest transition-colors">
                      Sık Sorulan Sorular
                    </button>
                    <button className="px-6 py-2.5 rounded bg-[#47bfff]/20 hover:bg-[#47bfff]/30 text-[#47bfff] text-xs font-bold uppercase tracking-widest transition-colors border border-[#47bfff]/30">
                      Destek Talebi Oluştur
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="mb-4 text-[#3d4450]" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            <h2 className="text-2xl font-black text-[#5e6673] tracking-widest uppercase">Kütüphane</h2>
            <p className="text-[#3d4450] text-sm font-medium">Lütfen soldaki listeden bir oyun seçiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}

async function getDownloadDir(): Promise<string> {
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    return `${await appDataDir()}/downloads`;
  } catch {
    return "C:/Games/Stealike";
  }
}
