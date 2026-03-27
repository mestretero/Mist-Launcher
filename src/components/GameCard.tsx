import { useTranslation } from "react-i18next";
import type { Game } from "../lib/types";

interface GameCardProps {
  game: Game;
  onClick: () => void;
  variant?: "default" | "wide";
}

function deriveTagKey(game: Game): string {
  const title = game.title.toLowerCase();
  if (title.includes("war") || title.includes("combat") || title.includes("battle") || title.includes("strike")) return "store.categories.fps";
  if (title.includes("quest") || title.includes("rpg") || title.includes("legend") || title.includes("dragon") || title.includes("shadow")) return "store.categories.rpg";
  if (title.includes("race") || title.includes("drive") || title.includes("car") || title.includes("speed")) return "store.categories.racing";
  if (title.includes("sport") || title.includes("football") || title.includes("basket")) return "store.categories.sports";
  if (title.includes("sim") || title.includes("city") || title.includes("build") || title.includes("fortress")) return "store.categories.strategy";
  if (title.includes("horror") || title.includes("dark") || title.includes("dead") || title.includes("zombie")) return "store.categories.horror";
  if (title.includes("pixel") || title.includes("retro")) return "store.categories.indie";
  if (title.includes("ocean") || title.includes("explore") || title.includes("galactic")) return "store.categories.adventure";
  if (title.includes("efsane") || title.includes("anadolu")) return "store.categories.action";
  return "store.categories.adventure";
}

function isNewRelease(releaseDate: string): boolean {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return release >= sixMonthsAgo;
}

export function GameCard({ game, onClick, variant = "default" }: GameCardProps) {
  const { t } = useTranslation();
  const price = parseFloat(game.price);
  const discountedPrice =
    game.discountPercent > 0 ? price * (1 - game.discountPercent / 100) : price;
  const tag = t(deriveTagKey(game));
  const isNew = isNewRelease(game.releaseDate);

  if (variant === "wide") {
    return (
      <div
        onClick={onClick}
        className="relative rounded overflow-hidden cursor-pointer group bg-brand-900 border border-brand-800 transition-colors hover:border-brand-600"
      >
        <div className="flex">
          {/* Left image */}
          <div className="relative w-[320px] flex-shrink-0 overflow-hidden bg-brand-950">
            <img
              src={game.coverImageUrl}
              alt={game.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ minHeight: "180px", filter: "brightness(0.8)" }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-900" />
          </div>

          {/* Right content */}
          <div className="flex-1 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-800 text-brand-300">
                {tag}
              </span>
              {isNew && (
                <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-700 text-brand-100 border border-brand-600">
                  {t("gameCard.new")}
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-brand-100 mb-1">{game.title}</h3>
            <p className="text-sm font-medium text-brand-500 mb-3 uppercase tracking-wider">{game.publisher.name}</p>
            <p className="text-sm text-brand-400 line-clamp-2 mb-6 leading-relaxed">
              {game.shortDescription || game.description?.slice(0, 120)}
            </p>

            <div className="flex items-center gap-4 mt-auto">
              {game.discountPercent > 0 && (
                <span className="text-sm font-bold px-2 py-1 rounded bg-brand-200 text-brand-950">
                  -{game.discountPercent}%
                </span>
              )}
              {game.discountPercent > 0 && (
                <span className="text-sm font-medium text-brand-600 line-through">
                  {price.toFixed(0)} TL
                </span>
              )}
              <span className="text-xl font-bold text-brand-100">
                {discountedPrice.toFixed(0)} TL
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="rounded overflow-hidden cursor-pointer group relative bg-brand-900 border border-brand-800 transition-all hover:-translate-y-1 hover:border-brand-600 hover:shadow-lg hover:shadow-black/20"
    >
      {/* Cover image */}
      <div className="relative overflow-hidden bg-brand-950">
        <img
          src={game.coverImageUrl}
          alt={game.title}
          className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ filter: "brightness(0.85)" }}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-transparent to-transparent opacity-80" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
          {isNew && (
            <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-950/80 text-brand-100 backdrop-blur border border-brand-800">
              {t("gameCard.new")}
            </span>
          )}
        </div>

        {/* Discount Badge Right */}
        {game.discountPercent > 0 && (
          <div className="absolute top-3 right-3">
             <span className="text-xs font-bold px-2 py-1 rounded bg-brand-200 text-brand-950 shadow-sm">
              -{game.discountPercent}%
            </span>
          </div>
        )}

        {/* Tag bottom-left */}
        <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-950/80 text-brand-300 backdrop-blur">
          {tag}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-bold text-base text-brand-100 truncate mb-1">{game.title}</h3>
        <p className="text-xs font-medium text-brand-500 uppercase tracking-widest truncate">{game.publisher.name}</p>

        {/* Price row */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-brand-800 pt-3">
          {game.discountPercent > 0 && (
            <span className="text-xs font-medium text-brand-600 line-through">
              {price.toFixed(0)} TL
            </span>
          )}
          <span className="text-base font-bold text-brand-100">
            {discountedPrice.toFixed(0)} TL
          </span>
        </div>
      </div>
    </div>
  );
}
