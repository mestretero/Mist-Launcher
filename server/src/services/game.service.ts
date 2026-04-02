import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

// DLC / expansion / edition indicators in titles
const DLC_PATTERNS = [
  /\b(dlc|expansion|season pass|starter pack|booster pack|character pack|map pack|weapon pack|skin pack|costume pack|item pack)\b/i,
  /\b(soundtrack|artbook|art book|ost|wallpaper|avatar|demo)\b/i,
  /\b(upgrade|deluxe edition|ultimate edition|gold edition|premium edition|collector'?s edition|goty edition|complete edition|definitive edition|enhanced edition|remastered|anniversary edition|special edition|limited edition)\b/i,
  /: additional/i,
  / - .+ (pack|bundle|pass|kit|set)$/i,
  /\bDLC\d/i,
  /\bbeta\b/i,
  /\bplaytest\b/i,
  /\bprologue\b/i,
];

function isDLC(title: string): boolean {
  return DLC_PATTERNS.some((p) => p.test(title));
}

export async function listGames(page: number, limit: number, category?: string) {
  const where: any = { status: "PUBLISHED" };
  if (category && category !== "Tümü") {
    where.categories = { has: category };
  }
  // Exclude DLC-parented games
  where.parentGameId = null;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      include: { publisher: { select: { name: true, slug: true } } },
      orderBy: { releaseDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.game.count({ where }),
  ]);

  // Filter out DLC-like titles that slipped through
  const filtered = games.filter((g) => !isDLC(g.title));
  return { games: filtered, total, page };
}

export async function getGameBySlug(slug: string) {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { publisher: { select: { name: true, slug: true } } },
  });
  if (!game || game.status !== "PUBLISHED") throw notFound("Game not found");
  return game;
}

export async function getFeaturedGames() {
  const games = await prisma.game.findMany({
    where: { status: "PUBLISHED", parentGameId: null },
    include: { publisher: { select: { name: true, slug: true } } },
    orderBy: { releaseDate: "desc" },
    take: 20,
  });
  // Filter DLC titles, return top 6
  return games.filter((g) => !isDLC(g.title)).slice(0, 6);
}

export async function getGameDLCs(slug: string) {
  const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
  return prisma.game.findMany({
    where: { parentGameId: game.id, status: "PUBLISHED" },
    include: { publisher: true },
  });
}

export async function searchGames(query: string) {
  const games = await prisma.game.findMany({
    where: {
      status: "PUBLISHED",
      parentGameId: null,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { shortDescription: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { publisher: { select: { name: true, slug: true } } },
    take: 20,
  });
  return { games: games.filter((g) => !isDLC(g.title)), total: games.length };
}

/**
 * Get personalized recommendations based on user's library genres.
 */
export async function getRecommendations(userId: string) {
  // === Step 1: Build user profile from store library + local games ===
  const libraryItems = await prisma.libraryItem.findMany({
    where: { userId },
    include: { game: { select: { categories: true, id: true, publisherId: true, title: true } } },
  });

  const ownedGameIds = new Set(libraryItems.map((li) => li.game.id));
  const genreCounts: Record<string, number> = {};
  const publisherCounts: Record<string, number> = {};
  const ownedTitles = new Set<string>();
  const ownedSeriesKeys = new Set<string>();

  // Helper: extract series key from title (e.g. "Resident Evil 3" → "resident evil")
  function seriesKey(title: string): string {
    return title.toLowerCase()
      .replace(/[®™©:]/g, "")
      .replace(/\d+/g, "")
      .replace(/\b(the|of|and|in|on|at|to|for|a|an)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  for (const li of libraryItems) {
    for (const cat of li.game.categories) genreCounts[cat] = (genreCounts[cat] || 0) + 1;
    publisherCounts[li.game.publisherId] = (publisherCounts[li.game.publisherId] || 0) + 1;
    ownedTitles.add(li.game.title.toLowerCase());
    ownedSeriesKeys.add(seriesKey(li.game.title));
  }

  // Also check local games (ProfileGameCache) — batch query instead of N+1
  const localGames = await prisma.profileGameCache.findMany({
    where: { userId, deletedAt: null },
    select: { title: true },
  });
  const searchTerms = localGames.map((g) => g.title.split(/[:\-–]/)[0]!.trim()).filter(Boolean);
  for (const local of localGames) {
    ownedTitles.add(local.title.toLowerCase());
    ownedSeriesKeys.add(seriesKey(local.title));
  }

  if (searchTerms.length > 0) {
    const matchedGames = await prisma.game.findMany({
      where: { OR: searchTerms.slice(0, 50).map((t) => ({ title: { contains: t, mode: "insensitive" as const } })) },
      select: { categories: true, id: true, publisherId: true },
    });
    for (const dbGame of matchedGames) {
      ownedGameIds.add(dbGame.id);
      for (const cat of dbGame.categories) genreCounts[cat] = (genreCounts[cat] || 0) + 1;
      publisherCounts[dbGame.publisherId] = (publisherCounts[dbGame.publisherId] || 0) + 1;
    }
  }

  // === Step 2: Sort genres and publishers by weight ===
  const topGenres = Object.entries(genreCounts)
    .filter(([g]) => g !== "Action") // Action is too generic, deprioritize
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);
  // Always include Action if user has it (but don't let it dominate)
  if (genreCounts["Action"] && !topGenres.includes("Action")) topGenres.push("Action");

  const topPublisherIds = Object.entries(publisherCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  if (topGenres.length === 0 && topPublisherIds.length === 0) {
    // No data — return diverse mix
    const games = await prisma.game.findMany({
      where: { status: "PUBLISHED", parentGameId: null },
      include: { publisher: { select: { name: true, slug: true } } },
      take: 50,
    });
    return games.filter((g) => !isDLC(g.title)).sort(() => Math.random() - 0.5).slice(0, 10);
  }

  // === Step 3: Fetch candidates — genre match OR same publisher ===
  const candidates = await prisma.game.findMany({
    where: {
      status: "PUBLISHED",
      parentGameId: null,
      id: { notIn: [...ownedGameIds] },
      OR: [
        { categories: { hasSome: topGenres } },
        { publisherId: { in: topPublisherIds } },
      ],
    },
    include: { publisher: { select: { name: true, slug: true, id: true } } },
    take: 200,
  });

  // === Step 4: Score each candidate ===
  const scored = candidates
    .filter((g) => !isDLC(g.title))
    .map((game) => {
      let score = 0;

      // Genre match score (weighted by user's genre frequency)
      for (const cat of game.categories) {
        if (genreCounts[cat]) score += genreCounts[cat] * 10;
      }

      // Same publisher bonus (big boost — if you like Capcom, you'll like more Capcom)
      if (publisherCounts[game.publisherId]) {
        score += (publisherCounts[game.publisherId] || 0) * 25;
      }

      // Same series bonus (huge boost — RE3 owned → RE4, RE Village highly recommended)
      const gameSeriesKey = seriesKey(game.title);
      for (const ownedKey of ownedSeriesKeys) {
        if (gameSeriesKey.includes(ownedKey) || ownedKey.includes(gameSeriesKey)) {
          if (gameSeriesKey.length > 3 && ownedKey.length > 3) {
            score += 50; // Strong series match
            break;
          }
        }
      }

      // Small freshness bonus for newer games
      const age = (Date.now() - new Date(game.releaseDate).getTime()) / (365 * 86400000);
      if (age < 2) score += 5;
      if (age < 1) score += 5;

      return { game, score };
    });

  // === Step 5: Sort by score, pick top 10 ===
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map((s) => s.game);
}
