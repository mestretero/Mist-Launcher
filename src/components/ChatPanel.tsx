import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDmStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";

interface Props {
  onNavigate: (page: string, slug?: string) => void;
}

export function ChatPanel({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    friends, panelOpen, togglePanel,
    activeChatFriend, chatMessages,
    openChat, closeChat, sendMessage, unreadCount,
  } = useDmStore();

  const [chatInput, setChatInput] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; friend: any } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    function close() { setContextMenu(null); }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function handleSend() {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    await sendMessage(text);
  }

  function handleContextMenu(e: React.MouseEvent, friend: any) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, friend });
  }

  const sortedFriends = [...friends].sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="fixed bottom-0 right-0 z-50 flex items-end">
      {/* ─── Chat (left) ─── */}
      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: panelOpen && activeChatFriend ? 340 : 0,
          height: panelOpen ? 440 : 36,
          opacity: panelOpen && activeChatFriend ? 1 : 0,
        }}
      >
        <div className="w-[340px] h-full flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
            <button onClick={closeChat} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            {/* Clickable profile link */}
            <button
              onClick={() => { onNavigate("user-profile", activeChatFriend?.username); togglePanel(); }}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="relative">
                {activeChatFriend?.avatarUrl ? (
                  <img src={activeChatFriend.avatarUrl.startsWith("http") ? activeChatFriend.avatarUrl : `http://localhost:3001${activeChatFriend.avatarUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover ring-2 ring-[#2a2e38]" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[10px] font-black text-[#c6d4df] ring-2 ring-[#2a2e38]">
                    {activeChatFriend?.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {activeChatFriend?.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#1a1c23]" />}
              </div>
              <div className="text-left">
                <span className="text-[13px] font-bold text-white block leading-tight">{activeChatFriend?.username}</span>
                <span className={`text-[10px] leading-tight ${activeChatFriend?.online ? "text-emerald-400" : "text-[#67707b]"}`}>
                  {activeChatFriend?.online ? t("chat.online") : t("chat.offline")}
                </span>
              </div>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a2e38] mb-2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-[11px] text-[#67707b]">{t("chat.noMessages")}</p>
              </div>
            )}
            {chatMessages.map((msg) => {
              const isMine = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    {!isMine && (
                      <span className="text-[10px] font-semibold text-[#1a9fff]/60 mb-0.5 block px-1">
                        {msg.sender?.username}
                      </span>
                    )}
                    <div className={`px-3 py-2 text-[13px] leading-snug ${
                      isMine ? "bg-[#1a9fff] text-white rounded-2xl rounded-br-sm" : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-2xl rounded-bl-sm"
                    }`}>{msg.content}</div>
                    <span className="text-[8px] text-[#67707b]/40 mt-0.5 block px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#2a2e38]">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={t("chat.messagePlaceholder")}
                className="flex-1 px-3 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
                autoFocus
              />
              <button onClick={handleSend} disabled={!chatInput.trim()}
                className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Friends Panel (right) ─── */}
      <div
        className={`w-[280px] bg-[#1a1c23] border border-[#2a2e38] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          activeChatFriend && panelOpen ? "rounded-tr-2xl" : "rounded-t-2xl"
        }`}
        style={{ height: panelOpen ? 440 : 36 }}
      >
        {/* Header toggle */}
        <button onClick={togglePanel} className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#20232c] transition-colors" style={{ height: 36 }}>
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1a9fff]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[12px] font-bold text-[#c6d4df]">{t("chat.friendsAndChat")}</span>
            {onlineCount > 0 && <span className="text-[10px] text-emerald-400">({onlineCount})</span>}
            {unreadCount > 0 && <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-[#67707b] transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}>
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Friends list */}
        <div className="border-t border-[#2a2e38] overflow-y-auto flex-1" style={{ maxHeight: 404 }}>
          {onlineCount > 0 && (
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/60">{t("chat.online")} — {onlineCount}</span>
            </div>
          )}
          {sortedFriends.filter((f) => f.online).map((f) => (
            <FriendRow key={f.id} friend={f} isActive={activeChatFriend?.id === f.id}
              onClick={() => openChat(f)} onContextMenu={(e) => handleContextMenu(e, f)} />
          ))}
          {sortedFriends.some((f) => !f.online) && (
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#67707b]/60">{t("chat.offline")}</span>
            </div>
          )}
          {sortedFriends.filter((f) => !f.online).map((f) => (
            <FriendRow key={f.id} friend={f} isActive={activeChatFriend?.id === f.id}
              onClick={() => openChat(f)} onContextMenu={(e) => handleContextMenu(e, f)} />
          ))}
          {friends.length === 0 && (
            <p className="text-[11px] text-[#67707b] text-center py-10">{t("chat.noFriends")}</p>
          )}
        </div>
      </div>

      {/* ─── Context Menu ─── */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-[#1a1c23] border border-[#2a2e38] rounded-xl shadow-2xl shadow-black/50 py-1 min-w-[160px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y - 80 }}
        >
          <button
            onClick={() => { onNavigate("user-profile", contextMenu.friend.username); togglePanel(); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            {t("chat.viewProfile", "Profili Görüntüle")}
          </button>
          <button
            onClick={() => { openChat(contextMenu.friend); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#c6d4df] hover:bg-[#1a9fff]/10 hover:text-[#1a9fff] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {t("chat.sendMessage", "Mesaj Gönder")}
          </button>
        </div>
      )}
    </div>
  );
}

function FriendRow({ friend, isActive, onClick, onContextMenu }: {
  friend: any; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const initials = friend.username.slice(0, 2).toUpperCase();
  return (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all ${isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"}`}>
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
