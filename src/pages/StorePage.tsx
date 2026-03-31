import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { GameCard } from "../components/GameCard";
import type { Game } from "../lib/types";

function ScrollableRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
  return (
    <div className="relative group/row">
      <div ref={ref} className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x">{children}</div>
      <button onClick={() => scroll(-1)} className="absolute left-0 top-[40%] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all opacity-0 group-hover/row:opacity-100 -ml-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onClick={() => scroll(1)} className="absolute right-0 top-[40%] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all opacity-0 group-hover/row:opacity-100 -mr-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  );
}

interface StorePageProps {
  onGameClick: (slug: string) => void;
}

export function StorePage({ onGameClick }: StorePageProps) {
  const { t } = useTranslation();

  const CATEGORIES = [
    { key: "all", label: t("store.categories.all") },
    { key: "Action", label: t("store.categories.action") },
    { key: "Adventure", label: t("store.categories.adventure") },
    { key: "RPG", label: t("store.categories.rpg") },
    { key: "Strategy", label: t("store.categories.strategy") },
    { key: "Indie", label: t("store.categories.indie") },
    { key: "Simulation", label: t("store.categories.simulation") },
    { key: "Racing", label: t("store.categories.racing") },
    { key: "Sports", label: t("store.categories.sports") },
    { key: "Casual", label: t("store.categories.puzzle") },
    { key: "Early Access", label: "Early Access" },
  ];

  const [featured, setFeatured] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentSlide, setCurrentSlide] = useState(0);

  // Curated rows
  const [newReleases, setNewReleases] = useState<Game[]>([]);
  const [recommended, setRecommended] = useState<Game[]>([]);

  // Infinite scroll state
  const [browseGames, setBrowseGames] = useState<Game[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Load featured + curated rows on mount
  useEffect(() => {
    api.games.featured().then(setFeatured);
    api.games.list(1, 10).then(({ games }) => setNewReleases(games));
    api.games.recommended().then(setRecommended).catch(() => {});
  }, []);

  // Load browse section (with category filter + pagination)
  const loadBrowse = useCallback(async (page: number, category: string, reset = false) => {
    setBrowseLoading(true);
    const cat = category === "all" ? undefined : category;
    const { games, meta } = await api.games.list(page, 20, cat);
    setBrowseGames((prev) => reset ? games : [...prev, ...games]);
    setBrowseTotal(meta.total);
    setBrowsePage(page);
    setBrowseLoading(false);
  }, []);

  useEffect(() => {
    loadBrowse(1, selectedCategory, true);
  }, [selectedCategory, loadBrowse]);

  // Infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !browseLoading && browseGames.length < browseTotal) {
          loadBrowse(browsePage + 1, selectedCategory);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [browseLoading, browseGames.length, browseTotal, browsePage, selectedCategory, loadBrowse]);

  // Auto-slide
  useEffect(() => {
    if (featured.length === 0 || searchResults) return;
    const interval = setInterval(() => setCurrentSlide((prev) => (prev + 1) % featured.length), 5000);
    return () => clearInterval(interval);
  }, [featured, searchResults]);

  // Search with debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length > 1) {
      searchTimer.current = setTimeout(async () => {
        const results = await api.games.search(q);
        setSearchResults(results);
      }, 300);
    } else {
      setSearchResults(null);
    }
  };

  const cx = "max-w-[1400px] mx-auto px-6 lg:px-10";

  return (
    <div className="bg-[#0a0c10] font-sans pb-20">

      {/* Search Bar — centered, rounded */}
      <div className="py-6 flex justify-center px-6">
        <div className="relative w-full max-w-xl">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5e6673] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder={t("store.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-10 py-3 rounded-full bg-[#1a1c23] border border-[#2a2e38] text-white text-sm focus:outline-none focus:border-[#1a9fff] transition-colors placeholder-[#5e6673] shadow-inner"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {searchResults ? (
        /* Search Results */
        <div className={`${cx} pb-10`}>
          <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6">
            {t("store.searchResults")} <span className="text-[#5e6673] text-sm ml-2">{searchResults.length} {t("store.software")}</span>
          </h2>
          {searchResults.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[#5e6673] font-bold uppercase tracking-widest">{t("store.noResults")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {searchResults.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Hero Carousel */}
          {featured.length > 0 && (
            <div className={`${cx} mb-10`}>
              <div className="relative w-full overflow-hidden rounded-2xl group shadow-2xl" style={{ height: "420px" }}>
                {featured.map((game, idx) => {
                  const heroImg = (() => {
                    try {
                      const ss = typeof game.screenshots === "string" ? JSON.parse(game.screenshots) : game.screenshots;
                      return Array.isArray(ss) && ss.length > 0 ? ss[0] : game.coverImageUrl;
                    } catch { return game.coverImageUrl; }
                  })();
                  return (
                    <div key={game.id} className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                      <img src={heroImg} alt={game.title} className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.6) contrast(1.05) saturate(1.1)", transform: idx === currentSlide ? "scale(1.02)" : "scale(1)", transition: "transform 8s ease-out" }} />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c10]/90 via-[#0a0c10]/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0c10] to-transparent" />
                      <div className="absolute inset-0 flex flex-col justify-end px-12 pb-16 max-w-3xl">
                        {game.categories?.[0] && (
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded bg-[#1a9fff] text-white mb-3 self-start">{game.categories[0]}</span>
                        )}
                        <h1 className="text-4xl lg:text-5xl font-black text-white mb-3 cursor-pointer hover:text-[#1a9fff] transition-colors leading-tight" onClick={() => onGameClick(game.slug)}>
                          {game.title}
                        </h1>
                        <p className="text-[#8f98a0] text-sm mb-6 line-clamp-2 max-w-lg leading-relaxed">
                          {game.shortDescription || game.description?.slice(0, 150)}
                        </p>
                        <button onClick={() => onGameClick(game.slug)} className="px-6 py-2.5 rounded-lg text-xs font-black bg-[#1a9fff] text-white hover:bg-[#1a9fff]/80 transition-colors uppercase tracking-widest self-start">
                          {t("store.storePage")}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Arrows */}
                <button onClick={() => setCurrentSlide((p) => (p - 1 + featured.length) % featured.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button onClick={() => setCurrentSlide((p) => (p + 1) % featured.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {featured.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1.5 rounded-full transition-all ${idx === currentSlide ? "w-8 bg-[#1a9fff]" : "w-3 bg-white/30 hover:bg-white/50"}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* New Releases Row */}
          {newReleases.length > 0 && (
            <div className={`mb-8 ${cx}`}>
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">{t("store.newReleases")}</h2>
              <ScrollableRow>
                {newReleases.map((game) => (
                  <div key={game.id} className="w-[220px] flex-shrink-0 snap-start">
                    <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                  </div>
                ))}
              </ScrollableRow>
            </div>
          )}

          {/* Recommended Row */}
          {recommended.length > 0 && (
            <div className={`mb-8 ${cx}`}>
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">{t("store.recommended")}</h2>
              <ScrollableRow>
                {recommended.map((game) => (
                  <div key={game.id} className="w-[220px] flex-shrink-0 snap-start">
                    <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                  </div>
                ))}
              </ScrollableRow>
            </div>
          )}

          {/* Category Filter + Browse All (Infinite Scroll) */}
          <div className={`mt-6 ${cx}`}>
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">{t("store.browseCategories")}</h2>

            {/* Category Pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                    selectedCategory === cat.key
                      ? "bg-[#1a9fff] text-white"
                      : "bg-[#1a1c23] text-[#8f98a0] hover:text-white border border-[#2a2e38]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Game Grid — Infinite Scroll */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {browseGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>

            {/* Infinite Scroll Loader */}
            <div ref={loaderRef} className="flex items-center justify-center py-8">
              {browseLoading && (
                <svg className="animate-spin text-[#1a9fff]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              )}
              {!browseLoading && browseGames.length >= browseTotal && browseGames.length > 0 && (
                <p className="text-[#5e6673] text-xs font-bold uppercase tracking-widest">{browseGames.length} {t("store.software")}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
