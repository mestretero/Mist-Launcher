import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import { useDownloadStore } from "../stores/downloadStore";
import { DownloadProgress } from "../components/DownloadProgress";
import type { LibraryItem } from "../lib/types";

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const { downloads, startDownload } = useDownloadStore();

  useEffect(() => {
    api.library.list().then(setItems);
  }, []);

  const handleDownload = async (item: LibraryItem) => {
    const { url } = await api.library.download(item.id);
    const destPath = `${await getDownloadDir()}/${item.game.slug}.zip`;
    await startDownload(item.gameId, url, destPath);
  };

  const handleLaunch = async (item: LibraryItem) => {
    try {
      await invoke("launch_game", {
        gameId: item.gameId,
        exePath: item.installPath || `C:/Games/Stealike/${item.game.slug}/game.exe`,
      });
    } catch (err) {
      console.error("Launch failed:", err);
    }
  };

  const formatPlayTime = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Kütüphanem</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">Henüz oyun yok. Mağazadan oyun satın al!</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const dl = downloads[item.gameId];
            const isDownloading = dl && dl.percent < 100;
            const isDownloaded = dl && dl.percent >= 100;

            return (
              <div key={item.id} className="flex items-center gap-4 bg-gray-900 rounded-xl border border-gray-800 p-3">
                <img src={item.game.coverImageUrl} alt={item.game.title}
                  className="w-24 h-14 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.game.title}</h3>
                  <p className="text-xs text-gray-500">
                    {item.playTimeMins > 0 ? formatPlayTime(item.playTimeMins) : "Henüz oynanmadı"}
                  </p>
                </div>

                {isDownloading ? (
                  <DownloadProgress percent={dl.percent} speedBps={dl.speedBps} etaSecs={dl.etaSecs} />
                ) : isDownloaded ? (
                  <button onClick={() => handleLaunch(item)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium">
                    Oyna
                  </button>
                ) : (
                  <button onClick={() => handleDownload(item)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
                    İndir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
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
