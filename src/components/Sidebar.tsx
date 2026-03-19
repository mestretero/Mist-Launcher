import { useAuthStore } from "../stores/authStore";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const navItems = [
    { id: "store", label: "Mağaza", icon: "🏪" },
    { id: "library", label: "Kütüphane", icon: "📚" },
    { id: "settings", label: "Ayarlar", icon: "⚙️" },
  ];

  return (
    <div className="w-56 bg-gray-900 h-screen flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-indigo-400">Stealike</h1>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentPage === item.id
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {user && (
        <div className="p-3 border-t border-gray-800">
          <div className="text-sm text-gray-300 mb-1">{user.username}</div>
          <div className="text-xs text-gray-500 mb-2">{user.email}</div>
          <button
            onClick={logout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
