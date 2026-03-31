import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDmStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";

export function ChatPanel() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    friends,
    panelOpen,
    togglePanel,
    activeChatFriend,
    chatMessages,
    openChat,
    closeChat,
    sendMessage,
    unreadCount,
  } = useDmStore();

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleSend() {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const sortedFriends = [...friends].sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });

  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <>
      {/* ═══ Toggle Button ═══ */}
      <button
        onClick={togglePanel}
        className={`fixed bottom-0 right-6 z-50 flex items-center gap-2.5 px-5 py-2 rounded-t-lg text-[13px] font-semibold transition-all shadow-xl shadow-black/30 ${
          panelOpen
            ? "bg-[#1a9fff] text-white"
            : "bg-[#1a1c23] border border-b-0 border-[#2a2e38] text-[#c6d4df] hover:bg-[#20232c]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {t("chat.friendsAndChat")}
        {!panelOpen && onlineCount > 0 && (
          <span className="text-emerald-400 text-[11px]">({onlineCount})</span>
        )}
        {!panelOpen && unreadCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${panelOpen ? "rotate-180" : ""}`}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* ═══ Panel ═══ */}
      <div
        className={`fixed right-6 z-40 flex transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelOpen ? "bottom-9 opacity-100" : "-bottom-[500px] opacity-0 pointer-events-none"
        }`}
      >
        {/* ─── Chat (left side, conditional) ─── */}
        {activeChatFriend && (
          <div className="w-[340px] flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
              <button onClick={closeChat} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="relative">
                {activeChatFriend.avatarUrl ? (
                  <img src={activeChatFriend.avatarUrl.startsWith("http") ? activeChatFriend.avatarUrl : `http://localhost:3001${activeChatFriend.avatarUrl}`} alt="" className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[9px] font-black text-[#c6d4df]">
                    {activeChatFriend.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {activeChatFriend.online && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#1a1c23]" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-white block">{activeChatFriend.username}</span>
                <span className={`text-[10px] ${activeChatFriend.online ? "text-emerald-400" : "text-[#67707b]"}`}>
                  {activeChatFriend.online ? t("chat.online") : t("chat.offline")}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ height: 340 }}>
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a2e38] mb-2">
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
                      <div className={`px-3 py-2 text-[13px] leading-snug ${
                        isMine
                          ? "bg-[#1a9fff] text-white rounded-2xl rounded-br-sm"
                          : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-2xl rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>
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
            <div className="p-3 border-t border-[#2a2e38] bg-[#0f1115]">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat.messagePlaceholder")}
                  className="flex-1 px-3 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none transition-colors"
                  autoFocus
                />
                <button onClick={handleSend} disabled={!chatInput.trim()}
                  className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Friends List (right side, always visible) ─── */}
        <div className={`w-[280px] flex flex-col bg-[#1a1c23] border border-[#2a2e38] overflow-hidden ${activeChatFriend ? "rounded-tr-2xl" : "rounded-t-2xl"}`} style={{ height: 440 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1c23] border-b border-[#2a2e38]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#67707b]">{t("chat.friends")}</span>
              <span className="text-[10px] font-bold text-[#8f98a0] bg-[#20232c] px-1.5 py-0.5 rounded">{friends.length}</span>
            </div>
          </div>

          {/* Online section */}
          <div className="flex-1 overflow-y-auto">
            {onlineCount > 0 && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/60">{t("chat.online")} — {onlineCount}</span>
              </div>
            )}
            {sortedFriends.filter((f) => f.online).map((friend) => (
              <FriendRow key={friend.id} friend={friend} isActive={activeChatFriend?.id === friend.id} onClick={() => openChat(friend)} />
            ))}

            {/* Offline section */}
            {sortedFriends.some((f) => !f.online) && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#67707b]/60">{t("chat.offline")}</span>
              </div>
            )}
            {sortedFriends.filter((f) => !f.online).map((friend) => (
              <FriendRow key={friend.id} friend={friend} isActive={activeChatFriend?.id === friend.id} onClick={() => openChat(friend)} />
            ))}

            {sortedFriends.length === 0 && (
              <p className="text-[11px] text-[#67707b] text-center py-12">{t("chat.noFriends")}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FriendRow({ friend, isActive, onClick }: { friend: any; isActive: boolean; onClick: () => void }) {
  const initials = friend.username.slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all ${
        isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"
      }`}
    >
      <div className="relative flex-shrink-0">
        {friend.avatarUrl ? (
          <img src={friend.avatarUrl.startsWith("http") ? friend.avatarUrl : `http://localhost:3001${friend.avatarUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${friend.online ? "bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] text-[#c6d4df]" : "bg-[#20232c] text-[#67707b]"}`}>
            {initials}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1a1c23] ${
          friend.online ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-[#3d4450]"
        }`} />
      </div>
      <span className={`text-[13px] font-medium truncate ${friend.online ? "text-[#c6d4df]" : "text-[#67707b]"}`}>
        {friend.username}
      </span>
    </button>
  );
}
