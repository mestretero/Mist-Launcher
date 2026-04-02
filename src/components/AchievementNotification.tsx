import { useAchievementNotifStore } from "../stores/achievementNotifStore";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

function AchievementCard({ notif, onDismiss }: { notif: { id: string; name: string; description?: string; iconUrl?: string }; onDismiss: () => void }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    // Start exit animation before auto-dismiss
    const exitTimer = setTimeout(() => setVisible(false), 5400);
    return () => clearTimeout(exitTimer);
  }, []);

  return (
    <div
      onClick={onDismiss}
      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer select-none transition-all duration-500 ease-out ${
        visible
          ? "translate-x-0 opacity-100"
          : "translate-x-[120%] opacity-0"
      }`}
      style={{
        background: "linear-gradient(135deg, #1b2838ee, #0e1621ee)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(71, 191, 255, 0.3)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(71, 191, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        minWidth: "340px",
        maxWidth: "420px",
      }}
    >
      {/* Trophy glow */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-lg bg-yellow-400/20 blur-md" />
        <div className="relative w-14 h-14 rounded-lg bg-[#0a0c10] border border-[#2a2e38] flex items-center justify-center overflow-hidden">
          {notif.iconUrl ? (
            <img src={notif.iconUrl} alt="" className="w-10 h-10 object-contain" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/80 mb-0.5">
          {t("library.achievementUnlocked", "Başarım Kazanıldı!")}
        </div>
        <p className="text-sm font-bold text-white truncate">{notif.name}</p>
        {notif.description && (
          <p className="text-[11px] text-[#8f98a0] truncate mt-0.5">{notif.description}</p>
        )}
      </div>

      {/* Shine effect */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
    </div>
  );
}

export function AchievementNotification() {
  const notifications = useAchievementNotifStore((s) => s.notifications);
  const dismiss = useAchievementNotifStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {notifications.map((notif) => (
        <div key={notif.id} className="pointer-events-auto">
          <AchievementCard notif={notif} onDismiss={() => dismiss(notif.id)} />
        </div>
      ))}
    </div>
  );
}
