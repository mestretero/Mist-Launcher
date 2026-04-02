import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCartStore } from "../stores/cartStore";
import { useToastStore } from "../stores/toastStore";

interface CartPageProps {
  onGameClick: (slug: string) => void;
  onNavigate: (page: string) => void;
}

export function CartPage({ onGameClick, onNavigate }: CartPageProps) {
  const { t } = useTranslation();
  const { items, loading, fetch, removeItem, clear } = useCartStore();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    fetch();
  }, []);

  const handleRemove = async (gameId: string) => {
    try {
      await removeItem(gameId);
    } catch {
      addToast(t("cart.removeError"), "error");
    }
  };

  const handleClear = async () => {
    try {
      await clear();
      addToast(t("cart.cleared"), "success");
    } catch {
      addToast(t("cart.clearError"), "error");
    }
  };

  const handleCheckout = () => {
    addToast(t("cart.checkoutSoon"), "info");
  };

  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.game.price);
    const discounted =
      item.game.discountPercent > 0
        ? price * (1 - item.game.discountPercent / 100)
        : price;
    return sum + discounted;
  }, 0);

  const containerClass = "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10";

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
            {t("cart.title")}
          </h2>
          <span className="text-sm font-bold bg-brand-800 px-3 py-1 rounded text-brand-300">
            {items.length} {t("cart.gameCount")}
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
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <h3 className="text-lg font-black text-brand-400 uppercase tracking-widest mb-2">
              {t("cart.emptyTitle")}
            </h3>
            <p className="text-sm text-brand-500 font-medium max-w-sm mb-6">
              {t("cart.emptyHint")}
            </p>
            <button
              onClick={() => onNavigate("store")}
              className="px-8 py-3 rounded text-sm font-black bg-brand-200 text-brand-950 hover:bg-white transition-colors uppercase tracking-widest"
            >
              {t("cart.goToStore")}
            </button>
          </div>
        ) : (
          /* Cart Content */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* Left: Item list */}
            <div className="space-y-4">
              {items.map((item) => {
                const price = parseFloat(item.game.price);
                const discountedPrice =
                  item.game.discountPercent > 0
                    ? price * (1 - item.game.discountPercent / 100)
                    : price;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-5 bg-brand-900 border border-brand-800 rounded p-4 hover:border-brand-600 transition-colors"
                  >
                    {/* Cover */}
                    <div
                      className="w-[180px] flex-shrink-0 rounded overflow-hidden cursor-pointer bg-brand-950"
                      onClick={() => onGameClick(item.game.slug)}
                    >
                      <img
                        src={item.game.coverImageUrl}
                        alt={item.game.title}
                        className="w-full aspect-[16/9] object-cover hover:brightness-110 transition-all"
                        style={{ filter: "brightness(0.85)" }}
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-base text-brand-100 truncate mb-1 cursor-pointer hover:text-brand-200 transition-colors"
                        onClick={() => onGameClick(item.game.slug)}
                      >
                        {item.game.title}
                      </h3>
                      <p className="text-xs font-medium text-brand-500 uppercase tracking-widest truncate">
                        {item.game.publisher.name}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col items-end flex-shrink-0 gap-1">
                      {item.game.discountPercent > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-200 text-brand-950">
                            -{item.game.discountPercent}%
                          </span>
                          <span className="text-xs font-medium text-brand-600 line-through">
                            {price.toFixed(0)} TL
                          </span>
                        </div>
                      )}
                      <span className="text-lg font-bold text-brand-100">
                        {discountedPrice.toFixed(0)} TL
                      </span>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(item.gameId)}
                      className="p-2 text-brand-500 hover:text-red-400 transition-colors flex-shrink-0"
                      title={t("cart.remove")}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Clear cart link */}
              <div className="pt-2">
                <button
                  onClick={handleClear}
                  className="text-xs font-bold text-brand-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                >
                  {t("cart.clearCart")}
                </button>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="h-fit sticky top-4">
              <div className="bg-brand-900 border border-brand-800 rounded p-6">
                <h3 className="text-sm font-bold text-brand-100 uppercase tracking-widest mb-6 border-b border-brand-800 pb-3">
                  {t("cart.orderSummary")}
                </h3>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-400 font-medium">
                      {t("cart.subtotal", { count: items.length })}
                    </span>
                    <span className="text-brand-200 font-bold">
                      {subtotal.toFixed(0)} TL
                    </span>
                  </div>
                </div>

                <div className="border-t border-brand-800 pt-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-brand-100 uppercase tracking-widest">
                      {t("cart.total")}
                    </span>
                    <span className="text-xl font-black text-brand-100">
                      {subtotal.toFixed(0)} TL
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-3 rounded text-sm font-black bg-brand-200 text-brand-950 hover:bg-white transition-colors uppercase tracking-widest"
                >
                  {t("cart.checkout")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
