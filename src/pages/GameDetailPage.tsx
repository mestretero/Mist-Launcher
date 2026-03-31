import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { ScreenshotLightbox } from "../components/ScreenshotLightbox";
import { AddToCollectionDropdown } from "../components/AddToCollectionDropdown";
import { CommunityLinks } from "../components/CommunityLinks";
import type { Game } from "../lib/types";

interface Props {
  slug: string;
  onBack: () => void;
  onNavigate: (page: string, slug?: string) => void;
}

const LANG_MAP: Record<string, string> = {
  tr: "turkish", en: "english", de: "german", es: "spanish",
};

export function GameDetailPage({ slug, onBack, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [game, setGame] = useState<Game | null>(null);
  const [localizedDesc, setLocalizedDesc] = useState<string | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [reviews, setReviews] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [activeTab, setActiveTab] = useState<"about" | "reviews" | "links">("about");

  useEffect(() => { api.games.getBySlug(slug).then(setGame); }, [slug]);
  useEffect(() => { if (game) api.wishlist.check(game.id).then((r) => setInWishlist(r.wishlisted)).catch(() => {}); }, [game]);
  useEffect(() => { api.reviews.list(slug).then(setReviews).catch(() => {}); }, [slug]);

  // Fetch localized description from Steam
  useEffect(() => {
    const steamLang = LANG_MAP[i18n.language] || "english";
    api.games.getDescription(slug, steamLang)
      .then((data) => { if (data?.description) setLocalizedDesc(data.description); })
      .catch(() => {});
  }, [slug, i18n.language]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0c10]">
        <svg className="animate-spin text-[#1a9fff]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
    );
  }

  const screenshots: string[] = (() => {
    try { return typeof game.screenshots === "string" ? JSON.parse(game.screenshots) : (game.screenshots || []); } catch { return []; }
  })();
  const requirements = (() => {
    try { return typeof game.minRequirements === "string" ? JSON.parse(game.minRequirements) : (game.minRequirements || {}); } catch { return {}; }
  })();
  const releaseDate = game.releaseDate ? new Date(game.releaseDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
  const heroImg = screenshots.length > 0 ? screenshots[0] : game.coverImageUrl;

  const handleSubmitReview = async () => {
    try {
      await api.reviews.create(slug, { rating: reviewRating, content: reviewContent });
      const updated = await api.reviews.list(slug);
      setReviews(updated);
      setShowReviewForm(false);
      setReviewContent("");
      setReviewRating(5);
      addToast(t("gameDetail.reviewAdded"), "success");
    } catch (err: any) {
      addToast(err.message || t("common.error"), "error");
    }
  };

  const tabs = [
    { key: "about", label: t("gameDetail.about") },
    { key: "reviews", label: `${t("gameDetail.userReviews")} ${reviews?.totalReviews ? `(${reviews.totalReviews})` : ""}` },
    { key: "links", label: t("gameDetail.communityLinksTab") },
  ];

  return (
    <div className="h-full bg-[#0a0c10] overflow-y-auto custom-scrollbar">

      {/* ═══ Hero Banner ═══ */}
      <div className="relative w-full" style={{ height: "480px" }}>
        <img src={heroImg} alt={game.title} className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.55) saturate(1.1)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c10]/80 via-transparent to-transparent" />

        {/* Back */}
        <button onClick={onBack} className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-sm text-sm font-bold text-white/80 hover:text-white hover:bg-black/60 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          {t("gameDetail.back")}
        </button>

        {/* Action buttons — Top Right, minimal */}
        <div className="absolute top-6 right-6 z-20 hidden lg:flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                if (inWishlist) { await api.wishlist.remove(game.id); setInWishlist(false); addToast(t("gameDetail.removedFromWishlist"), "success"); }
                else { await api.wishlist.add(game.id); setInWishlist(true); addToast(t("gameDetail.addedToWishlist"), "success"); }
              } catch (err: any) { addToast(err.message || t("common.error"), "error"); }
            }}
            className={`p-2.5 rounded-lg backdrop-blur-sm transition-all ${inWishlist ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-black/40 text-white/70 hover:text-white hover:bg-black/60"}`}
            title={inWishlist ? t("gameDetail.removeFromWishlist") : t("gameDetail.addToWishlist")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <AddToCollectionDropdown gameId={game.id} />
        </div>

        {/* Hero Content — Bottom Left */}
        <div className="absolute bottom-0 left-0 right-0 px-8 lg:px-12 pb-8 z-10">
          <div className="max-w-[1200px] mx-auto">
            {/* Cover — horizontal */}
            <img src={game.coverImageUrl} alt={game.title} className="w-72 h-36 object-cover rounded-xl border-2 border-[#2a2e38] shadow-2xl mb-4 hidden lg:block" />
            {/* Categories */}
            {game.categories?.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {game.categories.slice(0, 4).map((cat) => (
                  <span key={cat} className="px-2.5 py-1 rounded-md bg-[#1a9fff]/20 text-[#1a9fff] text-[10px] font-black uppercase tracking-widest">{cat}</span>
                ))}
              </div>
            )}
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-2 leading-tight">{game.title}</h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-[#c6d4df]">{game.publisher?.name}</span>
              {releaseDate && (
                <>
                  <span className="text-[#3d4450]">•</span>
                  <span className="text-[#8f98a0]">{releaseDate}</span>
                </>
              )}
              {reviews?.averageRating > 0 && (
                <>
                  <span className="text-[#3d4450]">•</span>
                  <div className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span className="text-[#facc15] font-bold">{reviews.averageRating.toFixed(1)}</span>
                  </div>
                </>
              )}
              {game.trailerUrl && (
                <>
                  <span className="text-[#3d4450]">•</span>
                  <a href={game.trailerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#1a9fff] hover:underline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Trailer
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="max-w-[1200px] mx-auto px-8 lg:px-12 py-8">

        {/* Mobile action buttons */}
        <div className="flex gap-3 mb-6 lg:hidden">
          <button
            onClick={async () => {
              try {
                if (inWishlist) { await api.wishlist.remove(game.id); setInWishlist(false); }
                else { await api.wishlist.add(game.id); setInWishlist(true); }
              } catch {}
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold ${inWishlist ? "bg-red-500/10 text-red-400" : "bg-[#1a9fff] text-white"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {inWishlist ? t("gameDetail.inWishlist") : t("gameDetail.addToWishlist")}
          </button>
        </div>

        {/* Screenshots Gallery */}
        {screenshots.length > 0 && (
          <div className="mb-8">
            <div className="rounded-xl overflow-hidden border border-[#2a2e38] bg-[#1a1c23] cursor-pointer group relative" onClick={() => setLightboxOpen(true)}>
              <img src={screenshots[activeScreenshot]} alt="" className="w-full aspect-video object-cover group-hover:brightness-110 transition-all" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/60 rounded-full p-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></div>
              </div>
            </div>
            {screenshots.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {screenshots.map((url: string, i: number) => (
                  <button key={i} onClick={() => setActiveScreenshot(i)} className={`rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${activeScreenshot === i ? "border-[#1a9fff] opacity-100" : "border-transparent opacity-40 hover:opacity-70"}`} style={{ width: "130px" }}>
                    <img src={url} className="w-full h-[72px] object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Tabs ═══ */}
        <div className="flex gap-1 mb-6 border-b border-[#2a2e38]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors relative ${
                activeTab === tab.key
                  ? "text-[#1a9fff]"
                  : "text-[#5e6673] hover:text-[#c6d4df]"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9fff]" />}
            </button>
          ))}
        </div>

        <div>
          {/* Tab Content — Full Width */}
          <div>

            {/* About Tab */}
            {activeTab === "about" && (
              <>
                <div className="bg-[#1a1c23] border border-[#2a2e38] rounded-xl p-6 mb-6">
                  <h2 className="text-xs font-black text-[#8f98a0] uppercase tracking-widest mb-4">{t("gameDetail.about")}</h2>
                  <div
                    className="text-sm text-[#c6d4df] leading-relaxed prose prose-invert max-w-none
                      [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4
                      [&_video]:max-w-full [&_video]:rounded-lg [&_video]:my-4
                      [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3
                      [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2
                      [&_p]:mb-3 [&_p]:last:mb-0
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                      [&_li]:mb-1
                      [&_a]:text-[#1a9fff] [&_a]:hover:underline"
                    dangerouslySetInnerHTML={{ __html: localizedDesc || game.description }}
                  />
                </div>

                {/* System Requirements */}
                {requirements && Object.keys(requirements).length > 0 && (
                  <div className="bg-[#1a1c23] border border-[#2a2e38] rounded-xl p-6">
                    <h2 className="text-xs font-black text-[#8f98a0] uppercase tracking-widest mb-4">{t("gameDetail.minRequirements")}</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(requirements).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#5e6673] block mb-1">{key}</span>
                          <span className="text-sm text-[#c6d4df]">{val as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="space-y-4">
                {/* Review Form */}
                {user && (
                  <div>
                    {!showReviewForm ? (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        className="w-full group flex items-center justify-center gap-3 py-4 rounded-xl bg-[#12151a] border border-dashed border-[#2a2e38] text-[#5e6673] hover:text-white hover:border-[#4a4e56] hover:bg-[#1a1c23] transition-all"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        <span className="text-sm font-semibold">{t("gameDetail.writeReview")}</span>
                      </button>
                    ) : (
                      <div className="bg-[#12151a] border border-[#2a2e38] rounded-xl p-5">
                        {/* Star Rating */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs font-semibold text-[#5e6673] mr-1">{t("gameDetail.rating")}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => setReviewRating(star)} className="hover:scale-125 transition-transform">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={star <= reviewRating ? "#facc15" : "#1e2128"} stroke={star <= reviewRating ? "#facc15" : "#3a3e48"} strokeWidth="1.5">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-[#5e6673] ml-1">{reviewRating}/5</span>
                        </div>
                        {/* Text Area */}
                        <textarea
                          value={reviewContent} onChange={(e) => setReviewContent(e.target.value)}
                          placeholder={t("gameDetail.reviewPlaceholder")}
                          className="w-full px-4 py-3 rounded-xl bg-[#0c0e14] border border-[#1e2128] text-white text-sm focus:outline-none focus:border-[#3a3e48] placeholder-[#3a3e48] resize-none transition-colors"
                          rows={4}
                        />
                        {/* Buttons */}
                        <div className="flex gap-2 mt-3">
                          <button onClick={handleSubmitReview} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                            {t("gameDetail.submit")}
                          </button>
                          <button onClick={() => setShowReviewForm(false)} className="px-4 py-2.5 rounded-lg text-xs font-semibold text-[#5e6673] hover:text-white hover:bg-[#1e2128] transition-colors">
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reviews List */}
                {reviews?.reviews?.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.reviews.map((review: any) => (
                      <div key={review.id} className="bg-[#12151a] border border-[#1e2128] rounded-xl p-5 hover:border-[#2a2e38] transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2a2e38] to-[#1e2128] flex items-center justify-center text-gray-400 font-black text-xs flex-shrink-0">
                            {review.user?.username?.slice(0, 2).toUpperCase() || "??"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-white">{review.user?.username || t("gameDetail.anonymous")}</span>
                              {/* Stars inline */}
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg key={star} width="13" height="13" viewBox="0 0 24 24" fill={star <= review.rating ? "#facc15" : "#1e2128"} stroke={star <= review.rating ? "#facc15" : "#2a2e38"} strokeWidth="1.5">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                  </svg>
                                ))}
                              </div>
                            </div>
                            <span className="text-[11px] text-[#3e4450]">
                              {new Date(review.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                        {review.content && (
                          <p className="text-sm text-[#9aa0aa] leading-relaxed ml-[52px]">{review.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2a2e38" strokeWidth="1.5" className="mx-auto mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p className="text-sm text-[#3e4450]">{t("gameDetail.noReviews")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Community Links Tab */}
            {activeTab === "links" && (
              <CommunityLinks slug={slug} onNavigateToUser={(username) => onNavigate("user-profile", username)} />
            )}
          </div>

        </div>
      </div>

      {/* Screenshot Lightbox */}
      {lightboxOpen && screenshots.length > 0 && (
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
