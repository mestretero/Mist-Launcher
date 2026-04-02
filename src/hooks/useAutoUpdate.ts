import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useToastStore } from "../stores/toastStore";

export function useAutoUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    // Check for updates 3 seconds after app launch
    const timer = setTimeout(async () => {
      try {
        const available = await check();
        if (available) {
          setUpdate(available);
          addToast(`MIST ${available.version} available!`, "info");
        }
      } catch {
        // Silently fail — no internet or endpoint not configured yet
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const installUpdate = async () => {
    if (!update || downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        }
        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) setProgress(Math.round((downloadedBytes / totalBytes) * 100));
        }
        if (event.event === "Finished") {
          setProgress(100);
        }
      });
      addToast("Update installed — restarting...", "success");
      await relaunch();
    } catch (err: any) {
      addToast(err?.message || "Update failed", "error");
      setDownloading(false);
    }
  };

  return { update, downloading, progress, installUpdate };
}
