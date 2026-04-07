import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Phase = "idle" | "checking" | "downloading" | "installing" | "ready" | "error";

export function useAutoUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const available = await check();
        if (cancelled) return;
        if (!available) {
          setPhase("idle");
          return;
        }

        // Auto-install — block UI like Steam does
        setUpdate(available);
        setPhase("downloading");

        let totalBytes = 0;
        let downloadedBytes = 0;
        await available.downloadAndInstall((event) => {
          if (cancelled) return;
          if (event.event === "Started" && event.data.contentLength) {
            totalBytes = event.data.contentLength;
          }
          if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          }
          if (event.event === "Finished") {
            setProgress(100);
            setPhase("installing");
          }
        });

        if (cancelled) return;
        setPhase("ready");
        // Brief pause so user sees "installed" state, then relaunch
        await new Promise((r) => setTimeout(r, 800));
        await relaunch();
      } catch (err: any) {
        if (cancelled) return;
        console.error("[updater] failed:", err);
        // On any error, fall through to normal app — don't block
        setError(err?.message || "Update failed");
        setPhase("idle");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const isBlocking = phase === "downloading" || phase === "installing" || phase === "ready";

  return { update, phase, progress, error, isBlocking };
}
