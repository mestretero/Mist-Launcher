import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { useCartStore } from "../stores/cartStore";
import { InstallmentSelector } from "../components/InstallmentSelector";
import { ScreenshotLightbox } from "../components/ScreenshotLightbox";
import { AddToCollectionDropdown } from "../components/AddToCollectionDropdown";
import type { Game, LibraryItem } from "../lib/types";

interface Props {
  slug: string;
  onBack: () => void;
  onNavigate: (page: string, slug?: string) => void;
}

export function GameDetailPage({ slug, onBack, onNavigate }: Props) {
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { addItem: addToCart } = useCartStore();
  const [game, setGame] = useState<Game | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [error, setError] = useState("");
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [reviews, setReviews] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");

  useEffect(() => {
    api.games.getBySlug(slug).then(setGame);
    // Check if user already owns this game
    api.library.list().then((items: LibraryItem[]) => {
      if (Array.isArray(items)) {
        const owned = items.some((item) => item.game.slug === slug);
        setAlreadyOwned(owned);
      }
    }).catch(() => {});
  }, [slug]);

  // Check wishlist status when game loads
  useEffect(() => {
    if (!game) return;
    api.wishlist.check(game.id).then((res) => {
      setInWishlist(res.wishlisted);
    }).catch(() => {});
  }, [game]);

  // Fetch reviews
  useEffect(() => {
    api.reviews.list(slug).then(setReviews).catch(() => {});
  }, [slug]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64 bg-brand-950 font-sans">
        <div className="text-brand-500 text-sm font-medium tracking-widest uppercase">Yükleniyor...</div>
      </div>
    );
  }

  // Price calculation matching backend: game discount first (uncapped), then student+referral capped at 15%
  const basePrice = parseFloat(game.price);
  const gameDiscount = game.discountPercent;
  const priceAfterGameDiscount = basePrice * (1 - gameDiscount / 100);
  const studentDiscount = user?.isStudent ? 10 : 0;
  const referralDiscount = referralCode ? 5 : 0;
  const extraDiscount = Math.min(studentDiscount + referralDiscount, 15);
  const finalPrice = priceAfterGameDiscount * (1 - extraDiscount / 100);
  const totalSaved = basePrice - finalPrice;

  const handleBuy = async (installmentCount: number, cardData?: any) => {
    setError("");
    try {
      const result = await api.payments.init({
        gameId: game.id,
        referralCode: referralCode || undefined,
        paymentMethod: "CREDIT_CARD",
        installmentCount,
        ...cardData,
      });

      if (result.three_d_html) {
        setPaymentPending(true);
        const win = window.open("", "_blank", "width=500,height=600");
        if (win) {
          win.document.write(atob(result.three_d_html));
          const checkClosed = setInterval(() => {
            if (win.closed) {
              clearInterval(checkClosed);
              setPaymentPending(false);
              setPaymentSuccess(true);
              addToast(`${game.title} kütüphaneye eklendi!`, "success");
            }
          }, 500);
        } else {
          setError("Popup engellenmiş olabilir. Lütfen tarayıcı ayarlarınızı kontrol edin.");
          setPaymentPending(false);
        }
      } else {
        setPaymentSuccess(true);
        addToast(`${game.title} kütüphaneye eklendi!`, "success");
      }
    } catch (err: any) {
      setError(err.message || "Ödeme başarısız");
      addToast(err.message || "Ödeme başarısız", "error");
      setPaymentPending(false);
    }
  };

  const screenshots = typeof game.screenshots === "string"
    ? JSON.parse(game.screenshots) : game.screenshots;
  const requirements = typeof game.minRequirements === "string"
    ? JSON.parse(game.minRequirements) : game.minRequirements;

  return (
    <div className="min-h-screen bg-brand-950 font-sans">
      {/* Hero image */}
      <div className="relative w-full border-b border-brand-800" style={{ height: "360px" }}>
        <img
          src={screenshots?.[activeScreenshot] || game.coverImageUrl}
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.5) contrast(1.1)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/40 to-transparent" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded bg-brand-900 border border-brand-800 text-sm font-bold text-brand-300 hover:text-brand-100 transition-colors hover:bg-brand-800 uppercase tracking-widest"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Geri
        </button>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-10 pb-8 container mx-auto">
          <h1 className="text-5xl font-black text-brand-100 mb-2 tracking-tight">{game.title}</h1>
          <p className="text-sm font-bold text-brand-400 uppercase tracking-widest">{game.publisher.name}</p>
        </div>
      </div>

      <div className="px-10 py-8 container mx-auto">
        <div className="flex gap-10">
          {/* Left: content */}
          <div className="flex-1 min-w-0">
            {/* Screenshots */}
            {screenshots?.length > 0 && (
              <div className="mb-10">
                <div
                  className="rounded overflow-hidden mb-4 border border-brand-800 bg-brand-950 cursor-pointer group"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={screenshots[activeScreenshot]}
                    alt={`Screenshot ${activeScreenshot + 1}`}
                    className="w-full aspect-video object-cover group-hover:brightness-110 transition-all"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/60 rounded-full p-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {screenshots.map((url: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveScreenshot(i)}
                      className={`rounded overflow-hidden flex-shrink-0 transition-all duration-200 border-2 ${
                        activeScreenshot === i
                          ? "border-brand-300"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      style={{ width: "140px" }}
                    >
                      <img src={url} className="w-full h-[80px] object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-10 bg-brand-900 border border-brand-800 rounded p-6">
              <h2 className="text-base font-bold text-brand-100 mb-4 uppercase tracking-widest border-b border-brand-800 pb-2">Hakkında</h2>
              <p className="text-sm text-brand-300 leading-relaxed font-medium">{game.description}</p>
            </div>

            {/* System requirements */}
            {requirements && Object.keys(requirements).length > 0 && (
              <div className="bg-brand-900 border border-brand-800 rounded p-6">
                <h2 className="text-base font-bold text-brand-100 mb-4 uppercase tracking-widest border-b border-brand-800 pb-2">Minimum Sistem Gereksinimleri</h2>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(requirements).map(([key, val]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500">{key}</span>
                      <span className="text-sm font-medium text-brand-200">{val as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews section */}
            <div className="mt-10 bg-brand-900 border border-brand-800 rounded p-6">
              <div className="flex items-center justify-between mb-4 border-b border-brand-800 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-brand-100 uppercase tracking-widest">Kullanici Degerlendirmeleri</h2>
                  {reviews && reviews.totalReviews > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={star <= Math.round(reviews.averageRating) ? "#facc15" : "none"} stroke="#facc15" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-brand-300">{reviews.averageRating?.toFixed(1)}</span>
                      <span className="text-xs text-brand-500">({reviews.totalReviews} degerlendirme)</span>
                    </div>
                  )}
                </div>
                {alreadyOwned && (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="px-4 py-2 rounded bg-brand-800 border border-brand-700 text-xs font-bold text-brand-200 uppercase tracking-widest hover:bg-brand-700 transition-colors"
                  >
                    Degerlendirme Yaz
                  </button>
                )}
              </div>

              {/* Review form */}
              {showReviewForm && (
                <div className="mb-6 p-4 bg-brand-950 border border-brand-800 rounded">
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs font-bold text-brand-400 uppercase tracking-widest mr-2">Puan:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={star <= reviewRating ? "#facc15" : "none"} stroke="#facc15" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder="Degerlendirmenizi yazin..."
                    className="w-full px-4 py-3 rounded bg-brand-900 border border-brand-800 text-brand-100 text-sm focus:outline-none focus:border-brand-600 transition-colors placeholder-brand-600 font-medium resize-none"
                    rows={4}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await api.reviews.create(slug, { rating: reviewRating, content: reviewContent });
                        const updated = await api.reviews.list(slug);
                        setReviews(updated);
                        setShowReviewForm(false);
                        setReviewContent("");
                        setReviewRating(5);
                        addToast("Degerlendirmeniz eklendi", "success");
                      } catch (err: any) {
                        addToast(err.message || "Degerlendirme gonderilemedi", "error");
                      }
                    }}
                    className="mt-3 px-6 py-2 rounded bg-brand-200 text-brand-950 font-black text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  >
                    Gonder
                  </button>
                </div>
              )}

              {/* Reviews list */}
              {reviews?.reviews?.length > 0 ? (
                <div className="space-y-4">
                  {reviews.reviews.map((review: any) => (
                    <div key={review.id} className="p-4 bg-brand-950 border border-brand-800 rounded">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded bg-brand-800 flex items-center justify-center text-brand-200 font-black text-xs">
                          {review.user?.username?.slice(0, 2).toUpperCase() || "??"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-200">{review.user?.username || "Anonim"}</span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg key={star} width="12" height="12" viewBox="0 0 24 24" fill={star <= review.rating ? "#facc15" : "none"} stroke="#facc15" strokeWidth="2">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] text-brand-500 font-medium">{new Date(review.createdAt).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-sm text-brand-300 font-medium leading-relaxed">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brand-500 font-medium">Henuz degerlendirme yapilmamis.</p>
              )}
            </div>
          </div>

          {/* Right: purchase panel */}
          <div className="w-[340px] flex-shrink-0">
            <div className="rounded bg-brand-900 border border-brand-800 p-6 sticky top-6 shadow-xl">

              {/* Already Owned State */}
              {alreadyOwned && !paymentSuccess ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-brand-800 border-2 border-brand-700">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-200" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="text-brand-200 font-black text-sm mb-2 uppercase tracking-widest">Kütüphanenizde</div>
                  <p className="text-xs text-brand-500 font-medium mb-6">Bu oyun zaten satın alınmış.</p>
                  <button
                    onClick={() => onNavigate("library")}
                    className="w-full py-3 rounded text-sm font-black uppercase tracking-widest transition-colors text-white hover:brightness-110"
                    style={{ background: "linear-gradient(to right, #47bfff, #1a70cb)" }}
                  >
                    Kütüphaneye Git
                  </button>
                </div>
              ) : (
                <>
                  {/* Price */}
                  <div className="mb-6 flex flex-col">
                    {totalSaved > 0.01 && (
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-brand-200 text-brand-950">
                          -{Math.round((totalSaved / basePrice) * 100)}%
                        </span>
                        <span className="text-sm font-medium text-brand-600 line-through">{basePrice.toFixed(0)} TL</span>
                      </div>
                    )}
                    <div className="text-4xl font-black text-brand-100">{finalPrice.toFixed(2)} TL</div>
                  </div>

                  {/* Discounts breakdown */}
                  {(studentDiscount > 0 || referralDiscount > 0 || gameDiscount > 0) && (
                    <div className="space-y-2 mb-6 text-xs font-medium border-t border-brand-800 pt-4">
                      {gameDiscount > 0 && (
                        <div className="flex justify-between text-brand-400">
                          <span>Oyun İndirimi</span>
                          <span className="text-brand-200">-{gameDiscount}%</span>
                        </div>
                      )}
                      {studentDiscount > 0 && (
                        <div className="flex justify-between text-brand-400">
                          <span>Öğrenci İndirimi</span>
                          <span className="text-brand-200">-{studentDiscount}%</span>
                        </div>
                      )}
                      {referralDiscount > 0 && (
                        <div className="flex justify-between text-brand-400">
                          <span>Referans İndirimi</span>
                          <span className="text-brand-200">-{referralDiscount}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Referral code input */}
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Referans Kodu (Opsiyonel)"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="w-full px-4 py-3 rounded bg-brand-950 border border-brand-800 text-brand-100 text-xs focus:outline-none focus:border-brand-600 transition-colors uppercase placeholder-brand-600 font-bold tracking-wider"
                    />
                    {referralCode && <div className="text-xs font-bold text-brand-300 mt-2 ml-1">-5% referans uygulandı</div>}
                  </div>

                  {/* Wishlist toggle */}
                  {!alreadyOwned && !paymentSuccess && (
                    <div className="mb-6">
                      <button
                        onClick={async () => {
                          try {
                            if (inWishlist) {
                              await api.wishlist.remove(game.id);
                              setInWishlist(false);
                              addToast("İstek listesinden çıkarıldı", "success");
                            } else {
                              await api.wishlist.add(game.id);
                              setInWishlist(true);
                              addToast("İstek listesine eklendi", "success");
                            }
                          } catch (err: any) {
                            addToast(err.message || "İşlem başarısız", "error");
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded bg-brand-950 border border-brand-800 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-brand-800 text-brand-300 hover:text-brand-100"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={inWishlist ? "#ef4444" : "none"} stroke={inWishlist ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {inWishlist ? "İstek Listesinden Çıkar" : "İstek Listesine Ekle"}
                      </button>
                      <AddToCollectionDropdown gameId={game.id} />
                    </div>
                  )}

                  {paymentSuccess ? (
                    <div className="text-center py-6 border-t border-brand-800 mt-4">
                      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-brand-800 border-4 border-brand-900">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-200" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="text-brand-100 font-black text-lg mb-1 uppercase tracking-widest">Satın Alındı!</div>
                      <p className="text-xs font-medium text-brand-500 uppercase tracking-widest mb-4">Kütüphaneye Eklendi</p>
                      <button
                        onClick={() => onNavigate("library")}
                        className="w-full py-3 rounded text-sm font-black uppercase tracking-widest transition-colors text-white hover:brightness-110"
                        style={{ background: "linear-gradient(to right, #47bfff, #1a70cb)" }}
                      >
                        Kütüphaneye Git
                      </button>
                    </div>
                  ) : paymentPending ? (
                    <div className="text-center py-6 border-t border-brand-800 mt-4">
                      <div className="w-12 h-12 rounded-full mx-auto mb-4 border-4 border-brand-800 border-t-brand-200 animate-spin" />
                      <div className="text-brand-300 font-bold text-sm uppercase tracking-widest">3D Secure Doğrulanıyor...</div>
                      <p className="text-xs font-medium text-brand-500 mt-1">Açılan pencerede işleminizi tamamlayın</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowPayment(!showPayment)}
                        className="w-full py-4 rounded bg-brand-200 text-brand-950 font-black text-sm transition-colors hover:bg-white uppercase tracking-widest"
                      >
                        SATIN AL
                      </button>
                      <button
                        onClick={() => {
                          addToCart(game.id);
                          addToast("Sepete eklendi", "success");
                        }}
                        className="w-full mt-3 py-3 rounded bg-transparent border border-brand-800 text-brand-300 hover:text-brand-100 font-black text-sm transition-colors uppercase tracking-widest hover:bg-brand-800"
                      >
                        SEPETE EKLE
                      </button>
                      {error && (
                        <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded">
                          <p className="text-red-400 text-xs font-bold text-center">{error}</p>
                        </div>
                      )}
                    </>
                  )}

                  {showPayment && !paymentSuccess && !paymentPending && (
                    <div className="mt-6 pt-6 border-t border-brand-800">
                      <InstallmentSelector
                        price={finalPrice.toFixed(2)}
                        onConfirm={handleBuy}
                      />
                    </div>
                  )}

                  {/* Taksit highlight */}
                  {!paymentSuccess && !paymentPending && (
                    <div className="mt-6 rounded bg-brand-950 border border-brand-800 p-3 text-center">
                      <p className="text-xs text-brand-300 font-bold uppercase tracking-wider">
                        12 taksit ile aylık {(finalPrice / 12).toFixed(2)} TL
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Lightbox */}
      {lightboxOpen && screenshots?.length > 0 && (
        <ScreenshotLightbox
          screenshots={screenshots}
          currentIndex={activeScreenshot}
          onClose={() => setLightboxOpen(false)}
          onNavigate={(i) => setActiveScreenshot(i)}
        />
      )}
    </div>
  );
}
