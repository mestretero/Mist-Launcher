import { useState } from "react";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md";
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z"
      />
    </svg>
  );
}

export function StarRating({ rating, onRate, size = "md" }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const isInteractive = !!onRate;

  const sizeClasses = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(displayRating);
          return (
            <button
              key={star}
              type="button"
              disabled={!isInteractive}
              onClick={() => onRate?.(star)}
              onMouseEnter={() => isInteractive && setHoverRating(star)}
              onMouseLeave={() => isInteractive && setHoverRating(0)}
              className={`${isInteractive ? "cursor-pointer" : "cursor-default"} ${
                filled ? "text-yellow-400" : "text-brand-700"
              } ${isInteractive && !filled ? "hover:text-yellow-300" : ""} transition-colors disabled:opacity-100`}
            >
              <StarIcon filled={filled} className={sizeClasses} />
            </button>
          );
        })}
      </div>
      {!isInteractive && rating > 0 && (
        <span className={`font-bold text-brand-300 ml-1 ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
