import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DownloadInfo {
  downloadId: string;
  gameId: string;
  percent: number;
  speedBps: number;
  etaSecs: number;
}

interface DownloadState {
  downloads: Record<string, DownloadInfo>;
  startDownload: (gameId: string, url: string, destPath: string) => Promise<string>;
  initListener: () => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: {},

  startDownload: async (gameId, url, destPath) => {
    const downloadId = await invoke<string>("download_game", {
      gameId, url, destPath,
    });
    set((state) => ({
      downloads: {
        ...state.downloads,
        [gameId]: { downloadId, gameId, percent: 0, speedBps: 0, etaSecs: 0 },
      },
    }));
    return downloadId;
  },

  initListener: async () => {
    await listen<any>("download-progress", (event) => {
      const { download_id, percent, speed_bps, eta_secs } = event.payload;
      set((state) => {
        const entry = Object.values(state.downloads).find((d) => d.downloadId === download_id);
        if (!entry) return state;
        return {
          downloads: {
            ...state.downloads,
            [entry.gameId]: { ...entry, percent, speedBps: speed_bps, etaSecs: eta_secs },
          },
        };
      });
    });
  },
}));
