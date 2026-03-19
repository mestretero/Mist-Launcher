import type { Game } from "../lib/types";

interface GameCardProps {
  game: Game;
  onClick: () => void;
}

// Genre tags derived from publisher name or title keywords — purely cosmetic
function deriveTag(game: Game): string {
  const title = game.title.toLowerCase();
  if (title.includes("war") || title.includes("combat") || title.includes("battle") || title.includes("shoot")) return "Aksiyon";
  if (title.includes("quest") || title.includes("rpg") || title.includes("legend") || title.includes("dragon")) return "RPG";
  if (title.includes("race") || title.includes("drive") || title.includes("car") || title.includes("speed")) return "Yarış";
  if (title.includes("sport") || title.includes("football") || title.includes("basket")) return "Spor";
  if (title.includes("sim") || title.includes("city") || title.includes("build") || title.includes("farm")) return "Simülasyon";
  if (title.includes("horror") || title.includes("dark") || title.includes("dead") || title.includes("zombie")) return "Korku";
  if (title.includes("puzzle") || title.includes("block") || title.includes("tetris")) return "Bulmaca";
  if (title.includes("adventure") || title.includes("explore")) return "Macera";
  return "Strateji";
}

function isNewRelease(releaseDate: string): boolean {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return release >= sixMonthsAgo;
}

export function GameCard({ game, onClick }: GameCardProps) {
  const price = parseFloat(game.price);
  const discountedPrice =
    game.discountPercent > 0 ? price * (1 - game.discountPercent / 100) : price;
  const tag = deriveTag(game);
  const isNew = isNewRelease(game.releaseDate);

  return (
    <div
      onClick={onClick}
      className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800/80 cursor-pointer group transition-all duration-200 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-900/20"
      style={{ transform: "translateZ(0)" }}
    >
      {/* Cover image with placeholder bg */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
        <img
          src={game.coverImageUrl}
          alt={game.title}
          className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {isNew && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white leading-none"
              style={{ background: "linear-gradient(90deg, #6366f1, #4f46e5)" }}
            >
              Yeni
            </span>
          )}
          {game.discountPercent > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white leading-none uppercase tracking-wide">
              -{game.discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-white truncate leading-snug">{game.title}</h3>

        <div className="flex items-center gap-2 mt-1">
          <p className="text-[11px] text-gray-600 truncate flex-1">{game.publisher.name}</p>
          <span className="text-[10px] text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
            {tag}
          </span>
        </div>

        {/* Price row */}
        <div className="mt-2.5 flex items-center gap-2">
          {game.discountPercent > 0 && (
            <span className="text-[11px] text-gray-600 line-through">
              ₺{price.toFixed(2)}
            </span>
          )}
          <span
            className={`text-sm font-bold ${
              game.discountPercent > 0 ? "text-green-400" : "text-white"
            }`}
          >
            ₺{discountedPrice.toFixed(2)}
            <span className="text-[10px] font-normal text-gray-600 ml-0.5">TRY</span>
          </span>
        </div>
      </div>
    </div>
  );
}
