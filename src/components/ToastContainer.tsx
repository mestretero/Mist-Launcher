import type { ReactNode } from "react";
import { useToastStore } from "../stores/toastStore";

const icons: Record<string, ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const colors: Record<string, string> = {
  success: "border-green-500/50 text-green-400",
  error: "border-red-500/50 text-red-400",
  info: "border-[#47bfff]/50 text-[#47bfff]",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-lg bg-[#1a1c23]/95 backdrop-blur-md border shadow-2xl cursor-pointer animate-slide-in ${colors[toast.type]}`}
        >
          <span className="flex-shrink-0">{icons[toast.type]}</span>
          <span className="text-sm font-semibold text-[#c6d4df]">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
