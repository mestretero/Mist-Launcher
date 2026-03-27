import type { Review } from "../lib/types";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  review: Review;
  isOwn?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReviewCard({ review, isOwn, onEdit, onDelete }: ReviewCardProps) {
  const initials = review.user.username.slice(0, 2).toUpperCase();

  return (
    <div className="rounded bg-brand-900 border border-brand-800 p-5 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {review.user.avatarUrl ? (
            <img
              src={review.user.avatarUrl}
              alt={review.user.username}
              className="w-10 h-10 rounded object-cover border border-brand-800"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-brand-200 flex items-center justify-center text-brand-950 font-black text-sm">
              {initials}
            </div>
          )}

          <div>
            <span className="text-sm font-bold text-brand-100">{review.user.username}</span>
            <div className="flex items-center gap-3 mt-0.5">
              <StarRating rating={review.rating} size="sm" />
              <span className="text-xs text-brand-500 font-medium">
                {formatDate(review.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Own review actions */}
        {isOwn && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest text-brand-400 bg-brand-950 border border-brand-800 hover:text-brand-200 hover:border-brand-600 transition-colors"
              >
                Duzenle
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest text-red-400 bg-brand-950 border border-red-900/50 hover:bg-red-900/30 transition-colors"
              >
                Sil
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-brand-300 leading-relaxed">{review.content}</p>
    </div>
  );
}
