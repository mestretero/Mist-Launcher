import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const appWindow = getCurrentWindow();

  return (
    <div
      className="fixed top-0 right-0 z-50 flex h-10"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        onClick={() => appWindow.minimize()}
        className="w-12 h-full flex items-center justify-center text-brand-500 hover:bg-brand-800 hover:text-white transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="w-12 h-full flex items-center justify-center text-brand-500 hover:bg-brand-800 hover:text-white transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      </button>
      <button
        onClick={() => appWindow.close()}
        className="w-12 h-full flex items-center justify-center text-brand-500 hover:bg-red-500 hover:text-white transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
