import type { Game } from "../lib/types";

interface GameCardProps {
  game: Game;
  onClick: () => void;
}

export function GameCard({ game, onClick }: GameCardProps) {
  const price = parseFloat(game.price);
  const discountedPrice = game.discountPercent > 0
    ? price * (1 - game.discountPercent / 100)
    : price;

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-indigo-500 transition-colors cursor-pointer group"
    >
      <img
        src={game.coverImageUrl} alt={game.title}
        className="w-full h-48 object-cover group-hover:opacity-90 transition-opacity"
      />
      <div className="p-3">
        <h3 className="font-medium text-sm text-white truncate">{game.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{game.publisher.name}</p>
        <div className="mt-2 flex items-center gap-2">
          {game.discountPercent > 0 && (
            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
              -%{game.discountPercent}
            </span>
          )}
          {game.discountPercent > 0 && (
            <span className="text-xs text-gray-500 line-through">₺{price.toFixed(2)}</span>
          )}
          <span className="text-sm font-bold text-white">₺{discountedPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
