import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { WishlistItem } from "../lib/types";

interface WishlistPageProps {
  onGameClick: (slug: string) => void;
}

export function WishlistPage({ onGameClick }: WishlistPageProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    api.wishlist
      .list()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (gameId: string) => {
    setRemovingId(gameId);
    try {
      await api.wishlist.remove(gameId);
      setItems((prev) => prev.filter((item) => item.gameId !== gameId));
    } catch {
      // silently fail
    } finally {
      setRemovingId(null);
    }
  };

  const containerClass = "max-w-[1400px] mx-auto px-10";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-brand-950 font-sans">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin text-brand-400"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm font-bold text-brand-500 uppercase tracking-widest">
            {t("common.loading")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-950 font-sans pb-20 mt-4 min-h-[calc(100vh-48px)]">
      <div className={containerClass}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 border-b border-brand-800 pb-2">
          <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">
            {t("wishlist.title")}
          </h2>
          <span className="text-sm font-bold bg-brand-800 px-3 py-1 rounded text-brand-300">
            {items.length} {t("wishlist.gameCount")}
          </span>
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <svg
              className="mb-6 text-brand-800"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <h3 className="text-lg font-black text-brand-400 uppercase tracking-widest mb-2">
              {t("wishlist.emptyTitle")}
            </h3>
            <p className="text-sm text-brand-500 font-medium max-w-sm">
              {t("wishlist.emptyHint")}
            </p>
          </div>
        ) : (
          /* Grid */
          <div className="grid grid-cols-4 gap-6">
            {items.map((item) => {
              const price = parseFloat(item.game.price);
              const discountedPrice =
                item.game.discountPercent > 0
                  ? price * (1 - item.game.discountPercent / 100)
                  : price;

              return (
                <div
                  key={item.id}
                  className="rounded overflow-hidden bg-brand-900 border border-brand-800 transition-all hover:-translate-y-1 hover:border-brand-600 hover:shadow-lg hover:shadow-black/20 group relative"
                >
                  {/* Cover Image */}
                  <div
                    className="relative overflow-hidden bg-brand-950 cursor-pointer"
                    onClick={() => onGameClick(item.game.slug)}
                  >
                    <img
                      src={item.game.coverImageUrl}
                      alt={item.game.title}
                      className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105"
                      style={{ filter: "brightness(0.85)" }}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-transparent to-transparent opacity-80" />

                    {item.game.discountPercent > 0 && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-brand-200 text-brand-950 shadow-sm">
                          -{item.game.discountPercent}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4">
                    <h3
                      className="font-bold text-base text-brand-100 truncate mb-1 cursor-pointer hover:text-brand-200 transition-colors"
                      onClick={() => onGameClick(item.game.slug)}
                    >
                      {item.game.title}
                    </h3>
                    <p className="text-xs font-medium text-brand-500 uppercase tracking-widest truncate">
                      {item.game.publisher.name}
                    </p>

                    {/* Price + Remove */}
                    <div className="mt-4 flex items-center justify-between border-t border-brand-800 pt-3">
                      <button
                        onClick={() => handleRemove(item.gameId)}
                        disabled={removingId === item.gameId}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-500 hover:text-red-400 transition-colors disabled:opacity-50 uppercase tracking-widest"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="0"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        {t("wishlist.remove")}
                      </button>

                      <div className="flex items-center gap-2">
                        {item.game.discountPercent > 0 && (
                          <span className="text-xs font-medium text-brand-600 line-through">
                            {price.toFixed(0)} TL
                          </span>
                        )}
                        <span className="text-base font-bold text-brand-100">
                          {discountedPrice.toFixed(0)} TL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
