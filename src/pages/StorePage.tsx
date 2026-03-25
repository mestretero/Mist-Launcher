import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GameCard } from "../components/GameCard";
import type { Game } from "../lib/types";

interface StorePageProps {
  onGameClick: (slug: string) => void;
}

const CATEGORIES = [
  "Tümü", "Aksiyon", "RPG", "Strateji", "FPS", "Macera", "Indie",
  "Yarış", "Spor", "Hayatta Kalma", "Korku", "Simülasyon", "Açık Dünya", "Çok Oyunculu", "Platform", "Bulmaca"
];

export function StorePage({ onGameClick }: StorePageProps) {
  const [featured, setFeatured] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    api.games.featured().then(setFeatured);
    api.games.list(1, selectedCategory).then(setAllGames);
  }, [selectedCategory]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setSearchQuery("");
    setSearchResults(null);
  };

  // Auto-slide effect
  useEffect(() => {
    if (featured.length === 0 || searchResults) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featured.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featured, searchResults]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length > 1) {
      const results = await api.games.search(q);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  const discountedGames = allGames.filter((g) => g.discountPercent > 0);
  
  // Sort by releaseDate DESC (allGames already comes sorted from API, but ensure it)
  const newReleases = [...allGames]
    .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    .slice(0, 8);
  // Best sellers: highest price games as proxy (no sales data yet)
  const bestSellers = [...allGames]
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, 8);
  // Recommended: mix by shuffling with a stable seed per session
  const recommended = [...allGames]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 6);

  // Wrap sections in a container for left/right margins
  const containerClass = "max-w-[1400px] mx-auto px-10";

  return (
    <div className="bg-brand-950 font-sans pb-20 mt-4">
      {/* Top Search Bar */}
      <div className={`mb-8 ${containerClass}`}>
        <div className="relative w-full max-w-xl mx-auto">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 pointer-events-none"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Oyun, yayıncı veya kategori ara..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-full bg-brand-900 border border-brand-800 text-brand-100 text-sm font-bold tracking-widest uppercase focus:outline-none focus:border-brand-500 transition-colors placeholder-brand-600 shadow-inner"
          />
        </div>
      </div>

      {searchResults ? (
        <div className={`${containerClass} py-10`}>
          <div className="flex items-center gap-3 mb-8 border-b border-brand-800 pb-2">
            <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">Arama Sonuçları</h2>
            <span className="text-sm font-bold bg-brand-800 px-3 py-1 rounded text-brand-300">{searchResults.length} YAZILIM</span>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {searchResults.map((game) => (
              <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
            ))}
          </div>
          {searchResults.length === 0 && (
            <div className="py-20 text-center bg-brand-900 border border-brand-800 rounded mt-4">
              <p className="text-brand-500 font-bold uppercase tracking-widest">Eşleşen sonuç bulunamadı.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Hero Carousel */}
          {featured.length > 0 && (
            <div className={`${containerClass} mb-12`}>
              <div className="relative w-full overflow-hidden bg-brand-900 rounded group border border-brand-800 shadow-2xl" style={{ height: "450px" }}>
                {featured.map((game, idx) => (
                  <div 
                    key={game.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                  >
                    <img
                      src={game.coverImageUrl}
                      alt={game.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-out"
                      style={{ 
                        filter: "brightness(0.6) contrast(1.1)",
                        transform: idx === currentSlide ? "scale(1.05)" : "scale(1)" 
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-950 to-transparent" />

                    <div className="absolute inset-0 flex flex-col justify-center px-16 max-w-4xl">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded bg-brand-200 text-brand-950 mb-4 self-start">
                        Öne Çıkan
                      </span>
                      <h1 className="text-6xl font-black text-white mb-4 tracking-tighter cursor-pointer hover:text-brand-200 transition-colors" onClick={() => onGameClick(game.slug)}>
                        {game.title}
                      </h1>
                      <p className="text-brand-300 font-medium text-base mb-8 line-clamp-2 leading-relaxed max-w-xl">
                        {game.shortDescription || game.description?.slice(0, 150)}
                      </p>
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => onGameClick(game.slug)}
                          className="px-8 py-3 rounded text-sm font-black bg-brand-100 text-brand-950 hover:bg-white transition-colors uppercase tracking-widest border-2 border-transparent"
                        >
                          Mağaza Sayfası
                        </button>
                        <div className="flex flex-col">
                          <span className="text-3xl font-black text-brand-100">
                            {(parseFloat(game.price) * (1 - game.discountPercent / 100)).toFixed(0)} TL
                          </span>
                          {game.discountPercent > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-200 text-brand-950">
                                -{game.discountPercent}%
                              </span>
                              <span className="text-xs text-brand-500 line-through font-bold">
                                {parseFloat(game.price).toFixed(0)} TL
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Carousel Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                  {featured.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === currentSlide ? "w-10 bg-brand-200" : "w-4 bg-brand-700 hover:bg-brand-500"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommended Section (New) - Horizontal scroll */}
          {recommended.length > 0 && (
            <div className={`mt-8 ${containerClass}`}>
              <div className="flex items-center justify-between mb-6 border-b border-brand-800 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">Sizin İçin Önerilenler</h2>
                  <span className="text-[10px] font-black px-2 py-1 rounded bg-brand-800 text-brand-400 uppercase tracking-widest">Oynananlara Göre</span>
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                {recommended.map((game) => (
                  <div key={game.id} className="w-[300px] flex-shrink-0 snap-start">
                    <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deal Section - Horizontal scroll */}
          {discountedGames.length > 0 && (
            <div className={`mt-8 ${containerClass}`}>
              <div className="flex items-center justify-between mb-6 border-b border-brand-800 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">Özel Fırsatlar</h2>
                  <span className="text-[10px] font-black px-2 py-1 rounded bg-brand-200 text-brand-950 uppercase tracking-widest">İndirim</span>
                </div>
                <button onClick={() => toggleSection("deals")} className="text-xs font-bold text-brand-500 hover:text-brand-200 transition-colors uppercase tracking-widest">
                  {expandedSections.deals ? "Daralt" : "Tümüne Göz At"}
                </button>
              </div>
              {expandedSections.deals ? (
                <div className="grid grid-cols-4 gap-6 pb-6">
                  {discountedGames.map((game) => (
                    <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
                  ))}
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {discountedGames.map((game) => (
                    <div key={game.id} className="w-[300px] flex-shrink-0 snap-start">
                      <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Releases Section */}
          {newReleases.length > 0 && (
            <div className={`mt-8 ${containerClass}`}>
              <div className="flex items-center justify-between mb-6 border-b border-brand-800 pb-2">
                <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">Yeni Çıkanlar</h2>
                <button onClick={() => toggleSection("new")} className="text-xs font-bold text-brand-500 hover:text-brand-200 transition-colors uppercase tracking-widest">
                  {expandedSections.new ? "Daralt" : "Tümüne Göz At"}
                </button>
              </div>
              {expandedSections.new ? (
                <div className="grid grid-cols-4 gap-6 pb-6">
                  {[...allGames].sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()).map((game) => (
                    <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
                  ))}
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {newReleases.map((game) => (
                    <div key={game.id} className="w-[300px] flex-shrink-0 snap-start">
                      <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Best Sellers Section */}
          {bestSellers.length > 0 && (
            <div className={`mt-8 ${containerClass}`}>
              <div className="flex items-center justify-between mb-6 border-b border-brand-800 pb-2">
                <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest">Çok Satanlar</h2>
                <button onClick={() => toggleSection("best")} className="text-xs font-bold text-brand-500 hover:text-brand-200 transition-colors uppercase tracking-widest">
                  {expandedSections.best ? "Daralt" : "Tümüne Göz At"}
                </button>
              </div>
              {expandedSections.best ? (
                <div className="grid grid-cols-4 gap-6 pb-6">
                  {[...allGames].sort((a, b) => parseFloat(b.price) - parseFloat(a.price)).map((game) => (
                    <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
                  ))}
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {bestSellers.map((game) => (
                    <div key={game.id} className="w-[300px] flex-shrink-0 snap-start">
                      <GameCard game={game} onClick={() => onGameClick(game.slug)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Browse Categories */}
          <div className={`mt-12 mb-10 ${containerClass}`}>
             <h2 className="text-xl font-bold text-brand-100 uppercase tracking-widest mb-6 border-b border-brand-800 pb-2">Kategorilere Göz At</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {CATEGORIES.map((category) => (
                  <div
                    key={category}
                    onClick={() => handleCategoryClick(category)}
                    className={`h-20 rounded border flex items-center justify-center cursor-pointer transition-all hover:-translate-y-1 shadow-sm px-4 text-center ${
                      selectedCategory === category
                        ? "bg-brand-200 border-brand-200"
                        : "bg-brand-900 border-brand-800 hover:bg-brand-800 hover:border-brand-600"
                    }`}
                  >
                    <span className={`text-sm font-black uppercase tracking-widest ${
                      selectedCategory === category ? "text-brand-950" : "text-brand-200"
                    }`}>{category}</span>
                  </div>
                ))}
             </div>
          </div>

        </>
      )}
    </div>
  );
}
