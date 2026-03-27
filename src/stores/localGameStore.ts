import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
}));
