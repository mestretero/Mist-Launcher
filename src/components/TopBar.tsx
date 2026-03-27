import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useNotificationStore } from "../stores/notificationStore";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface TopBarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

export function TopBar({ currentPage, onNavigate, canGoBack, canGoForward, onGoBack, onGoForward }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const cartItemCount = useCartStore((s) => s.items.length);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
    { id: "store", label: "Magaza" },
    { id: "library", label: "Kutuphane" },
    { id: "collections", label: "Koleksiyonlar" },
    { id: "scanner", label: "Oyun Tara" },
  ];

  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  return (
    <div
      onMouseDown={handleDrag}
      className="w-full flex-shrink-0 flex items-center justify-between h-11 bg-brand-950 border-b border-brand-800/50 select-none text-[#8f98a0]"
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
              title="Istek Listesi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            {/* Friends */}
            <button onClick={() => onNavigate("friends")}
              className={`p-1.5 rounded transition-colors ${currentPage === "friends" ? "text-[#1a9fff]" : "text-brand-400 hover:text-white hover:bg-brand-800"}`}
              title="Arkadaslar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </button>
            {/* Notifications */}
            <button onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 rounded text-brand-400 hover:text-white hover:bg-brand-800 transition-colors"
              title="Bildirimler">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>}
            </button>
            {/* Cart */}
            <button onClick={() => onNavigate("cart")}
              className={`relative p-1.5 rounded transition-colors ${currentPage === "cart" ? "text-[#1a9fff]" : "text-brand-400 hover:text-white hover:bg-brand-800"}`}
              title="Sepet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartItemCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{cartItemCount}</span>}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-brand-800 mx-1" />

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-brand-800 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">
                  {user.username.slice(0, 2).toUpperCase()}
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
                    <span className="text-xs text-brand-400">Cuzdan</span>
                    <span className="text-xs font-bold text-brand-200">{user.walletBalance ? parseFloat(user.walletBalance).toFixed(2) : "0.00"} TL</span>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    {[
                      { id: "profile", label: "Profil", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" },
                      { id: "settings", label: "Ayarlar", icon: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" },
                    ].map(item => (
                      <button key={item.id}
                        onClick={() => { onNavigate(item.id); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={item.icon}/></svg>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {/* Logout */}
                  <div className="border-t border-brand-800 py-1">
                    <button onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Cikis Yap
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
        <div className="fixed top-11 right-40 z-50 w-72 bg-brand-900 border border-brand-700 rounded-lg shadow-2xl p-3" style={noDrag}>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-brand-800">
            <h3 className="text-xs font-bold text-brand-200 uppercase tracking-widest">Bildirimler</h3>
            <button onClick={() => setShowNotifications(false)} className="text-brand-500 hover:text-white text-xs">X</button>
          </div>
          {unreadCount === 0
            ? <p className="text-xs text-brand-500 text-center py-3">Yeni bildirim yok</p>
            : <p className="text-xs text-brand-400 text-center py-3">{unreadCount} okunmamis bildirim</p>
          }
        </div>
      )}
    </div>
  );
}
