import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import { useToastStore } from "../stores/toastStore";
import { useLocalGameStore, LocalGame } from "../stores/localGameStore";

const PlayOverlay = () => (
  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
    <div className="w-14 h-14 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="8,5 20,12 8,19"/></svg>
    </div>
  </div>
);

interface Collection {
  id: string;
  name: string;
  items: { id: string; gameId: string; game: { id: string; title: string; slug: string; coverImageUrl: string; price: string; publisher: { name: string } } }[];
}

export function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const { games: allLocalGames, loadGames: loadLocalGames } = useLocalGameStore();
  const [localGamesInCollection, setLocalGamesInCollection] = useState<LocalGame[]>([]);

  const fetchCollections = async () => {
    try {
      const data = await api.collections.list();
      const list = Array.isArray(data) ? data : [];
      setCollections(list);
      // Keep selection if still valid
      if (selectedId && !list.find((c: Collection) => c.id === selectedId)) {
        setSelectedId(list.length > 0 ? list[0].id : null);
      }
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err: any) {
      addToast("Koleksiyonlar yüklenemedi: " + (err?.message || err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollections(); loadLocalGames(); }, []);

  // Fetch local games for selected collection
  useEffect(() => {
    if (!selectedId) { setLocalGamesInCollection([]); return; }
    invoke<string[]>("get_local_collection_games", { collectionId: selectedId })
      .then(ids => {
        const games = allLocalGames.filter(g => ids.includes(g.id));
        setLocalGamesInCollection(games);
      })
      .catch(() => setLocalGamesInCollection([]));
  }, [selectedId, allLocalGames]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await api.collections.create(trimmed);
      setNewName("");
      await fetchCollections();
      setSelectedId(created.id);
      addToast(`"${trimmed}" koleksiyonu oluşturuldu`, "success");
    } catch (err: any) {
      addToast(err?.message || "Koleksiyon oluşturulamadı", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.collections.remove(id);
      setDeleteConfirm(null);
      if (selectedId === id) setSelectedId(null);
      await fetchCollections();
      addToast("Koleksiyon silindi", "success");
    } catch (err: any) {
      addToast(err?.message || "Koleksiyon silinemedi", "error");
    }
  };

  const handleRemoveGame = async (collectionId: string, gameId: string) => {
    try {
      await api.collections.removeGame(collectionId, gameId);
      await fetchCollections();
      addToast("Oyun koleksiyondan cikarildi", "success");
    } catch (err: any) {
      addToast(err?.message || "Oyun cikarilamadi", "error");
    }
  };

  const handleLaunchLocal = async (game: LocalGame) => {
    try {
      await invoke("launch_game", { gameId: game.id, exePath: game.exe_path });
      addToast(`${game.title} baslatiliyor...`, "success");
    } catch (err: any) {
      addToast("Oyun baslatilamadi: " + (err?.message || err), "error");
    }
  };

  const handleRemoveLocalGame = async (collectionId: string, gameId: string) => {
    try {
      await invoke("remove_local_game_from_collection", { collectionId, gameId });
      setLocalGamesInCollection(prev => prev.filter(g => g.id !== gameId));
      addToast("Oyun koleksiyondan cikarildi", "success");
    } catch (err: any) {
      addToast(err?.message || "Oyun cikarilamadi", "error");
    }
  };

  const selected = collections.find((c) => c.id === selectedId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-[#1a1c23] font-sans">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin text-[#67707b]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm font-bold text-[#67707b] uppercase tracking-widest">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] bg-[#1a1c23] font-sans text-[#c6d4df] overflow-hidden">
      {/* Left Panel - Collection List */}
      <div className="w-[300px] flex-shrink-0 bg-[#161920] border-r border-[#2a2e38] flex flex-col">
        {/* Create new collection */}
        <div className="p-3 border-b border-[#2a2e38]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] px-1 mb-2">
            Yeni Koleksiyon
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Koleksiyon adı..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 bg-[#20232c] border border-[#2a2e38] text-[#c6d4df] text-sm pl-3 pr-2 py-1.5 focus:outline-none focus:border-[#3d4450] transition-colors rounded shadow-inner"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 rounded bg-[#2a2e38] text-xs font-bold text-[#8f98a0] uppercase tracking-widest hover:bg-[#3d4450] hover:text-white transition-colors disabled:opacity-40"
            >
              Ekle
            </button>
          </div>
        </div>

        {/* Collection list */}
        <div className="flex-1 overflow-y-auto mt-2">
          <div className="px-3 pb-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] px-2 mb-1 flex items-center justify-between">
              <span>Koleksiyonlar</span>
              <span>{collections.length}</span>
            </div>
          </div>
          {collections.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <svg className="mx-auto mb-3 text-[#3d4450]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-xs text-[#5e6673] font-medium">
                Henüz koleksiyon yok. Yukarıdan yeni bir koleksiyon oluşturun.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {collections.map((col) => {
                const isSelected = selectedId === col.id;
                return (
                  <div
                    key={col.id}
                    onClick={() => { setSelectedId(col.id); setDeleteConfirm(null); }}
                    className={`flex items-center gap-3 px-5 py-2 cursor-pointer select-none group
                      ${isSelected ? "bg-[#3d4450] text-white shadow-inner" : "hover:bg-[#2a2e38] text-[#8f98a0] hover:text-white"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm truncate font-medium flex-1">{col.name}</span>
                    <span className="text-[10px] font-bold text-[#5e6673]">{col.items?.length || 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Collection Detail */}
      <div className="flex-1 relative flex flex-col bg-[#1a1c23] overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="mb-4 text-[#3d4450]" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h2 className="text-2xl font-black text-[#5e6673] tracking-widest uppercase">Koleksiyonlar</h2>
            <p className="text-[#3d4450] text-sm font-medium mt-1">
              {collections.length === 0 ? "Yeni bir koleksiyon oluşturarak başlayın." : "Soldaki listeden bir koleksiyon seçin."}
            </p>
          </div>
        ) : (
          <div className="p-10">
            {/* Collection Header */}
            <div className="flex items-center justify-between mb-8 border-b border-[#2a2e38] pb-4">
              <div className="flex items-center gap-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#67707b]">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <h2 className="text-xl font-bold text-[#c6d4df] uppercase tracking-widest">{selected.name}</h2>
                <span className="text-sm font-bold bg-[#2a2e38] px-3 py-1 rounded text-[#8f98a0]">
                  {(selected.items?.length || 0) + localGamesInCollection.length} OYUN
                </span>
              </div>
              <div className="flex items-center gap-2">
                {deleteConfirm === selected.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400 font-bold">Silinsin mi?</span>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors uppercase tracking-widest"
                    >
                      Evet
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-xs font-bold text-[#8f98a0] bg-[#2a2e38] hover:text-white rounded transition-colors uppercase tracking-widest"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(selected.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#67707b] hover:text-red-400 transition-colors uppercase tracking-widest"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    Koleksiyonu Sil
                  </button>
                )}
              </div>
            </div>

            {/* Games Grid */}
            {(!selected.items || selected.items.length === 0) && localGamesInCollection.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <svg className="mb-6 text-[#3d4450]" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <h3 className="text-lg font-black text-[#8f98a0] uppercase tracking-widest mb-2">
                  Koleksiyon Boş
                </h3>
                <p className="text-sm text-[#67707b] font-medium max-w-sm">
                  Oyun detay sayfasından veya kütüphaneden bu koleksiyona oyun ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-6">
                {selected.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded overflow-hidden bg-[#161920] border border-[#2a2e38] transition-all hover:-translate-y-1 hover:border-[#3d4450] hover:shadow-lg hover:shadow-black/20 group relative"
                  >
                    <div className="relative overflow-hidden bg-[#1a1c23]">
                      <img
                        src={entry.game.coverImageUrl}
                        alt={entry.game.title}
                        className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105"
                        style={{ filter: "brightness(0.85)" }}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#161920] via-transparent to-transparent opacity-80" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-base text-[#c6d4df] truncate mb-1">{entry.game.title}</h3>
                      {entry.game.publisher && (
                        <p className="text-xs font-medium text-[#5e6673] uppercase tracking-widest truncate">{entry.game.publisher.name}</p>
                      )}
                      <div className="mt-4 border-t border-[#2a2e38] pt-3">
                        <button onClick={() => handleRemoveGame(selected.id, entry.gameId)}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#67707b] hover:text-red-400 transition-colors uppercase tracking-widest">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Cikar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Local games in this collection */}
                {localGamesInCollection.map((game) => (
                  <div
                    key={`local-${game.id}`}
                    className="rounded overflow-hidden bg-[#161920] border border-[#2a2e38] transition-all hover:-translate-y-1 hover:border-[#3d4450] hover:shadow-lg hover:shadow-black/20 group relative cursor-pointer"
                    onClick={() => handleLaunchLocal(game)}
                  >
                    <div className="relative overflow-hidden bg-[#1a1c23]">
                      <PlayOverlay />
                      {game.cover_url ? (
                        <img src={game.cover_url} alt={game.title}
                          className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105"
                          style={{ filter: "brightness(0.85)" }} loading="lazy" />
                      ) : (
                        <div className="w-full aspect-[16/9] bg-gradient-to-br from-[#2a2e38] to-[#1a1c23] flex items-center justify-center">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3d4450" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#161920] via-transparent to-transparent opacity-80" />
                      {/* Local badge */}
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-blue-500/80 text-white px-1.5 py-0.5 rounded">YEREL</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-base text-[#c6d4df] truncate mb-1">{game.title}</h3>
                      {game.launcher && game.launcher !== "none" && (
                        <p className="text-xs font-medium text-[#5e6673] uppercase tracking-widest truncate capitalize">{game.launcher}</p>
                      )}
                      <div className="mt-4 border-t border-[#2a2e38] pt-3">
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveLocalGame(selected.id, game.id); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#67707b] hover:text-red-400 transition-colors uppercase tracking-widest">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Cikar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
