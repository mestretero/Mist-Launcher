import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDmStore } from "../stores/dmStore";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { FriendsList } from "./FriendsList";
import { ChatView } from "./ChatView";
import { GroupList } from "./GroupList";
import { GroupChatView } from "./GroupChatView";
import { CreateGroupModal } from "./CreateGroupModal";

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
  const {
    groups, activeGroup, groupMessages, unreadGroups,
    loadGroups, openGroup, closeGroup, sendMessage: sendGroupMessage,
  } = useGroupStore();

  const [createGroupFor, setCreateGroupFor] = useState<any | null>(null);

  // Load groups when panel opens
  useEffect(() => {
    if (panelOpen) loadGroups();
  }, [panelOpen]);

  const hasActiveChat = panelOpen && (activeChatFriend || activeGroup);
  const totalUnread = unreadCount + unreadGroups.size;

  const chatContent = activeChatFriend ? (
    <ChatView
      friend={activeChatFriend}
      messages={chatMessages}
      currentUserId={user?.id || ""}
      onClose={closeChat}
      onSend={sendMessage}
      onNavigate={onNavigate}
      onTogglePanel={togglePanel}
    />
  ) : activeGroup ? (
    <GroupChatView
      group={activeGroup}
      messages={groupMessages}
      currentUserId={user?.id || ""}
      onClose={closeGroup}
      onSend={sendGroupMessage}
    />
  ) : null;

  return (
    <>
      <div className="fixed bottom-0 right-0 z-50 flex items-end" onContextMenu={(e) => e.preventDefault()}>
        {/* ─── Chat (left) ─── */}
        <div
          className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: hasActiveChat ? 340 : 0,
            height: panelOpen ? 440 : 36,
            opacity: hasActiveChat ? 1 : 0,
          }}
        >
          {chatContent}
        </div>

        {/* ─── Friends + Groups Panel (right) ─── */}
        <div
          className={`w-[280px] bg-[#1a1c23] border border-[#2a2e38] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasActiveChat ? "rounded-tr-2xl" : "rounded-t-2xl"
          }`}
          style={{ height: panelOpen ? 440 : 36 }}
        >
          {/* Header toggle */}
          <button onClick={togglePanel} className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#20232c] cursor-pointer transition-colors" style={{ height: 36 }}>
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1a9fff]">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[12px] font-bold text-[#c6d4df]">{t("chat.friendsAndChat")}</span>
              {friends.filter((f) => f.online).length > 0 && (
                <span className="text-[10px] text-emerald-400">({friends.filter((f) => f.online).length})</span>
              )}
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{totalUnread}</span>
              )}
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-[#67707b] transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Scrollable content */}
          <div className="border-t border-[#2a2e38] overflow-y-auto" style={{ maxHeight: 404 }}>
            {/* Friends section */}
            <FriendsList
              friends={friends}
              activeFriendId={activeChatFriend?.id}
              onSelectFriend={(f) => { closeGroup(); openChat(f); }}
              onNavigate={onNavigate}
              onCreateGroup={(f) => setCreateGroupFor(f)}
              onTogglePanel={togglePanel}
            />

            {/* Groups section */}
            <div className="px-3 pt-3 pb-1 border-t border-[#2a2e38]/50">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#7c3aed]/60">{t("chat.groups")}</span>
            </div>
            <GroupList
              groups={groups}
              activeGroupId={activeGroup?.id}
              unreadGroups={unreadGroups}
              onSelectGroup={(g) => { closeChat(); openGroup(g); }}
            />
          </div>
        </div>
      </div>

      {/* ─── Create Group Modal ─── */}
      {createGroupFor && (
        <CreateGroupModal
          friends={friends}
          preselectedFriend={createGroupFor}
          onClose={() => setCreateGroupFor(null)}
        />
      )}
    </>
  );
}
