import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getAvatarUrl } from "../lib/avatar";

interface DmMessage {
  id: string;
  senderId: string;
  content: string;
  sender?: { username: string };
  createdAt: string;
}

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friend: Friend;
  messages: DmMessage[];
  currentUserId: string;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
  onNavigate: (page: string, slug?: string) => void;
  onTogglePanel: () => void;
}

export function ChatView({ friend, messages, currentUserId, onClose, onSend, onNavigate, onTogglePanel }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await onSend(text);
  }

  return (
    <div className="w-[340px] h-full flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button
          onClick={() => { onNavigate("user-profile", friend.username); onTogglePanel(); }}
          className="flex items-center gap-2.5 cursor-pointer hover:bg-[#20232c] rounded-lg px-1.5 py-1 -mx-1.5 -my-1 transition-colors"
        >
          <div className="relative">
            {friend.avatarUrl ? (
              <img src={getAvatarUrl(friend.avatarUrl) || ""} alt="" className="w-8 h-8 rounded-lg object-cover ring-2 ring-[#2a2e38]" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] flex items-center justify-center text-[10px] font-black text-[#c6d4df] ring-2 ring-[#2a2e38]">
                {friend.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            {friend.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#1a1c23]" />}
          </div>
          <div className="text-left">
            <span className="text-[13px] font-bold text-white block leading-tight truncate max-w-[200px]">{friend.username}</span>
            <span className={`text-[10px] leading-tight ${friend.online ? "text-emerald-400" : "text-[#67707b]"}`}>
              {friend.online ? t("chat.online") : t("chat.offline")}
            </span>
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a2e38] mb-2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-[11px] text-[#67707b]">{t("chat.noMessages")}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
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
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2a2e38]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t("chat.messagePlaceholder")}
            className="flex-1 px-3 py-2.5 bg-[#1a1c23] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
            autoFocus
          />
          <button onClick={handleSend} disabled={!input.trim()}
            className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
