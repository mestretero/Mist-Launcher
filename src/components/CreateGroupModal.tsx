import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useGroupStore } from "../stores/groupStore";

interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
}

interface Props {
  friends: Friend[];
  preselectedFriend?: Friend;
  onClose: () => void;
}

export function CreateGroupModal({ friends, preselectedFriend, onClose }: Props) {
  const { t } = useTranslation();
  const { loadGroups } = useGroupStore();
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    preselectedFriend ? new Set([preselectedFriend.id]) : new Set()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  function toggleFriend(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function handleCreate() {
    if (!groupName.trim()) { setError(t("chat.groupName") + " required"); return; }
    if (selectedIds.size === 0) { setError(t("chat.atLeastOneMember")); return; }
    setLoading(true);
    setError("");
    try {
      await api.groups.create(groupName.trim(), Array.from(selectedIds));
      await loadGroups();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1c23] border border-[#2a2e38] rounded-2xl w-[340px] max-h-[500px] flex flex-col shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2e38]">
          <span className="text-[15px] font-bold text-white">{t("chat.createGroup")}</span>
          <button onClick={onClose} className="text-[#67707b] hover:text-white transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Group name */}
        <div className="px-5 pt-4 pb-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#67707b]/60 block mb-1.5">{t("chat.groupName")}</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("chat.groupNamePlaceholder")}
            className="w-full px-3 py-2.5 bg-[#0f1115] border border-[#2a2e38] rounded-xl text-[13px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
            autoFocus
          />
        </div>

        {/* Friend search + selection */}
        <div className="px-5 pb-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#67707b]/60 block mb-1.5">{t("chat.selectFriends")}</label>
          <div className="relative">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#67707b]/40">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("chat.searchFriends")}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0f1115] border border-[#2a2e38] rounded-lg text-[12px] text-[#c6d4df] placeholder:text-[#67707b]/40 focus:border-[#1a9fff]/50 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {friends.filter((f) => f.username.toLowerCase().includes(search.toLowerCase())).map((f) => {
            const checked = selectedIds.has(f.id);
            return (
              <button key={f.id} onClick={() => toggleFriend(f.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-all ${checked ? "bg-[#1a9fff]/10" : "hover:bg-[#20232c]/60"}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-[#1a9fff] border-[#1a9fff]" : "border-[#2a2e38]"}`}>
                  {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${f.online ? "bg-gradient-to-br from-[#1a9fff]/30 to-[#1a1c23] text-[#c6d4df]" : "bg-[#20232c] text-[#67707b]"}`}>
                  {f.username.slice(0, 2).toUpperCase()}
                </div>
                <span className={`text-[12px] font-medium ${f.online ? "text-[#c6d4df]" : "text-[#67707b]"}`}>{f.username}</span>
                {f.online && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto" />}
              </button>
            );
          })}
          {friends.length === 0 && <p className="text-[11px] text-[#67707b] text-center py-4">{t("chat.noFriends")}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 border-t border-[#2a2e38]">
          {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 text-[12px] text-[#67707b] hover:text-white border border-[#2a2e38] hover:border-[#3d4450] rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={loading || !groupName.trim() || selectedIds.size === 0}
              className="flex-1 py-2 text-[12px] text-white bg-[#1a9fff] hover:bg-[#1a9fff]/80 rounded-xl disabled:opacity-30 transition-all cursor-pointer">
              {loading ? "..." : t("chat.createGroup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
