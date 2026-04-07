import { FastifyInstance } from "fastify";
import { gameListSchema, searchSchema } from "../schemas/game.schema.js";
import * as gameService from "../services/game.service.js";
import { searchAndAutoAdd, searchSteamGames, getSteamAchievements } from "../services/steam.service.js";
import { lookupGameMetadata } from "../services/igdb.service.js";
import { prisma } from "../lib/prisma.js";

export default async function gameRoutes(app: FastifyInstance) {
  app.get("/games", async (request, reply) => {
    const { page, limit, category } = gameListSchema.parse(request.query);
    const result = await gameService.listGames(page, limit, category);
    return reply.send({ data: result.games, meta: { total: result.total, page: result.page } });
  });

  app.get("/games/featured", async (request, reply) => {
    const games = await gameService.getFeaturedGames();
    return reply.send({ data: games });
  });

  // Must be before /games/:slug to avoid "recommended" matching as slug
  app.get("/games/recommended", { preHandler: [app.authenticate] }, async (request, reply) => {
    const games = await gameService.getRecommendations(request.user!.userId);
    return reply.send({ data: games });
  });

  // Metadata lookup for Tauri local game scanner (public — no auth, no DB write)
  app.get("/games/metadata-lookup", async (request, reply) => {
    const { title } = request.query as { title?: string };
    if (!title || title.trim().length < 2) {
      return reply.send({ data: null });
    }
    const meta = await lookupGameMetadata(title);
    return reply.send({ data: meta });
  });

  // Auto-match: search Steam by game name, auto-add to DB if found
  app.get("/games/auto-match", async (request, reply) => {
    const { name } = request.query as { name: string };
    if (!name || name.length < 2) return reply.send({ data: null });
    const result = await searchAndAutoAdd(name);
    return reply.send({ data: result });
  });

  // Search Steam Store (for browsing, not auto-add)
  app.get("/games/steam-search", async (request, reply) => {
    const { q } = request.query as { q: string };
    if (!q || q.length < 2) return reply.send({ data: [] });
    const results = await searchSteamGames(q);
    return reply.send({ data: results });
  });

  // Submit game request (authenticated users)
  app.post("/games/request", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { gameTitle, reason } = request.body as { gameTitle: string; reason: string };
    if (!gameTitle || gameTitle.length < 2) return reply.code(400).send({ error: "Game title required" });
    const existing = await prisma.gameRequest.findFirst({
      where: { userId: request.user!.userId, gameTitle: { equals: gameTitle, mode: "insensitive" } },
    });
    if (existing) return reply.code(409).send({ error: "You already submitted a request for this game" });
    const req = await prisma.gameRequest.create({
      data: { userId: request.user!.userId, gameTitle, reason: reason || "" },
    });
    return reply.code(201).send({ data: req });
  });

  // Shared cache for Steam lookups (descriptions + achievements)
  const MAX_CACHE_SIZE = 500;
  const descCache = new Map<string, { data: any; expiry: number }>();
  const DESC_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

  function cacheSet(key: string, data: any) {
    // Evict oldest entry if cache is full
    if (descCache.size >= MAX_CACHE_SIZE && !descCache.has(key)) {
      const oldest = descCache.keys().next().value;
      if (oldest) descCache.delete(oldest);
    }
    descCache.set(key, { data, expiry: Date.now() + DESC_CACHE_TTL });
  }

  // Cleanup expired cache entries every hour + enforce size limit
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of descCache) {
      if (val.expiry < now) descCache.delete(key);
    }
    // If still over limit after expiry cleanup, evict oldest entries
    if (descCache.size > MAX_CACHE_SIZE) {
      const entries = [...descCache.entries()].sort((a, b) => a[1].expiry - b[1].expiry);
      const toRemove = entries.slice(0, descCache.size - MAX_CACHE_SIZE);
      for (const [key] of toRemove) descCache.delete(key);
    }
  }, 60 * 60 * 1000);

  // Steam achievements for any game by title (no DB required, used by local/scanned games)
  app.get("/games/steam-achievements", async (request, reply) => {
    const { title, lang } = request.query as { title?: string; lang?: string };
    if (!title) return reply.code(400).send({ error: "title required" });

    const steamLang: Record<string, string> = { tr: "turkish", en: "english", es: "spanish", de: "german" };
    const resolvedLang = steamLang[lang || ""] || lang || "turkish";

    const cacheKey = `ach:${title.toLowerCase()}:${resolvedLang}`;
    const cached = descCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return reply.send({ data: cached.data });
    }

    const result = await getSteamAchievements(title, resolvedLang);
    if (result) {
      cacheSet(cacheKey, result);
    }
    return reply.send({ data: result });
  });

  // Localized description by game title (for local/scanned games not in our store)
  app.get("/games/localized-description", async (request, reply) => {
    const { title, lang = "english" } = request.query as { title?: string; lang?: string };
    if (!title) return reply.code(400).send({ error: "title required" });

    const cacheKey = `local:${title.toLowerCase()}:${lang}`;
    const cached = descCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return reply.send({ data: cached.data });
    }

    try {
      const searchRes = await fetch(
        `https://store.steampowered.com/api/storesearch?term=${encodeURIComponent(title)}&l=${lang}&cc=US`,
        { signal: AbortSignal.timeout(8000) }
      );
      const searchJson = await searchRes.json() as any;
      const items = searchJson?.items || [];
      const match = items.find((i: any) => i.name.toLowerCase() === title.toLowerCase()) || items[0];

      if (match) {
        const res = await fetch(
          `https://store.steampowered.com/api/appdetails?appids=${match.id}&l=${lang}`,
          { signal: AbortSignal.timeout(8000) }
        );
        const json = await res.json() as any;
        const detail = json[String(match.id)]?.data;
        if (detail?.short_description) {
          const result = { description: detail.short_description };
          cacheSet(cacheKey, result);
          return reply.send({ data: result });
        }
      }
    } catch {}

    const empty = { description: null };
    cacheSet(cacheKey, empty);
    return reply.send({ data: empty });
  });

  app.get("/games/search", async (request, reply) => {
    const { q } = searchSchema.parse(request.query);
    const result = await gameService.searchGames(q);
    return reply.send({ data: result.games, meta: { total: result.total } });
  });

  app.get("/games/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const game = await gameService.getGameBySlug(slug);
    return reply.send({ data: game });
  });

  // Localized description from Steam by slug (for store games)
  app.get("/games/:slug/description", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { lang = "english" } = request.query as { lang?: string };
    const cacheKey = `${slug}:${lang}`;

    // Check cache first
    const cached = descCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return reply.send({ data: cached.data });
    }

    const game = await gameService.getGameBySlug(slug);
    const appIdMatch = game.coverImageUrl?.match(/\/apps\/(\d+)\//);
    if (!appIdMatch) {
      const fallback = { description: game.description };
      cacheSet(cacheKey, fallback);
      return reply.send({ data: fallback });
    }

    const appId = appIdMatch[1];
    try {
      const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=${lang}`, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();
      const detail = json[appId!]?.data;
      if (detail?.detailed_description) {
        const result = { description: detail.detailed_description, shortDescription: detail.short_description };
        cacheSet(cacheKey, result);
        return reply.send({ data: result });
      }
    } catch {}

    const fallback = { description: game.description };
    cacheSet(cacheKey, fallback);
    return reply.send({ data: fallback });
  });

  app.get("/games/:slug/dlcs", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const dlcs = await gameService.getGameDLCs(slug);
    return reply.send({ data: dlcs });
  });
}
