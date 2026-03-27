import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useLocalGameStore, ScannedGame, GameMetadata } from "../stores/localGameStore";
import { useToastStore } from "../stores/toastStore";

type ScanStep = "config" | "scanning" | "results" | "done";

interface ScanProgress {
  scanned_dirs: number;
  total_dirs: number;
  found_games: number;
}

export default function GameScannerPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const store = useLocalGameStore();
  const toast = useToastStore();
  const [step, setStep] = useState<ScanStep>("config");
  const [progress, setProgress] = useState<ScanProgress>({ scanned_dirs: 0, total_dirs: 0, found_games: 0 });
  const [results, setResults] = useState<ScannedGame[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeLaunchers, setIncludeLaunchers] = useState(false);

  useEffect(() => {
    store.loadScanConfig();
  }, []);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleAddPath = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir && store.scanConfig) {
      const newPaths = [...store.scanConfig.scan_paths, dir as string];
      await store.updateScanConfig({ ...store.scanConfig, scan_paths: newPaths });
    }
  };

  const handleRemovePath = async (path: string) => {
    if (store.scanConfig) {
      const newPaths = store.scanConfig.scan_paths.filter(p => p !== path);
      await store.updateScanConfig({ ...store.scanConfig, scan_paths: newPaths });
    }
  };

  const handleScan = async () => {
    if (!store.scanConfig) return;
    setStep("scanning");
    const excludeLaunchers = includeLaunchers ? [] : store.scanConfig.exclude_launchers;
    const found = await store.scanGames(store.scanConfig.scan_paths, excludeLaunchers);
    setResults(found);
    setSelected(new Set(found.map(g => g.exe_path)));
    setStep("results");
  };

  const toggleSelect = (exePath: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(exePath)) next.delete(exePath);
      else next.add(exePath);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const selectedGames = results.filter(g => selected.has(g.exe_path));
    const metadataMap: Record<string, GameMetadata> = {};
    for (const game of selectedGames) {
      const meta = await store.fetchMetadata(game.suggested_title);
      if (meta) {
        metadataMap[game.exe_path] = meta;
      }
    }
    await store.addScannedGames(selectedGames, metadataMap);
    toast.addToast(`${selectedGames.length} oyun eklendi!`, "success");
    setStep("done");
  };

  if (!store.scanConfig) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-50 mb-6">Oyun Tarayici</h1>

      {step === "config" && (
        <div className="space-y-6">
          <div className="bg-brand-800/50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={includeLaunchers} onChange={(e) => setIncludeLaunchers(e.target.checked)} className="w-4 h-4 accent-yellow-400" />
              <span className="text-brand-200">Steam, Epic, Ubisoft vb. oyunlarini da dahil et</span>
            </label>
          </div>
          <div className="bg-brand-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-400 mb-3">Tarama Klasorleri</h3>
            <div className="space-y-2">
              {store.scanConfig.scan_paths.map((path) => (
                <div key={path} className="flex items-center justify-between bg-brand-900/50 rounded px-3 py-2">
                  <span className="text-brand-200 text-sm font-mono truncate">{path}</span>
                  <button onClick={() => handleRemovePath(path)} className="text-red-400 hover:text-red-300 text-sm ml-2">Kaldir</button>
                </div>
              ))}
            </div>
            <button onClick={handleAddPath} className="mt-3 px-4 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded text-sm">+ Klasor Ekle</button>
          </div>
          <button onClick={handleScan} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-brand-900 font-bold rounded-lg text-lg">Taramayi Baslat</button>
        </div>
      )}

      {step === "scanning" && (
        <div className="text-center space-y-4 py-12">
          <div className="animate-spin w-12 h-12 border-3 border-yellow-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-brand-200">Oyunlar taraniyor...</p>
          <div className="bg-brand-800 rounded-full h-2 max-w-md mx-auto overflow-hidden">
            <div className="bg-yellow-400 h-full transition-all duration-300" style={{ width: `${progress.total_dirs ? (progress.scanned_dirs / progress.total_dirs) * 100 : 0}%` }} />
          </div>
          <p className="text-brand-400 text-sm">{progress.found_games} oyun bulundu | {progress.scanned_dirs}/{progress.total_dirs} klasor tarandi</p>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-brand-200">{results.length} oyun bulundu — eklemek istediklerini sec</p>
            <button onClick={handleAddSelected} disabled={selected.size === 0} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-brand-900 font-bold rounded">{selected.size} Oyunu Ekle</button>
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {results.map((game) => (
              <label key={game.exe_path} className="flex items-center gap-3 bg-brand-800/50 hover:bg-brand-800 rounded px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={selected.has(game.exe_path)} onChange={() => toggleSelect(game.exe_path)} className="w-4 h-4 accent-yellow-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-brand-100 font-medium truncate">{game.suggested_title}</p>
                  <p className="text-brand-400 text-xs font-mono truncate">{game.exe_path}</p>
                </div>
                {game.detected_launcher && <span className="text-xs bg-brand-700 text-brand-300 px-2 py-1 rounded capitalize">{game.detected_launcher}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-12 space-y-4">
          <div className="text-5xl text-green-400">✓</div>
          <p className="text-brand-100 text-xl font-bold">Oyunlar Eklendi!</p>
          <p className="text-brand-400">Kutuphanene git ve oyunlarini gor</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate("library")} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-brand-900 font-bold rounded">Kutuphaneye Git</button>
            <button onClick={() => setStep("config")} className="px-6 py-2 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded">Tekrar Tara</button>
          </div>
        </div>
      )}
    </div>
  );
}
