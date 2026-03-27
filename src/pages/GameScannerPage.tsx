import { useState, useEffect, useMemo } from "react";
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
  const [showOther, setShowOther] = useState(false);
  const [, setExeChoices] = useState<Record<string, string>>({});
  // Track which drives are selected for scanning
  const [selectedDrives, setSelectedDrives] = useState<Set<string>>(new Set());

  useEffect(() => {
    store.loadScanConfig();
    store.loadDrives();
  }, []);

  // Auto-select all drives when they load
  useEffect(() => {
    if (store.drives.length > 0 && selectedDrives.size === 0) {
      setSelectedDrives(new Set(store.drives.map(d => d.letter)));
    }
  }, [store.drives]);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Split results by confidence: >=50 = likely game, <50 = other
  const { likelyGames, otherResults } = useMemo(() => {
    const likely: ScannedGame[] = [];
    const other: ScannedGame[] = [];
    for (const game of results) {
      if (game.confidence >= 50) {
        likely.push(game);
      } else {
        other.push(game);
      }
    }
    return { likelyGames: likely, otherResults: other };
  }, [results]);

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

  const toggleDrive = (letter: string) => {
    setSelectedDrives(prev => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const handleScan = async () => {
    if (!store.scanConfig) return;
    setStep("scanning");
    const excludeLaunchers = includeLaunchers ? [] : store.scanConfig.exclude_launchers;
    // Combine: selected drives + any custom paths from config
    const drivePaths = [...selectedDrives].map(d => d + "\\");
    const customPaths = store.scanConfig.scan_paths.filter(p => !drivePaths.some(dp => p.toLowerCase().startsWith(dp.toLowerCase().replace("\\", ""))));
    const allPaths = [...drivePaths, ...customPaths];
    const found = await store.scanGames(allPaths, excludeLaunchers);
    setResults(found);
    // Auto-select games with high confidence (>=50)
    const autoSelected = new Set(found.filter(g => g.confidence >= 50).map(g => g.exe_path));
    setSelected(autoSelected);
    // Init exe choices to the backend's default pick
    const choices: Record<string, string> = {};
    for (const g of found) { choices[g.install_path] = g.exe_path; }
    setExeChoices(choices);
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

  const selectAllInGroup = (games: ScannedGame[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      games.forEach(g => next.add(g.exe_path));
      return next;
    });
  };

  const deselectAllInGroup = (games: ScannedGame[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      games.forEach(g => next.delete(g.exe_path));
      return next;
    });
  };

  const changeExe = (game: ScannedGame, newExePath: string) => {
    // Update the selected set: remove old, add new if was selected
    const wasSelected = selected.has(game.exe_path);
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(game.exe_path);
      if (wasSelected) next.add(newExePath);
      return next;
    });
    // Update results to reflect new exe_path
    setResults(prev => prev.map(g =>
      g.install_path === game.install_path ? { ...g, exe_path: newExePath } : g
    ));
    setExeChoices(prev => ({ ...prev, [game.install_path]: newExePath }));
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

  const selectedCount = selected.size;
  const selectedInOther = otherResults.filter(g => selected.has(g.exe_path)).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-brand-50 mb-6">Oyun Tarayici</h1>

      {step === "config" && (
        <div className="space-y-6">
          {/* Drive Selection */}
          <div className="bg-brand-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-400 mb-3">Taranacak Diskler</h3>
            <div className="grid grid-cols-2 gap-2">
              {store.drives.map((drive) => {
                const isSelected = selectedDrives.has(drive.letter);
                const usedPercent = drive.total_bytes > 0 ? ((drive.total_bytes - drive.free_bytes) / drive.total_bytes) * 100 : 0;
                const freeGB = (drive.free_bytes / (1024 ** 3)).toFixed(0);
                const totalGB = (drive.total_bytes / (1024 ** 3)).toFixed(0);
                return (
                  <button
                    key={drive.letter}
                    onClick={() => toggleDrive(drive.letter)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? "border-yellow-400/50 bg-yellow-400/10"
                        : "border-brand-700 bg-brand-900/30 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#facc15" : "#5e6673"} strokeWidth="1.5">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                        <circle cx="18" cy="7" r="1" fill={isSelected ? "#facc15" : "#5e6673"}/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-bold text-sm ${isSelected ? "text-yellow-400" : "text-brand-300"}`}>{drive.letter}</span>
                        <span className="text-brand-400 text-xs truncate">{drive.label}</span>
                      </div>
                      <div className="w-full bg-brand-800 rounded-full h-1.5 mt-1.5">
                        <div className="bg-brand-500 h-full rounded-full" style={{ width: `${usedPercent}%` }} />
                      </div>
                      <span className="text-brand-500 text-[10px]">{freeGB} GB bos / {totalGB} GB</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="bg-brand-800/50 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={includeLaunchers} onChange={(e) => setIncludeLaunchers(e.target.checked)} className="w-4 h-4 accent-yellow-400" />
              <span className="text-brand-200 text-sm">Steam, Epic, Ubisoft vb. oyunlarini da dahil et</span>
            </label>
          </div>

          {/* Custom Paths */}
          {store.scanConfig.scan_paths.length > 0 && (
            <div className="bg-brand-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-400 mb-2">Ek Klasorler</h3>
              <div className="space-y-1">
                {store.scanConfig.scan_paths.map((path) => (
                  <div key={path} className="flex items-center justify-between bg-brand-900/50 rounded px-3 py-1.5">
                    <span className="text-brand-300 text-xs font-mono truncate">{path}</span>
                    <button onClick={() => handleRemovePath(path)} className="text-red-400 hover:text-red-300 text-xs ml-2">x</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleAddPath} className="text-brand-400 hover:text-brand-200 text-xs">+ Ozel klasor ekle</button>

          <button
            onClick={handleScan}
            disabled={selectedDrives.size === 0}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-brand-900 font-bold rounded-lg text-lg"
          >
            {selectedDrives.size} Diski Tara
          </button>
        </div>
      )}

      {step === "scanning" && (
        <div className="text-center space-y-4 py-12">
          <div className="animate-spin w-12 h-12 border-3 border-yellow-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-brand-200">Oyunlar taraniyor...</p>
          <div className="bg-brand-800 rounded-full h-2 max-w-md mx-auto overflow-hidden">
            <div className="bg-yellow-400 h-full transition-all duration-300" style={{ width: `${progress.total_dirs ? (progress.scanned_dirs / progress.total_dirs) * 100 : 0}%` }} />
          </div>
          <p className="text-brand-400 text-sm">{progress.found_games} sonuc bulundu | {progress.scanned_dirs}/{progress.total_dirs} klasor tarandi</p>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <p className="text-brand-200">{results.length} sonuc bulundu</p>
            <button onClick={handleAddSelected} disabled={selectedCount === 0} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-brand-900 font-bold rounded">
              {selectedCount} Oyunu Ekle
            </button>
          </div>

          {/* Likely Games Group */}
          {likelyGames.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-green-400">
                  Oyunlar ({likelyGames.length})
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => selectAllInGroup(likelyGames)} className="text-xs text-brand-400 hover:text-brand-200">Tumunu sec</button>
                  <span className="text-brand-600">|</span>
                  <button onClick={() => deselectAllInGroup(likelyGames)} className="text-xs text-brand-400 hover:text-brand-200">Tumunu kaldir</button>
                </div>
              </div>
              <div className="space-y-1 max-h-[35vh] overflow-y-auto">
                {likelyGames.map((game) => (
                  <GameResultRow key={game.install_path} game={game} selected={selected.has(game.exe_path)} onToggle={() => toggleSelect(game.exe_path)} onChangeExe={(p) => changeExe(game, p)} />
                ))}
              </div>
            </div>
          )}

          {/* Other Results Group */}
          {otherResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 mt-4">
                <button onClick={() => setShowOther(!showOther)} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-400 hover:text-brand-200">
                  <span className="text-xs">{showOther ? "▼" : "►"}</span>
                  Diger Sonuclar ({otherResults.length})
                  {selectedInOther > 0 && <span className="text-yellow-400 normal-case tracking-normal font-normal">({selectedInOther} secili)</span>}
                </button>
                {showOther && (
                  <div className="flex gap-2">
                    <button onClick={() => selectAllInGroup(otherResults)} className="text-xs text-brand-400 hover:text-brand-200">Tumunu sec</button>
                    <span className="text-brand-600">|</span>
                    <button onClick={() => deselectAllInGroup(otherResults)} className="text-xs text-brand-400 hover:text-brand-200">Tumunu kaldir</button>
                  </div>
                )}
              </div>
              {showOther && (
                <div className="space-y-1 max-h-[35vh] overflow-y-auto">
                  {otherResults.map((game) => (
                    <GameResultRow key={game.install_path} game={game} selected={selected.has(game.exe_path)} onToggle={() => toggleSelect(game.exe_path)} onChangeExe={(p) => changeExe(game, p)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {likelyGames.length === 0 && otherResults.length > 0 && !showOther && (
            <p className="text-brand-400 text-center py-4">Bilinen launcher'a ait oyun bulunamadi. "Diger Sonuclar"i acarak manuel secim yapabilirsin.</p>
          )}
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

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function GameResultRow({ game, selected, onToggle, onChangeExe }: {
  game: ScannedGame;
  selected: boolean;
  onToggle: () => void;
  onChangeExe: (exePath: string) => void;
}) {
  const hasMultipleExes = game.available_exes.length > 1;

  return (
    <div className={`rounded px-4 py-3 transition-colors ${selected ? "bg-brand-800" : "bg-brand-800/30 opacity-70 hover:opacity-100"}`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 accent-yellow-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-brand-100 font-medium truncate">{game.suggested_title}</p>
          {!hasMultipleExes && (
            <p className="text-brand-400 text-xs font-mono truncate">{game.exe_path}</p>
          )}
        </div>
        {game.detected_launcher && (
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded capitalize shrink-0">{game.detected_launcher}</span>
        )}
      </label>
      {hasMultipleExes && (
        <div className="ml-7 mt-2">
          <select
            value={game.exe_path}
            onChange={(e) => onChangeExe(e.target.value)}
            className="w-full bg-brand-900 text-brand-200 text-xs font-mono rounded px-2 py-1.5 border border-brand-700 focus:border-yellow-400 outline-none"
          >
            {game.available_exes.map((exe) => (
              <option key={exe.path} value={exe.path}>
                {exe.file_name} ({formatSize(exe.size_bytes)})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
