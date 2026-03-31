import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNotificationStore } from "../stores/notificationStore";

interface NotificationPanelProps {
  onClose: () => void;
}

function timeAgo(dateStr: string, t: (key: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotificationIcon({ type }: { type: string }) {
  const className = "w-4 h-4";
  if (type === "PAYMENT_SUCCESS") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    );
  }
  if (type === "FRIEND_REQUEST" || type === "FRIEND_ACCEPTED") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (type === "WISHLIST_SALE") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { t } = useTranslation();
  const { notifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const panel = document.getElementById("notification-panel");
      if (panel && !panel.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => window.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); window.removeEventListener("mousedown", handler); };
  }, [onClose]);

  return (
    <div
      id="notification-panel"
      className="absolute right-0 top-full mt-2 w-80 bg-brand-900 border border-brand-800 rounded shadow-2xl z-50 font-sans"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-800">
        <h3 className="text-xs font-black uppercase tracking-widest text-brand-200">
          {t("notifications.title")}
        </h3>
        <button
          onClick={() => markAllRead()}
          className="text-[10px] font-bold uppercase tracking-widest text-brand-500 hover:text-brand-200 transition-colors cursor-pointer"
        >
          {t("notifications.markAllRead")}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="text-center py-10">
            <svg className="mx-auto mb-2 text-brand-700" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest">
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => { if (!notification.isRead) markRead(notification.id); }}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-brand-800/50 transition-colors hover:bg-brand-800/50 cursor-pointer ${
                !notification.isRead ? "bg-brand-950/50" : ""
              }`}
            >
              <div className="w-8 h-8 rounded flex items-center justify-center bg-brand-950 border border-brand-800 flex-shrink-0 mt-0.5 text-brand-400">
                <NotificationIcon type={notification.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-brand-100 truncate">{notification.title}</p>
                  {!notification.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-brand-400 leading-relaxed mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-[10px] text-brand-600 font-medium mt-1">
                  {timeAgo(notification.createdAt, t)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
