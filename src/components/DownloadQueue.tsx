import { useDownloadStore } from "../stores/downloadStore";

function formatSpeed(bps: number): string {
  if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatEta(secs: number): string {
  if (secs <= 0) return "";
  if (secs < 60) return `${secs}sn`;
  if (secs < 3600) return `${Math.floor(secs / 60)}dk ${secs % 60}sn`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}sa ${m}dk`;
}

export function DownloadQueue() {
  const downloads = useDownloadStore((s) => s.downloads);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const entries = Object.values(downloads);

  if (entries.length === 0) {
    return (
      <div className="rounded bg-brand-900 border border-brand-800 p-8 text-center font-sans">
        <svg className="mx-auto mb-3 text-brand-700" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <p className="text-sm font-bold text-brand-500 uppercase tracking-widest">
          Indirme kuyrugu bos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {entries.map((dl) => (
        <div
          key={dl.gameId}
          className="rounded bg-brand-900 border border-brand-800 p-4"
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded bg-brand-950 border border-brand-800 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span className="text-sm font-bold text-brand-100 truncate">
                {dl.gameId}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <button
                onClick={() => dl.paused ? resumeDownload(dl.gameId) : pauseDownload(dl.gameId)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest bg-brand-950 border transition-colors ${
                  dl.paused
                    ? "text-green-400 border-green-900/50 hover:border-green-700/50"
                    : "text-brand-400 border-brand-800 hover:text-yellow-400 hover:border-yellow-900/50"
                }`}
                title={dl.paused ? "Devam Et" : "Durakla"}
              >
                {dl.paused ? "Devam" : "Durakla"}
              </button>
              <button
                onClick={() => cancelDownload(dl.gameId)}
                className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
                title="Iptal"
              >
                Iptal
              </button>
            </div>
          </div>

          {/* Progress info */}
          <div className="flex justify-between text-[11px] font-bold tracking-widest uppercase text-brand-400 mb-2">
            <span>{dl.percent.toFixed(0)}%</span>
            <div className="flex gap-3">
              {dl.etaSecs > 0 && (
                <span className="text-brand-500">{formatEta(dl.etaSecs)} kaldi</span>
              )}
              <span>{formatSpeed(dl.speedBps)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-brand-950 border border-brand-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-200 transition-all duration-300 ease-out"
              style={{ width: `${dl.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
