import { useTranslation } from "react-i18next";
import type { Group } from "../lib/types";

interface Props {
  groups: Group[];
  activeGroupId?: string;
  unreadGroups: Set<string>;
  onSelectGroup: (group: Group) => void;
}

export function GroupList({ groups, activeGroupId, unreadGroups, onSelectGroup }: Props) {
  const { t } = useTranslation();

  if (groups.length === 0) return (
    <p className="text-[11px] text-[#67707b] text-center py-4">{t("chat.noGroups")}</p>
  );

  return (
    <div>
      {groups.map((group) => {
        const isUnread = unreadGroups.has(group.id);
        const isActive = activeGroupId === group.id;
        const initials = group.name.slice(0, 2).toUpperCase();
        return (
          <button key={group.id} onClick={() => onSelectGroup(group)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-all ${isActive ? "bg-[#1a9fff]/10 border-l-2 border-[#1a9fff]" : "hover:bg-[#20232c]/60 border-l-2 border-transparent"}`}>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed]/30 to-[#1a1c23] flex items-center justify-center text-[10px] font-black text-[#c6d4df]">
                {initials}
              </div>
              {isUnread && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium truncate text-[#c6d4df] block">{group.name}</span>
              {group.lastMessage && (
                <span className="text-[10px] text-[#67707b] truncate block">
                  {group.lastMessage.sender?.username ?? "?"}: {group.lastMessage.content}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#67707b]/60 ml-1">{group.members.length}</span>
          </button>
        );
      })}
    </div>
  );
}
