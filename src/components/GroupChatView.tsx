import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Group, GroupMessage } from "../lib/types";
import { api } from "../lib/api";
import { useGroupStore } from "../stores/groupStore";

interface Props {
  group: Group;
  messages: GroupMessage[];
  currentUserId: string;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
}

export function GroupChatView({ group, messages, currentUserId, onClose, onSend }: Props) {
  const { t } = useTranslation();
  const { loadGroups } = useGroupStore();
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState("");
  const [localGroup, setLocalGroup] = useState(group);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep localGroup in sync with store
  useEffect(() => { setLocalGroup(group); }, [group]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isCreator = localGroup.creatorId === currentUserId;

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await onSend(text);
  }

  async function handleKick(userId: string) {
    try {
      await api.groups.removeMember(localGroup.id, userId);
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleLeave() {
    const warn = isCreator ? t("chat.creatorLeaveWarning") : "";
    if (warn && !window.confirm(warn)) return;
    try {
      await api.groups.leave(localGroup.id);
      onClose();
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddMember() {
    if (!addingFriendId.trim()) return;
    try {
      await api.groups.addMember(localGroup.id, addingFriendId.trim());
      setAddingFriendId("");
      await loadGroups();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="w-[340px] h-full flex flex-col bg-[#0f1115] border border-[#2a2e38] border-r-0 rounded-tl-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1c23]/60 border-b border-[#2a2e38]">
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#2a2e38] text-[#67707b] hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-white block leading-tight truncate">{localGroup.name}</span>
          <span className="text-[10px] text-[#67707b]">{localGroup.members.length} {t("chat.members")}</span>
        </div>
        <button onClick={() => setShowMembers(!showMembers)}
          className={`p-1.5 rounded-lg transition-colors ${showMembers ? "bg-[#1a9fff]/20 text-[#1a9fff]" : "hover:bg-[#2a2e38] text-[#67707b] hover:text-white"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        </button>
      </div>

      {showMembers ? (
        /* ── Member Management View ── */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#67707b]/60 px-1 pb-1">{t("chat.members")}</p>
          {localGroup.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#20232c]/40">
              <div className="w-7 h-7 rounded-lg bg-[#20232c] flex items-center justify-center text-[10px] font-black text-[#c6d4df]">
                {m.user.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-[12px] text-[#c6d4df] truncate">{m.user.username}</span>
              {localGroup.creatorId === m.userId && (
                <span className="text-[9px] text-[#1a9fff]/60 px-1.5 py-0.5 bg-[#1a9fff]/10 rounded">{t("chat.creator")}</span>
              )}
              {isCreator && m.userId !== currentUserId && (
                <button onClick={() => handleKick(m.userId)}
                  className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 hover:bg-red-400/10 rounded transition-colors cursor-pointer">
                  {t("chat.removeMember")}
                </button>
              )}
            </div>
          ))}

          {isCreator && (
            <div className="pt-2 border-t border-[#2a2e38]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#67707b]/60 px-1 pb-2">{t("chat.addMember")}</p>
              <div className="flex gap-2">
                <input
                  value={addingFriendId}
                  onChange={(e) => setAddingFriendId(e.target.value)}
                  placeholder="User ID..."
                  className="flex-1 px-2 py-1.5 bg-[#1a1c23] border border-[#2a2e38] rounded-lg text-[12px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
                />
                <button onClick={handleAddMember} disabled={!addingFriendId.trim()}
                  className="px-2 py-1.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-lg text-[11px] disabled:opacity-30 transition-all cursor-pointer">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#2a2e38]">
            <button onClick={handleLeave}
              className="w-full py-2 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer">
              {t("chat.leaveGroup")}
            </button>
          </div>
        </div>
      ) : (
        /* ── Chat View ── */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full">
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
                className="px-3 py-2.5 bg-[#1a9fff] hover:bg-[#1a9fff]/80 text-white rounded-xl disabled:opacity-20 transition-all cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
