import { useState } from "react";

interface FriendCardProps {
  friend: {
    id: string;
    friendshipId: string;
    username: string;
    avatarUrl?: string;
    status: string;
  };
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function FriendCard({ friend, onAccept, onReject, onRemove }: FriendCardProps) {
  const [hovered, setHovered] = useState(false);
  const initials = friend.username.slice(0, 2).toUpperCase();
  const isPending = friend.status === "PENDING";
  const isAccepted = friend.status === "ACCEPTED";

  const statusBadge: Record<string, { text: string; color: string }> = {
    PENDING: { text: "Beklemede", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    ACCEPTED: { text: "Arkadas", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    BLOCKED: { text: "Engelli", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  };

  const badge = statusBadge[friend.status] || {
    text: friend.status,
    color: "text-brand-400 bg-brand-800 border-brand-700",
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded bg-brand-900 border border-brand-800 hover:border-brand-700 transition-colors font-sans group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      {friend.avatarUrl ? (
        <img
          src={friend.avatarUrl}
          alt={friend.username}
          className="w-10 h-10 rounded object-cover border border-brand-800 flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-brand-200 flex items-center justify-center text-brand-950 font-black text-sm flex-shrink-0">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-brand-100 truncate">{friend.username}</p>
        <span
          className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${badge.color}`}
        >
          {badge.text}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isPending && onAccept && (
          <button
            onClick={() => onAccept(friend.friendshipId)}
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest bg-brand-200 text-brand-950 hover:bg-white transition-colors"
          >
            Kabul Et
          </button>
        )}
        {isPending && onReject && (
          <button
            onClick={() => onReject(friend.friendshipId)}
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-red-400 hover:border-red-900/50 transition-colors"
          >
            Reddet
          </button>
        )}
        {isAccepted && onRemove && hovered && (
          <button
            onClick={() => onRemove(friend.friendshipId)}
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest text-red-400 bg-brand-950 border border-red-900/50 hover:bg-red-900/30 transition-colors"
          >
            Kaldir
          </button>
        )}
      </div>
    </div>
  );
}
