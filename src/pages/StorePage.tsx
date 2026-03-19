import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { GameCard } from "../components/GameCard";
import type { Game } from "../lib/types";

interface StorePageProps {
  onGameClick: (slug: string) => void;
}

export function StorePage({ onGameClick }: StorePageProps) {
  const [featured, setFeatured] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[] | null>(null);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <input
          type="text" placeholder="Oyun ara..."
          value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {!searchResults && featured.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">Öne Çıkanlar</h2>
          <div className="grid grid-cols-3 gap-4">
            {featured.slice(0, 3).map((game) => (
              <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-4">
          {searchResults ? `"${searchQuery}" için sonuçlar` : "Tüm Oyunlar"}
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {displayGames.map((game) => (
            <GameCard key={game.id} game={game} onClick={() => onGameClick(game.slug)} />
          ))}
        </div>
      </section>
    </div>
  );
}
