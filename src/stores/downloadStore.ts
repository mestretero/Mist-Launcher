import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DownloadInfo {
  downloadId: string;
  gameId: string;
  percent: number;
  speedBps: number;
  etaSecs: number;
  paused: boolean;
}

interface DownloadState {
  downloads: Record<string, DownloadInfo>;
  startDownload: (gameId: string, url: string, destPath: string) => Promise<string>;
  pauseDownload: (gameId: string) => Promise<void>;
  resumeDownload: (gameId: string) => Promise<void>;
  cancelDownload: (gameId: string) => Promise<void>;
  initListener: () => Promise<void>;
  _unlisten: (() => void) | null;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: {},
  _unlisten: null,

  startDownload: async (gameId, url, destPath) => {
    const downloadId = await invoke<string>("download_game", {
      gameId, url, destPath,
    });
    set((state) => ({
      downloads: {
        ...state.downloads,
        [gameId]: { downloadId, gameId, percent: 0, speedBps: 0, etaSecs: 0, paused: false },
      },
    }));
    return downloadId;
  },

  pauseDownload: async (gameId) => {
    const entry = useDownloadStore.getState().downloads[gameId];
    if (!entry) return;
    try {
      await invoke("pause_download", { downloadId: entry.downloadId });
    } catch {
      // Tauri command may not exist yet — toggle state locally
    }
    set((state) => ({
      downloads: {
        ...state.downloads,
        [gameId]: { ...state.downloads[gameId], paused: true, speedBps: 0, etaSecs: 0 },
      },
    }));
  },

  resumeDownload: async (gameId) => {
    const entry = useDownloadStore.getState().downloads[gameId];
    if (!entry) return;
    try {
      await invoke("resume_download", { downloadId: entry.downloadId });
    } catch {
      // Tauri command may not exist yet — toggle state locally
    }
    set((state) => ({
      downloads: {
        ...state.downloads,
        [gameId]: { ...state.downloads[gameId], paused: false },
      },
    }));
  },

  cancelDownload: async (gameId) => {
    const entry = useDownloadStore.getState().downloads[gameId];
    if (entry) {
      try {
        await invoke("cancel_download", { downloadId: entry.downloadId });
      } catch {
        // Tauri command may not exist yet — just remove from state
      }
    }
    set((state) => {
      const { [gameId]: _, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },

  initListener: async () => {
    // Cleanup previous listener to prevent leaks
    get()._unlisten?.();
    const unlisten = await listen<any>("download-progress", (event) => {
      const { download_id, percent, speed_bps, eta_secs } = event.payload;
      set((state) => {
        const entry = Object.values(state.downloads).find((d) => d.downloadId === download_id);
        if (!entry) return state;
        return {
          downloads: {
            ...state.downloads,
            [entry.gameId]: { ...entry, percent, speedBps: speed_bps, etaSecs: eta_secs, paused: entry.paused },
          },
        };
      });
    });
    set({ _unlisten: unlisten });
  },
}));
