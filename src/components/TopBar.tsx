import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useNotificationStore } from "../stores/notificationStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "../lib/api";

interface TopBarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onRefresh: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

export function TopBar({ currentPage, onNavigate, onRefresh, canGoBack, canGoForward, onGoBack, onGoForward }: TopBarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const cartItemCount = useCartStore((s) => s.items.length);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDrag = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) appWindow.startDragging();
  };

  const navItems = [
    { id: "store", label: t("nav.store") },
    { id: "library", label: t("nav.library") },
    { id: "collections", label: t("nav.collections") },
    { id: "scanner", label: t("nav.scanner") },
    { id: "multiplayer", label: t("nav.multiplayer") },
    { id: "marketplace", label: t("nav.marketplace") },
  ];

  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  return (
    <div
      onMouseDown={handleDrag}
      className="relative z-[100] w-full flex-shrink-0 flex items-center justify-between h-11 bg-brand-950 border-b border-brand-800/50 select-none text-[#8f98a0] shadow-md"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: Nav arrows + Brand + Tabs */}
      <div className="flex items-center h-full min-w-0" onMouseDown={handleDrag}>
        {/* Back/Forward */}
        <div className="flex items-center gap-0.5 px-2 shrink-0" style={noDrag}>
          <button onClick={onGoBack} disabled={!canGoBack}
            className={`p-1 rounded ${canGoBack ? "text-brand-400 hover:text-white hover:bg-brand-800" : "text-brand-800"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={onGoForward} disabled={!canGoForward}
            className={`p-1 rounded ${canGoForward ? "text-brand-400 hover:text-white hover:bg-brand-800" : "text-brand-800"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button
            onClick={() => {
              import("../stores/localGameStore").then(({ useLocalGameStore }) => {
                useLocalGameStore.getState().loadGames().then(() => {
                  useLocalGameStore.getState().syncToServer();
                });
              }).catch(() => {});
              onRefresh();
            }}
            className="p-1 rounded text-brand-400 hover:text-white hover:bg-brand-800 transition-colors"
            title={t("nav.refresh")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
        </div>

        {/* Brand */}
        <button onClick={() => onNavigate("store")} className="flex items-center gap-1.5 px-3 shrink-0" style={noDrag}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 9c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11zm-9 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3.5-2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
          <span className="text-sm font-bold text-white tracking-widest hidden sm:inline">STEALIKE</span>
        </button>

        {/* Main Nav */}
        <nav className="flex items-center h-full overflow-x-auto" style={noDrag}>
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`h-full px-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap transition-colors border-b-2 ${
                  isActive ? "text-white border-[#1a9fff]" : "text-[#8f98a0] border-transparent hover:text-white hover:border-brand-600"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Icons + Profile + Window Controls */}
      <div className="flex items-center h-full shrink-0" onMouseDown={handleDrag}>
        {user && (
          <div className="flex items-center gap-1 mr-1" style={noDrag}>
            {/* Wishlist */}
            <button onClick={() => onNavigate("wishlist")}
              className={`p-1.5 rounded transition-colors ${currentPage === "wishlist" ? "text-[#1a9fff]" : "text-brand-400 hover:text-white hover:bg-brand-800"}`}
              title={t("nav.wishlist")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            {/* Friends */}
            <button onClick={() => onNavigate("friends")}
              className={`p-1.5 rounded transition-colors ${currentPage === "friends" ? "text-[#1a9fff]" : "text-brand-400 hover:text-white hover:bg-brand-800"}`}
              title={t("nav.friends")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </button>
            {/* Notifications */}
            <button onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                if (next) {
                  api.notifications.list().then((data: any) => {
                    setNotifications(Array.isArray(data?.notifications) ? data.notifications : Array.isArray(data) ? data : []);
                  }).catch(() => {});
                }
              }}
              className="relative p-1.5 rounded text-brand-400 hover:text-white hover:bg-brand-800 transition-colors"
              title={t("notifications.title")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>}
            </button>
            {/* Cart — hidden */}
            {false && (
            <button onClick={() => onNavigate("cart")}
              className={`relative p-1.5 rounded transition-colors ${currentPage === "cart" ? "text-[#1a9fff]" : "text-brand-400 hover:text-white hover:bg-brand-800"}`}
              title={t("nav.cart")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartItemCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{cartItemCount}</span>}
            </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-brand-800 mx-1" />

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-brand-800 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px] overflow-hidden">
                  {user.avatarUrl
                    ? <img src={`http://localhost:3001${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                    : user.username.slice(0, 2).toUpperCase()
                  }
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-brand-500 transition-transform ${profileOpen ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-brand-900 border border-brand-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                  {/* User header */}
                  <div className="px-4 py-3 border-b border-brand-800">
                    <p className="text-sm font-bold text-white">{user.username}</p>
                    <p className="text-[10px] text-brand-400 mt-0.5">{user.email}</p>
                  </div>
                  {/* Wallet */}
                  <div className="px-4 py-2 border-b border-brand-800 flex items-center justify-between">
                    <span className="text-xs text-brand-400">{t("nav.wallet")}</span>
                    <span className="text-xs font-bold text-brand-200">{user.walletBalance ? Math.floor(parseFloat(user.walletBalance)) : "0"} SC</span>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { onNavigate("profile"); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {t("nav.profile")}
                    </button>
                    <button
                      onClick={() => { onNavigate("settings"); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09c-.658.003-1.25.396-1.51 1z"/></svg>
                      {t("nav.settings")}
                    </button>
                  </div>
                  {/* Logout */}
                  <div className="border-t border-brand-800 py-1">
                    <button onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      {t("nav.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Window Controls */}
        <div className="flex h-full" style={noDrag}>
          <button onClick={() => appWindow.minimize()}
            className="w-11 h-full flex items-center justify-center text-brand-500 hover:bg-brand-800 hover:text-white transition-colors">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button onClick={() => appWindow.toggleMaximize()}
            className="w-11 h-full flex items-center justify-center text-brand-500 hover:bg-brand-800 hover:text-white transition-colors">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          <button onClick={() => appWindow.close()}
            className="w-11 h-full flex items-center justify-center text-brand-500 hover:bg-red-500 hover:text-white transition-colors">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Notifications dropdown */}
      {showNotifications && (
        <div className="fixed top-11 right-40 z-50 w-80 bg-brand-900 border border-brand-700 rounded-lg shadow-2xl p-3 max-h-96 overflow-y-auto" style={noDrag}>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-brand-800">
            <h3 className="text-xs font-bold text-brand-200 uppercase tracking-widest">{t("notifications.title")}</h3>
            <button onClick={() => setShowNotifications(false)} className="text-brand-500 hover:text-white text-xs">X</button>
          </div>
          {notifications.length === 0 && unreadCount === 0
            ? <p className="text-xs text-brand-500 text-center py-3">{t("notifications.empty")}</p>
            : (
              <div className="space-y-2">
                {notifications.map((n: any) => (
                  <button key={n.id} onClick={() => {
                    setShowNotifications(false);
                    // Navigate based on notification type
                    if (n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPTED") onNavigate("friends");
                    else if (n.type === "PAYMENT" || n.type === "WALLET") onNavigate("settings");
                    else onNavigate("profile");
                    // Mark as read
                    if (!n.isRead) api.notifications.markRead(n.id).catch(() => {});
                  }} className={`w-full text-left p-2.5 rounded-lg text-xs cursor-pointer transition-colors hover:bg-brand-700/50 ${n.isRead ? "bg-brand-800/30 text-brand-500" : "bg-[#1a9fff]/5 border border-[#1a9fff]/20 text-brand-200"}`}>
                    <p className="font-medium">{n.message || n.content || n.type}</p>
                    <p className="text-[10px] text-brand-600 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </button>
                ))}
                {notifications.length === 0 && unreadCount > 0 && (
                  <p className="text-xs text-brand-400 text-center py-2">{t("notifications.unread", { count: unreadCount })}</p>
                )}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
