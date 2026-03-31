import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";

async function hashExePath(exePath: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(exePath);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface LocalGame {
  id: string;
  title: string;
  exe_path: string;
  install_path: string | null;
  source: "scan" | "manual" | "store";
  launcher: string | null;
  cover_url: string | null;
  description: string | null;
  genres: string[] | null;
  added_at: string;
  last_played: string | null;
  play_time: number;
}

export interface ExeOption {
  path: string;
  file_name: string;
  size_bytes: number;
}

export interface ScannedGame {
  exe_path: string;
  suggested_title: string;
  install_path: string;
  detected_launcher: string | null;
  available_exes: ExeOption[];
  confidence: number;
}

export interface ScanConfig {
  scan_paths: string[];
  exclude_launchers: string[];
  last_scan_at: string | null;
}

export interface GameMetadata {
  title: string;
  cover_url: string | null;
  description: string | null;
  genres: string[] | null;
}

export interface DriveInfo {
  letter: string;
  label: string;
  total_bytes: number;
  free_bytes: number;
}

interface LocalGameState {
  games: LocalGame[];
  scanConfig: ScanConfig | null;
  drives: DriveInfo[];
  loading: boolean;
  scanning: boolean;
  loadGames: () => Promise<void>;
  loadScanConfig: () => Promise<void>;
  loadDrives: () => Promise<void>;
  updateScanConfig: (config: ScanConfig) => Promise<void>;
  scanGames: (paths: string[], excludeLaunchers: string[]) => Promise<ScannedGame[]>;
  addScannedGames: (games: ScannedGame[], metadataMap: Record<string, GameMetadata>) => Promise<void>;
  addManualGame: (exePath: string, metadata: GameMetadata) => Promise<void>;
  updateGame: (gameId: string, metadata: GameMetadata) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  fetchMetadata: (title: string) => Promise<GameMetadata | null>;
  clearMetadataCache: () => Promise<void>;
  refreshCovers: () => Promise<number>;
  syncToServer: () => Promise<void>;
  syncSingleGame: (exePath: string, playTimeMins: number, title: string) => Promise<void>;
}

export const useLocalGameStore = create<LocalGameState>((set, get) => ({
  games: [],
  scanConfig: null,
  drives: [],
  loading: false,
  scanning: false,

  loadGames: async () => {
    set({ loading: true });
    try {
      const games = await invoke<LocalGame[]>("get_local_games");
      set({ games });
    } finally {
      set({ loading: false });
    }
  },

  loadScanConfig: async () => {
    const config = await invoke<ScanConfig>("get_scan_config");
    set({ scanConfig: config });
  },

  loadDrives: async () => {
    const drives = await invoke<DriveInfo[]>("list_drives");
    set({ drives });
  },

  updateScanConfig: async (config) => {
    await invoke("update_scan_config", { config });
    set({ scanConfig: config });
  },

  scanGames: async (paths, excludeLaunchers) => {
    set({ scanning: true });
    try {
      return await invoke<ScannedGame[]>("scan_games", { paths, excludeLaunchers });
    } finally {
      set({ scanning: false });
    }
  },

  addScannedGames: async (games, metadataMap) => {
    await invoke("add_scanned_games", { games, metadataMap });
    await get().loadGames();
  },

  addManualGame: async (exePath, metadata) => {
    await invoke("add_manual_game", { exePath, metadata });
    await get().loadGames();
  },

  updateGame: async (gameId, metadata) => {
    await invoke("update_game", { gameId, metadata });
    await get().loadGames();
  },

  deleteGame: async (gameId) => {
    await invoke("delete_game", { gameId });
    await get().loadGames();
  },

  fetchMetadata: async (title) => {
    return await invoke<GameMetadata | null>("fetch_metadata", { gameTitle: title });
  },

  clearMetadataCache: async () => {
    await invoke("clear_metadata_cache");
  },

  refreshCovers: async () => {
    const { games, fetchMetadata, updateGame } = get();
    let updated = 0;
    await invoke("clear_metadata_cache");
    for (const game of games) {
      if (!game.cover_url) {
        const meta = await fetchMetadata(game.title);
        if (meta && meta.cover_url) {
          await updateGame(game.id, { ...meta, title: game.title });
          updated++;
        }
      }
    }
    await get().loadGames();
    return updated;
  },

  syncToServer: async () => {
    try {
      const { games } = get();
      if (games.length === 0) return;
      const payload = await Promise.all(
        games.map(async (g) => ({
          title: g.title,
          coverUrl: g.cover_url || null,
          playTimeMins: Math.floor(g.play_time / 60),
          exePathHash: await hashExePath(g.exe_path),
          lastPlayedAt: g.last_played || null,
        }))
      );
      await api.profiles.syncGames(payload);
    } catch {
      // Silent failure — next startup will retry
    }
  },

  syncSingleGame: async (exePath, playTimeMins, title) => {
    try {
      const exePathHash = await hashExePath(exePath);
      await api.profiles.syncGame({
        exePathHash,
        playTimeMins,
        lastPlayedAt: new Date().toISOString(),
        title,
      });
    } catch {
      // Silent failure — next bulk sync will catch up
    }
  },
}));
