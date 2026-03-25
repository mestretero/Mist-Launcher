import { useState } from "react";
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

const StoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    {/* A rough approximation of the Steam logo shape */}
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 9c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11zm-9 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3.5-2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2-3.5c-.83 0-1.5-.67-1.5-1.5S12.17 7 13 7s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>
);

export function TopBar({ 
  currentPage, 
  onNavigate,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward
}: TopBarProps) {
  const { user, logout } = useAuthStore();
  const cartItemCount = useCartStore((s) => s.items.length);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [showWallet, setShowWallet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const appWindow = getCurrentWindow();

  // Drag handler for the custom title bar
  const handleDrag = (e: React.MouseEvent) => {
    // Sadece arka plana tıklandığında sürüklemeyi başlat (butonlara tıklanınca değil)
    if (e.target === e.currentTarget) {
      appWindow.startDragging();
    }
  };

  const navItems = [
    { id: "store", label: "MAĞAZA" },
    { id: "wishlist", label: "İSTEK LİSTESİ" },
    { id: "library", label: "KÜTÜPHANE" },
    { id: "collections", label: "KOLEKSİYONLAR" },
  ];

  if (user) {
    navItems.splice(1, 0, { id: "profile", label: user.username.toUpperCase() });
  }

  return (
    <div 
      onMouseDown={handleDrag}
      className="w-full flex-shrink-0 flex items-center justify-between h-12 bg-brand-950 border-b border-brand-800 select-none text-[#c6d4df]"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left Area */}
      <div className="flex items-center h-full pl-2" onMouseDown={handleDrag}>
        {/* Back / Forward arrows */}
        <div className="flex items-center mr-4 ml-2">
          <button 
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`p-1 transition-colors ${canGoBack ? "text-brand-500 hover:text-white" : "text-brand-800"}`} 
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            title="Geri Dön"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button 
            onClick={onGoForward}
            disabled={!canGoForward}
            className={`p-1 transition-colors ${canGoForward ? "text-brand-500 hover:text-white" : "text-brand-800"}`} 
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            title="İleri Git"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        {/* Brand */}
        <div 
          className="flex items-center gap-2 cursor-pointer mr-8" 
          onClick={() => onNavigate("store")}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="text-white">
            <StoreIcon />
          </div>
          <span className="text-lg font-bold text-white tracking-widest uppercase">
            STEALIKE
          </span>
        </div>

        {/* Main Navigation tabs */}
        <nav className="flex items-center gap-6 h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {navItems.map((item) => {
            const isActive = currentPage === item.id || (item.id === "profile" && currentPage === "settings");
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`font-semibold tracking-wider text-sm hover:text-white transition-colors uppercase ${
                  isActive ? "text-[#1a9fff]" : "text-[#c6d4df]"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Right Area */}
      <div className="flex items-center h-full" onMouseDown={handleDrag}>
        {/* User Info & Settings */}
        {user && (
          <div className="flex items-center gap-4 mr-6" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {/* Friends */}
            <button
              onClick={() => onNavigate("friends")}
              className="text-brand-400 hover:text-white transition-colors"
              title="Arkadaşlar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </button>
            {/* Notifications */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-brand-400 hover:text-white transition-colors"
              title="Bildirimler"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>}
            </button>
            {/* Cart */}
            <button
              onClick={() => onNavigate("cart")}
              className="relative text-brand-400 hover:text-white transition-colors mr-2"
              title="Sepet"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartItemCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{cartItemCount}</span>}
            </button>

            {/* Profile Block */}
            <div className="flex items-center gap-1">
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-l bg-brand-900 cursor-pointer hover:bg-brand-800 transition-colors"
                onClick={() => onNavigate("profile")}
              >
                <div className="w-6 h-6 rounded bg-brand-200 flex items-center justify-center text-brand-950 font-black text-xs">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-brand-100">{user.username}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 text-brand-500"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div
                className="flex items-center px-2 py-1 rounded-r bg-brand-900 cursor-pointer hover:bg-brand-800 transition-colors border-l border-brand-800"
                onClick={() => setShowWallet(!showWallet)}
                title="Cuzdan"
              >
                <span className="text-xs font-medium text-brand-400">{user.walletBalance ? parseFloat(user.walletBalance).toFixed(2) : "0.00"} TL</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate("settings")}
              className="text-brand-400 hover:text-white transition-colors"
              title="Ayarlar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button onClick={logout} className="text-xs text-brand-500 hover:text-white ml-2 transition-colors uppercase font-bold tracking-widest">
              ÇIKIŞ
            </button>
          </div>
        )}

        {/* Window Controls */}
        <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button
            onClick={() => appWindow.minimize()}
            className="w-12 h-full flex items-center justify-center text-brand-400 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="w-12 h-full flex items-center justify-center text-brand-400 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
          </button>
          <button
            onClick={() => appWindow.close()}
            className="w-12 h-full flex items-center justify-center text-brand-400 hover:bg-red-500 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      {/* Wallet dropdown */}
      {showWallet && user && (
        <div className="fixed top-12 right-40 z-50 w-72 bg-brand-900 border border-brand-800 rounded shadow-2xl p-4" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3 border-b border-brand-800 pb-2">
            <h3 className="text-sm font-bold text-brand-100 uppercase tracking-widest">Cuzdan</h3>
            <button onClick={() => setShowWallet(false)} className="text-brand-500 hover:text-white text-xs">X</button>
          </div>
          <div className="text-2xl font-black text-brand-100 mb-4">{user.walletBalance ? parseFloat(user.walletBalance).toFixed(2) : "0.00"} TL</div>
          <button
            onClick={() => { onNavigate("wallet"); setShowWallet(false); }}
            className="w-full py-2 rounded bg-brand-800 border border-brand-700 text-xs font-bold text-brand-200 uppercase tracking-widest hover:bg-brand-700 transition-colors"
          >
            Cuzdana Git
          </button>
        </div>
      )}

      {/* Notifications dropdown */}
      {showNotifications && (
        <div className="fixed top-12 right-56 z-50 w-80 bg-brand-900 border border-brand-800 rounded shadow-2xl p-4 max-h-96 overflow-y-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3 border-b border-brand-800 pb-2">
            <h3 className="text-sm font-bold text-brand-100 uppercase tracking-widest">Bildirimler</h3>
            <button onClick={() => setShowNotifications(false)} className="text-brand-500 hover:text-white text-xs">X</button>
          </div>
          {unreadCount === 0 ? (
            <p className="text-xs text-brand-500 font-medium text-center py-4">Yeni bildirim yok</p>
          ) : (
            <p className="text-xs text-brand-400 font-medium text-center py-4">{unreadCount} okunmamis bildirim</p>
          )}
          <button
            onClick={() => { onNavigate("notifications"); setShowNotifications(false); }}
            className="w-full py-2 rounded bg-brand-800 border border-brand-700 text-xs font-bold text-brand-200 uppercase tracking-widest hover:bg-brand-700 transition-colors mt-2"
          >
            Tumu
          </button>
        </div>
      )}
    </div>
  );
}
