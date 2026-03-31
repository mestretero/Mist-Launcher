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

  function handleSend() {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
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
      {/* ═══ Toggle Button — fixed bottom-right ═══ */}
      <button
        onClick={togglePanel}
        className="fixed bottom-0 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-[#1a1c23] border border-[#2a2e38] border-b-0 rounded-t-lg text-sm font-semibold text-[#c6d4df] hover:bg-[#20232c] transition-all shadow-lg shadow-black/20"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1a9fff]">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {t("chat.friendsAndChat")}
        {onlineCount > 0 && (
          <span className="text-[10px] text-emerald-400 font-bold">({onlineCount})</span>
        )}
        {unreadCount > 0 && (
          <span className="bg-[#1a9fff] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* ═══ Panel — slides up from bottom-right ═══ */}
      <div
        className={`fixed right-6 z-50 flex transition-all duration-300 ease-out origin-bottom-right ${
          panelOpen
            ? "bottom-0 opacity-100 scale-100"
            : "bottom-0 opacity-0 scale-95 pointer-events-none translate-y-full"
        }`}
        style={{ height: 480 }}
      >
        {/* Chat area — slides out to the LEFT */}
        {activeChatFriend && (
          <div className="w-[360px] flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-xl overflow-hidden animate-in slide-in-from-right">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2e38] bg-[#1a1c23]/80">
              <button onClick={closeChat} className="p-1 rounded hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="relative flex-shrink-0">
                {activeChatFriend.avatarUrl ? (
                  <img src={activeChatFriend.avatarUrl.startsWith("http") ? activeChatFriend.avatarUrl : `http://localhost:3001${activeChatFriend.avatarUrl}`} alt="" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[8px] font-black text-[#c6d4df]">
                    {activeChatFriend.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-[#c6d4df]">{activeChatFriend.username}</span>
              {activeChatFriend.online && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {chatMessages.length === 0 && (
                <p className="text-[11px] text-[#2a2e38] text-center py-12">{t("chat.noMessages")}</p>
              )}
              {chatMessages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%]">
                      <div className={`inline-block px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed ${
                        isMine ? "bg-[#1a9fff] text-white rounded-br-sm" : "bg-[#1a1c23] text-[#c6d4df] border border-[#2a2e38] rounded-bl-sm"
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
            <div className="p-2 border-t border-[#2a2e38]">
              <div className="flex gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat.messagePlaceholder")}
                  className="flex-1 px-3 py-2 bg-[#1a1c23] border border-[#2a2e38] rounded-lg text-sm text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
                  autoFocus
                />
                <button onClick={handleSend} disabled={!chatInput.trim()}
                  className="px-2.5 py-2 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-lg disabled:opacity-20 transition-all">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Friends list — always on the right */}
        <div className="w-[280px] flex flex-col bg-[#1a1c23] border border-[#2a2e38] rounded-t-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2e38] bg-[#1a1c23]">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-[#67707b]">
                {t("chat.friends")}
              </h3>
              {onlineCount > 0 && (
                <span className="text-[10px] text-emerald-400 font-semibold">{onlineCount}</span>
              )}
            </div>
            <button onClick={togglePanel} className="p-1 rounded hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Friends */}
          <div className="flex-1 overflow-y-auto">
            {sortedFriends.length === 0 && (
              <p className="text-[11px] text-[#67707b] text-center py-10">{t("chat.noFriends")}</p>
            )}
            {sortedFriends.map((friend) => {
              const initials = friend.username.slice(0, 2).toUpperCase();
              const isActive = activeChatFriend?.id === friend.id;
              return (
                <button
                  key={friend.id}
                  onClick={() => openChat(friend)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-[#1a9fff]/10" : "hover:bg-[#20232c]"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl.startsWith("http") ? friend.avatarUrl : `http://localhost:3001${friend.avatarUrl}`} alt="" className="w-7 h-7 rounded-md object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#1a9fff]/20 to-[#1a1c23] flex items-center justify-center text-[9px] font-black text-[#c6d4df]">
                        {initials}
                      </div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#1a1c23] ${
                      friend.online ? "bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]" : "bg-[#67707b]"
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-[#c6d4df] truncate block">{friend.username}</span>
                    <span className={`text-[9px] ${friend.online ? "text-emerald-400" : "text-[#67707b]"}`}>
                      {friend.online ? t("chat.online") : t("chat.offline")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
