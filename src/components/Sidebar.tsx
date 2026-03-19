import { useAuthStore } from "../stores/authStore";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const StoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LibraryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const navItems: NavItem[] = [
    { id: "store", label: "Mağaza", icon: <StoreIcon /> },
    { id: "library", label: "Kütüphane", icon: <LibraryIcon /> },
    { id: "settings", label: "Ayarlar", icon: <SettingsIcon /> },
  ];

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div
      className="w-60 h-screen flex flex-col border-r border-white/5"
      style={{ background: "linear-gradient(180deg, #0d0d1a 0%, #0a0a14 100%)" }}
    >
      {/* Logo / Brand area */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-lg font-bold tracking-tight"
              style={{
                background: "linear-gradient(90deg, #818cf8, #6366f1)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Stealike
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 leading-none">
              BETA
            </span>
          </div>
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5">Oyun Platformu</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative ${
                isActive ? "text-white" : "text-gray-500 hover:text-gray-200"
              }`}
              style={
                isActive
                  ? { background: "linear-gradient(90deg, rgba(99,102,241,0.22) 0%, rgba(99,102,241,0.06) 100%)" }
                  : undefined
              }
            >
              {/* Active left indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: "linear-gradient(180deg, #818cf8, #6366f1)" }}
                />
              )}

              {/* Hover bg for inactive */}
              {!isActive && (
                <span className="absolute inset-0 rounded-lg bg-white/0 group-hover:bg-white/[0.04] transition-colors duration-150" />
              )}

              <span
                className={`flex-shrink-0 transition-colors duration-150 ${
                  isActive ? "text-indigo-400" : "text-gray-600 group-hover:text-gray-400"
                }`}
              >
                {item.icon}
              </span>
              <span className="font-medium flex-1 text-left">{item.label}</span>

              {item.badge != null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white leading-none">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="mx-3 border-t border-white/5" />

      {/* User section */}
      {user && (
        <div className="p-2 m-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center gap-2.5 px-1 pt-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white select-none"
              style={{ background: "linear-gradient(135deg, #6366f1, #4338ca)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">{user.username}</div>
              <div className="text-[10px] text-gray-600 truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          >
            <LogoutIcon />
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </div>
  );
}
