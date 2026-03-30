import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { ScreenshotLightbox } from "../components/ScreenshotLightbox";
import { AddToCollectionDropdown } from "../components/AddToCollectionDropdown";
import { AchievementCard } from "../components/AchievementCard";
import { CommunityLinks } from "../components/CommunityLinks";
import type { Game } from "../lib/types";

interface Props {
  slug: string;
  onBack: () => void;
  onNavigate: (page: string, slug?: string) => void;
}

export function GameDetailPage({ slug, onBack, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [game, setGame] = useState<Game | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [reviews, setReviews] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [achievements, setAchievements] = useState<any[]>([]);

  useEffect(() => {
    api.games.getBySlug(slug).then(setGame);
  }, [slug]);

  useEffect(() => {
    if (!game) return;
    api.wishlist.check(game.id).then((res) => setInWishlist(res.wishlisted)).catch(() => {});
  }, [game]);

  useEffect(() => {
    api.reviews.list(slug).then(setReviews).catch(() => {});
  }, [slug]);

  useEffect(() => {
    api.achievements.forGame(slug).then((res: any) => {
      if (Array.isArray(res)) setAchievements(res);
      else if (res?.achievements) setAchievements(res.achievements);
      else setAchievements([]);
    }).catch(() => setAchievements([]));
  }, [slug]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64 bg-brand-950 font-sans">
        <div className="text-brand-500 text-sm font-medium tracking-widest uppercase">{t("common.loading")}</div>
      </div>
    );
  }

  const screenshots = typeof game.screenshots === "string"
    ? JSON.parse(game.screenshots) : game.screenshots;
  const requirements = typeof game.minRequirements === "string"
    ? JSON.parse(game.minRequirements) : game.minRequirements;

  const releaseDate = game.releaseDate
    ? new Date(game.releaseDate).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-brand-950 font-sans">
      {/* Hero image */}
      <div className="relative w-full border-b border-brand-800" style={{ height: "400px" }}>
        <img
          src={screenshots?.[0] || game.coverImageUrl}
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.4) contrast(1.1)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/50 to-transparent" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-sm font-bold text-white/80 hover:text-white transition-colors hover:bg-black/60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          {t("gameDetail.back")}
        </button>

        {/* Title + info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-10 pb-8">
          <div className="flex items-end gap-6">
            {/* Cover thumbnail */}
            <img
              src={game.coverImageUrl}
              alt={game.title}
              className="w-36 h-48 object-cover rounded-lg border-2 border-brand-800 shadow-2xl flex-shrink-0 -mb-2"
            />
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-4xl font-black text-white mb-2 tracking-tight leading-tight">{game.title}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-brand-300">{game.publisher.name}</span>
                {releaseDate && (
                  <>
                    <span className="text-brand-600">•</span>
                    <span className="text-sm text-brand-400">{releaseDate}</span>
                  </>
                )}
              </div>
              {/* Category tags */}
              {game.categories?.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {game.categories.slice(0, 5).map((cat) => (
                    <span key={cat} className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-semibold text-white/80">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-10 py-8 max-w-[1200px] mx-auto">
        <div className="flex gap-8">
          {/* Left: main content */}
          <div className="flex-1 min-w-0">

            {/* Short description */}
            {game.shortDescription && (
              <p className="text-brand-300 text-base leading-relaxed mb-8 font-medium">{game.shortDescription}</p>
            )}

            {/* Screenshots gallery */}
            {screenshots?.length > 0 && (
              <div className="mb-8">
                <div
                  className="rounded-lg overflow-hidden mb-3 border border-brand-800 bg-brand-900 cursor-pointer group relative"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={screenshots[activeScreenshot]}
                    alt={`Screenshot ${activeScreenshot + 1}`}
                    className="w-full aspect-video object-cover group-hover:brightness-110 transition-all"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 rounded-full p-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {screenshots.map((url: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveScreenshot(i)}
                      className={`rounded-md overflow-hidden flex-shrink-0 transition-all duration-200 border-2 ${
                        activeScreenshot === i
                          ? "border-[#1a9fff] opacity-100"
                          : "border-transparent opacity-50 hover:opacity-80"
                      }`}
                      style={{ width: "120px" }}
                    >
                      <img src={url} className="w-full h-[68px] object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* About / Description */}
            <div className="mb-8 bg-brand-900 border border-brand-800 rounded-lg p-6">
              <h2 className="text-sm font-bold text-brand-100 mb-4 uppercase tracking-widest border-b border-brand-800 pb-3">{t("gameDetail.about")}</h2>
              <div
                className="text-sm text-brand-300 leading-relaxed font-medium prose prose-invert max-w-none
                  [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4
                  [&_video]:max-w-full [&_video]:rounded-lg [&_video]:my-4
                  [&_p]:mb-3 [&_p]:last:mb-0"
                dangerouslySetInnerHTML={{ __html: game.description }}
              />
            </div>

            {/* System requirements */}
            {requirements && Object.keys(requirements).length > 0 && (
              <div className="mb-8 bg-brand-900 border border-brand-800 rounded-lg p-6">
                <h2 className="text-sm font-bold text-brand-100 mb-4 uppercase tracking-widest border-b border-brand-800 pb-3">{t("gameDetail.minRequirements")}</h2>
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
            <div className="mb-8 bg-brand-900 border border-brand-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4 border-b border-brand-800 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-brand-100 uppercase tracking-widest">{t("gameDetail.userReviews")}</h2>
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
                      <span className="text-xs text-brand-500">({reviews.totalReviews})</span>
                    </div>
                  )}
                </div>
                {user && (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="px-4 py-2 rounded-md bg-brand-800 border border-brand-700 text-xs font-bold text-brand-200 uppercase tracking-widest hover:bg-brand-700 transition-colors"
                  >
                    {t("gameDetail.writeReview")}
                  </button>
                )}
              </div>

              {/* Review form */}
              {showReviewForm && (
                <div className="mb-6 p-4 bg-brand-950 border border-brand-800 rounded-lg">
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs font-bold text-brand-400 uppercase tracking-widest mr-2">{t("gameDetail.rating")}:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setReviewRating(star)} className="transition-transform hover:scale-110">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={star <= reviewRating ? "#facc15" : "none"} stroke="#facc15" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder={t("gameDetail.reviewPlaceholder")}
                    className="w-full px-4 py-3 rounded-md bg-brand-900 border border-brand-800 text-brand-100 text-sm focus:outline-none focus:border-[#1a9fff] transition-colors placeholder-brand-600 font-medium resize-none"
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
                        addToast(t("gameDetail.reviewAdded"), "success");
                      } catch (err: any) {
                        addToast(err.message || t("gameDetail.reviewError"), "error");
                      }
                    }}
                    className="mt-3 px-6 py-2 rounded-md bg-[#1a9fff] hover:bg-[#1580d0] text-white font-bold text-xs uppercase tracking-widest transition-colors"
                  >
                    {t("gameDetail.submit")}
                  </button>
                </div>
              )}

              {/* Reviews list */}
              {reviews?.reviews?.length > 0 ? (
                <div className="space-y-3">
                  {reviews.reviews.map((review: any) => (
                    <div key={review.id} className="p-4 bg-brand-950 border border-brand-800 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-brand-800 flex items-center justify-center text-brand-200 font-bold text-xs">
                          {review.user?.username?.slice(0, 2).toUpperCase() || "??"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-200">{review.user?.username || t("gameDetail.anonymous")}</span>
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
                <p className="text-sm text-brand-500 font-medium">{t("gameDetail.noReviews")}</p>
              )}
            </div>

            {/* Community Download Links */}
            <div className="mb-8">
              <CommunityLinks slug={slug} onNavigateToUser={(username) => onNavigate("user-profile", username)} />
            </div>

            {/* Achievements section */}
            {achievements.length > 0 && (
              <div className="mb-8 bg-brand-900 border border-brand-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4 border-b border-brand-800 pb-3">
                  <h2 className="text-sm font-bold text-brand-100 uppercase tracking-widest">{t("library.achievements")}</h2>
                  <span className="text-xs font-bold text-brand-500">
                    {achievements.filter((a: any) => a.unlocked).length} / {achievements.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {achievements.map((ach: any) => (
                    <AchievementCard key={ach.id} achievement={ach} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: Game info + actions */}
          <div className="w-[300px] flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Game info card */}
              <div className="bg-brand-900 border border-brand-800 rounded-lg p-5">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500 block mb-1">{t("gameDetail.publisher") || "Yayıncı"}</span>
                    <span className="text-sm font-semibold text-brand-200">{game.publisher.name}</span>
                  </div>
                  {releaseDate && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500 block mb-1">{t("gameDetail.releaseDate") || "Çıkış Tarihi"}</span>
                      <span className="text-sm font-semibold text-brand-200">{releaseDate}</span>
                    </div>
                  )}
                  {game.categories?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500 block mb-1">{t("gameDetail.categories") || "Kategoriler"}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {game.categories.map((cat) => (
                          <span key={cat} className="px-2 py-0.5 rounded bg-brand-800 text-[11px] font-semibold text-brand-300">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-brand-900 border border-brand-800 rounded-lg p-5 space-y-3">
                {/* Wishlist */}
                <button
                  onClick={async () => {
                    try {
                      if (inWishlist) {
                        await api.wishlist.remove(game.id);
                        setInWishlist(false);
                        addToast(t("gameDetail.removedFromWishlist"), "success");
                      } else {
                        await api.wishlist.add(game.id);
                        setInWishlist(true);
                        addToast(t("gameDetail.addedToWishlist"), "success");
                      }
                    } catch (err: any) {
                      addToast(err.message || t("common.operationFailed"), "error");
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                    inWishlist
                      ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      : "bg-brand-800 border border-brand-700 text-brand-200 hover:bg-brand-700"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {inWishlist ? t("gameDetail.removeFromWishlist") : t("gameDetail.addToWishlist")}
                </button>

                {/* Add to collection */}
                <AddToCollectionDropdown gameId={game.id} />
              </div>
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
