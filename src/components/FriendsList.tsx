import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friends: Friend[];
  activeFriendId?: string;
  onSelectFriend: (friend: Friend) => void;
  onNavigate: (page: string, slug?: string) => void;
  onCreateGroup: (friend: Friend) => void;
  onTogglePanel: () => void;
}

export function FriendsList({ friends, activeFriendId, onSelectFriend, onNavigate, onCreateGroup, onTogglePanel }: Props) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; friend: Friend } | null>(null);

  useEffect(() => {
    function close() { setContextMenu(null); }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const sorted = [...friends].sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <>
      <div className="overflow-y-auto" style={{ maxHeight: 404 }}>
        {onlineCount > 0 && (
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/60">{t("chat.online")} — {onlineCount}</span>
          </div>
        )}
        {sorted.filter((f) => f.online).map((f) => (
          <FriendRow key={f.id} friend={f} isActive={activeFriendId === f.id}
            onClick={() => onSelectFriend(f)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, friend: f }); }} />
        ))}
        {sorted.some((f) => !f.online) && (
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#67707b]/60">{t("chat.offline")}</span>
          </div>
        )}
        {sorted.filter((f) => !f.online).map((f) => (
          <FriendRow key={f.id} friend={f} isActive={activeFriendId === f.id}
            onClick={() => onSelectFriend(f)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, friend: f }); }} />
        ))}
        {friends.length === 0 && (
          <p className="text-[11px] text-[#67707b] text-center py-6">{t("chat.noFriends")}</p>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-[#1a1c23] border border-[#2a2e38] rounded-xl shadow-2xl shadow-black/50 py-1 min-w-[160px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y - 100 }}
        >
          <button
            onClick={() => { onNavigate("user-profile", contextMenu.friend.username); onTogglePanel(); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            {t("chat.viewProfile")}
          </button>
          <button
            onClick={() => { onSelectFriend(contextMenu.friend); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {t("chat.sendMessage")}
          </button>
          <div className="h-px bg-[#2a2e38] mx-2 my-1" />
          <button
            onClick={() => { onCreateGroup(contextMenu.friend); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] cursor-pointer transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {t("chat.createGroup")}
          </button>
        </div>
      )}
    </>
  );
}

// ── FriendRow (same as before, extracted) ──────────────

function FriendRow({ friend, isActive, onClick, onContextMenu }: {
  friend: Friend; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const initials = friend.username.slice(0, 2).toUpperCase();
  return (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-all ${isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"}`}>
      <div className="relative flex-shrink-0">
        {friend.avatarUrl ? (
          <img src={friend.avatarUrl.startsWith("http") ? friend.avatarUrl : `http://localhost:3001${friend.avatarUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${friend.online ? "bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] text-[#c6d4df]" : "bg-[#20232c] text-[#67707b]"}`}>{initials}</div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1a1c23] ${friend.online ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-[#3d4450]"}`} />
      </div>
      <span className={`text-[13px] font-medium truncate ${friend.online ? "text-[#c6d4df]" : "text-[#67707b]"}`}>{friend.username}</span>
    </button>
  );
}
