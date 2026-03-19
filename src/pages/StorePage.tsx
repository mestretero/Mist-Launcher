import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GameCard } from "../components/GameCard";
import type { Game } from "../lib/types";

interface StorePageProps {
  onGameClick: (slug: string) => void;
}

const CATEGORIES = ["Tümü", "Aksiyon", "RPG", "Strateji", "Spor", "Simülasyon", "Macera"];

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gray-500"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function StorePage({ onGameClick }: StorePageProps) {
  const [featured, setFeatured] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);
  const [activeCategory, setActiveCategory] = useState("Tümü");

  useEffect(() => {
    api.games.featured().then(setFeatured);
    api.games.list().then(setAllGames);
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length > 1) {
      const results = await api.games.search(q);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  const displayGames = searchResults ?? allGames;
  const discountedGames = allGames.filter((g) => g.discountPercent > 0);
  const heroBanner = featured[0] ?? allGames[0];

  return (
    <div className="min-h-screen" style={{ background: "#0a0a14" }}>
      {/* Hero Banner */}
      {!searchResults && heroBanner && (
        <div
          className="relative w-full overflow-hidden cursor-pointer"
          style={{ height: "340px" }}
          onClick={() => onGameClick(heroBanner.slug)}
        >
          {/* Background image */}
          <img
            src={heroBanner.coverImageUrl}
            alt={heroBanner.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.55) saturate(1.1)" }}
          />

          {/* Multi-layer gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(10,10,20,0.9) 0%, transparent 50%)" }} />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end px-10 pb-10">
            <div className="max-w-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-indigo-500/50 text-indigo-400" style={{ background: "rgba(99,102,241,0.15)" }}>
                  Öne Çıkan
                </span>
                {heroBanner.discountPercent > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400">
                    -%{heroBanner.discountPercent} İndirim
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-black text-white mb-2 leading-tight tracking-tight" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
                {heroBanner.title}
              </h1>
              <p className="text-gray-400 text-sm mb-5 line-clamp-2 max-w-sm">
                {heroBanner.shortDescription || heroBanner.description?.slice(0, 100)}
              </p>
              <div className="flex items-center gap-3">
                <button
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(90deg, #6366f1, #4f46e5)" }}
                >
                  Hemen Al
                </button>
                <span className="text-xl font-bold text-white">
                  ₺{(parseFloat(heroBanner.price) * (1 - heroBanner.discountPercent / 100)).toFixed(2)}
                  <span className="text-xs font-normal text-gray-400 ml-1">TRY</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {/* Search + Category row */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Search bar */}
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Oyun ara..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid rgba(99,102,241,0.6)";
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
            />
          </div>

          {/* Category filter pills */}
          {!searchResults && (
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    activeCategory === cat
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  style={
                    activeCategory === cat
                      ? { background: "linear-gradient(90deg, #6366f1, #4f46e5)", boxShadow: "0 0 12px rgba(99,102,241,0.35)" }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search results */}
        {searchResults && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-white">"{searchQuery}" için sonuçlar</h2>
              <span className="text-xs text-gray-600">{searchResults.length} oyun bulundu</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {searchResults.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>
            {searchResults.length === 0 && (
              <div className="py-16 text-center text-gray-600">
                <p className="text-4xl mb-3">🎮</p>
                <p className="text-sm">Oyun bulunamadı</p>
              </div>
            )}
          </section>
        )}

        {/* Featured section */}
        {!searchResults && featured.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-1 h-4 rounded-full inline-block" style={{ background: "linear-gradient(180deg, #818cf8, #6366f1)" }} />
                Öne Çıkanlar
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {featured.slice(0, 3).map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>
          </section>
        )}

        {/* Discounts section */}
        {!searchResults && discountedGames.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-1 h-4 rounded-full inline-block bg-green-500" />
                İndirimler
              </h2>
              <span className="text-xs text-gray-600">{discountedGames.length} oyun</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {discountedGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>
          </section>
        )}

        {/* All games */}
        {!searchResults && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-1 h-4 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.2)" }} />
                Tüm Oyunlar
              </h2>
              <span className="text-xs text-gray-600">{allGames.length} oyun</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {displayGames.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
