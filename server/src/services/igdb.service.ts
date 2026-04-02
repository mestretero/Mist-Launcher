import { prisma } from "../lib/prisma.js";

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID || "";
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function igdbQuery(endpoint: string, body: string, retries = 3): Promise<any[]> {
  const token = await getAccessToken();
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": IGDB_CLIENT_ID,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`IGDB ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (e: any) {
      if (attempt < retries - 1) {
        console.log(`  IGDB retry ${attempt + 1}/${retries}: ${e.message?.slice(0, 60)}`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  return [];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function igdbCoverUrl(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
}

function igdbScreenshotUrl(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${imageId}.jpg`;
}

function igdbArtworkUrl(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_1080p/${imageId}.jpg`;
}

// AAA / Known publishers — only games from these companies pass
const KNOWN_COMPANIES = new Set([
  // AAA Publishers
  "electronic arts", "ea", "ubisoft", "activision", "blizzard entertainment",
  "activision blizzard", "bethesda softworks", "bethesda game studios",
  "rockstar games", "take-two interactive", "2k games", "2k",
  "square enix", "capcom", "konami", "bandai namco entertainment", "bandai namco",
  "sega", "sony interactive entertainment", "playstation studios",
  "microsoft game studios", "xbox game studios", "343 industries",
  "nintendo", "warner bros. games", "wb games",
  "cd projekt red", "cd projekt", "valve", "valve corporation",
  "epic games", "riot games", "mihoyo", "hoyoverse",
  "fromsoft", "fromsoftware", "from software",
  "insomniac games", "naughty dog", "guerrilla games", "sucker punch productions",
  "santa monica studio", "bungie", "respawn entertainment",
  "bioware", "dice", "ea dice", "criterion games",
  "obsidian entertainment", "playground games", "turn 10 studios",
  "crystal dynamics", "eidos-montréal", "eidos montreal",
  "techland", "deep silver", "thq nordic", "koch media",
  "focus entertainment", "focus home interactive",
  "devolver digital", "annapurna interactive", "team17",
  // AA / Well-known studios
  "larian studios", "remedy entertainment", "supergiant games",
  "team cherry", "re-logic", "mojang studios", "mojang",
  "coffee stain studios", "iron gate studio", "klei entertainment",
  "red barrels", "bloober team", "frictional games",
  "id software", "machine games", "arkane studios", "arkane lyon", "arkane austin",
  "kojima productions", "platinum games", "platinumgames",
  "gearbox software", "gearbox entertainment",
  "netease games", "netease", "tencent", "tencent games",
  "krafton", "pubg corporation", "bluehole",
  "digital extremes", "grinding gear games",
  "paradox interactive", "paradox development studio",
  "firaxis games", "creative assembly", "relic entertainment",
  "amplitude studios", "colossal order",
  "warhorse studios", "11 bit studios", "asobo studio",
  "deck13", "dontnod entertainment", "don't nod",
  "hazelight studios", "moon studios", "ninja theory",
  "double fine productions", "rare", "rare ltd", "quantic dream",
  "supermassive games", "tango gameworks", "monolith soft", "4a games",
  "crytek", "game science",
  "avalanche studios", "io interactive",
  "gameloft", "netmarble", "smilegate", "pearl abyss",
  "s-game", "shift up", "nexon", "neowiz",
  "cygames", "atlus", "koei tecmo", "omega force",
  "level-5", "nippon ichi software", "falcom",
  "rebellion", "tripwire interactive", "coffee stain publishing",
  "raw fury", "505 games", "private division",
  "maximum entertainment", "plaion", "embracer group",
]);

function isKnownCompany(name: string): boolean {
  return KNOWN_COMPANIES.has(name.toLowerCase().trim());
}

// Filter out DLC/edition/bundle titles at sync time
const SYNC_TITLE_BLOCKLIST = [
  /\b(dlc|expansion|season pass|starter pack|booster pack|character pack|map pack|weapon pack|skin pack|item pack)\b/i,
  /\b(soundtrack|artbook|art book|ost|wallpaper|avatar|demo|playtest|beta|prologue)\b/i,
  /\b(upgrade|deluxe edition|ultimate edition|gold edition|premium edition|collector'?s edition|goty edition|complete edition|definitive edition|enhanced edition|remastered|anniversary edition|special edition|limited edition)\b/i,
  /: additional/i,
  / - .+ (pack|bundle|pass|kit|set)$/i,
];

function isBadTitle(title: string): boolean {
  return SYNC_TITLE_BLOCKLIST.some((p) => p.test(title));
}

const GENRE_MAP: Record<number, string> = {
  2: "Point-and-click", 4: "Fighting", 5: "Shooter", 7: "Music", 8: "Platform",
  9: "Puzzle", 10: "Racing", 11: "RTS", 12: "RPG", 13: "Simulator", 14: "Sport",
  15: "Strategy", 16: "TBS", 24: "Tactical", 25: "Hack and slash", 26: "Quiz",
  30: "Pinball", 31: "Adventure", 32: "Indie", 33: "Arcade", 34: "Visual Novel",
  35: "Card Game", 36: "MOBA",
};

interface IGDBGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  cover?: { image_id: string };
  artworks?: Array<{ image_id: string }>;
  screenshots?: Array<{ image_id: string }>;
  genres?: Array<{ id: number }>;
  involved_companies?: Array<{
    company: { name: string };
    publisher: boolean;
    developer: boolean;
  }>;
  first_release_date?: number;
  total_rating?: number;
  videos?: Array<{ video_id: string }>;
}

/**
 * Fetch popular/recent games from IGDB and insert into our DB.
 */
export async function syncGamesFromIGDB(options: {
  mode: "popular" | "new" | "top_rated" | "upcoming";
  limit?: number;
}) {
  const { mode, limit = 50 } = options;
  // Fetch more than needed since we filter by known company
  const fetchLimit = Math.min(limit * 3, 500);
  const now = Math.floor(Date.now() / 1000);

  // Platform 6 = PC (Windows)
  const PC = "platforms = (6)";
  const fields = "fields name, summary, storyline, cover.image_id, artworks.image_id, screenshots.image_id, genres.id, involved_companies.company.name, involved_companies.publisher, involved_companies.developer, first_release_date, total_rating, total_rating_count, videos.video_id;";

  let query: string;
  switch (mode) {
    case "popular":
      query = `${fields}
where cover != null & ${PC} & category = 0 & parent_game = null & total_rating > 60 & total_rating_count > 3 & first_release_date != null & first_release_date < ${now};
sort hypes desc;
limit ${fetchLimit};`;
      break;
    case "new":
      query = `${fields}
where cover != null & ${PC} & category = 0 & parent_game = null & first_release_date != null & first_release_date < ${now} & first_release_date > ${now - 365 * 86400};
sort first_release_date desc;
limit ${fetchLimit};`;
      break;
    case "top_rated":
      query = `${fields}
where cover != null & ${PC} & category = 0 & parent_game = null & total_rating > 80 & total_rating_count > 5;
sort total_rating desc;
limit ${fetchLimit};`;
      break;
    case "upcoming":
      query = `${fields}
where cover != null & ${PC} & category = 0 & parent_game = null & first_release_date > ${now} & hypes > 3;
sort hypes desc;
limit ${fetchLimit};`;
      break;
  }

  const games: IGDBGame[] = await igdbQuery("games", query);
  let added = 0;
  let skipped = 0;

  for (const game of games) {
    // Stop when we have enough
    if (added >= limit) break;

    // Filter: bad titles (DLC, editions, etc.)
    if (isBadTitle(game.name)) { skipped++; continue; }

    // Filter: only games from known companies
    const allCompanies = (game.involved_companies || []).map((c) => c.company?.name || "");
    const hasKnownCompany = allCompanies.some((name) => isKnownCompany(name));
    if (!hasKnownCompany) { skipped++; continue; }

    const slug = slugify(game.name);

    // Skip if already in DB
    const existing = await prisma.game.findUnique({ where: { slug } });
    if (existing) { skipped++; continue; }

    // Find or create publisher
    const publisherInfo = game.involved_companies?.find((c) => c.publisher);
    const developerInfo = game.involved_companies?.find((c) => c.developer);
    const companyName = publisherInfo?.company?.name || developerInfo?.company?.name || "Unknown";
    const companySlug = slugify(companyName);

    let publisher = await prisma.publisher.findUnique({ where: { slug: companySlug } });
    if (!publisher) {
      publisher = await prisma.publisher.create({
        data: {
          name: companyName,
          slug: companySlug,
          contactEmail: `contact@${companySlug}.com`,
        },
      });
    }

    // Build game data
    const coverUrl = game.cover ? igdbCoverUrl(game.cover.image_id) : "https://via.placeholder.com/264x374";
    // Use artwork for hero banner, fallback to screenshots
    const heroImage = game.artworks?.[0]
      ? igdbArtworkUrl(game.artworks[0].image_id)
      : game.screenshots?.[0]
        ? igdbScreenshotUrl(game.screenshots[0].image_id)
        : null;
    const screenshots = [
      ...(heroImage ? [heroImage] : []),
      ...(game.screenshots || []).slice(0, 5).map((s) => igdbScreenshotUrl(s.image_id)),
    ];
    const genres = (game.genres || []).map((g) => GENRE_MAP[g.id] || "Other").filter(Boolean);
    const trailerUrl = game.videos?.[0] ? `https://www.youtube.com/watch?v=${game.videos[0].video_id}` : null;
    const releaseDate = game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : new Date();
    const description = game.summary || game.storyline || game.name;
    const shortDesc = description.slice(0, 150) + (description.length > 150 ? "..." : "");

    try {
      await prisma.game.create({
        data: {
          title: game.name,
          slug,
          description,
          shortDescription: shortDesc,
          price: 0,
          coverImageUrl: coverUrl,
          screenshots: JSON.stringify(screenshots),
          trailerUrl,
          publisherId: publisher.id,
          releaseDate,
          categories: genres,
          status: releaseDate > new Date() ? "COMING_SOON" : "PUBLISHED",
        },
      });
      added++;
    } catch (e: any) {
      // Unique constraint or other error — skip
      skipped++;
    }
  }

  return { added, skipped, total: games.length };
}

/**
 * Fetch ALL PC main games from a specific company by IGDB company ID.
 * category=0 = main game only (no DLC/expansion/bundle/mod/episode/season/remake)
 * parent_game = null ensures no DLC slips through
 */
export async function syncByCompanyId(companyId: number, companyName: string, maxGames = 100) {
  const fields = "fields name, summary, storyline, cover.image_id, artworks.image_id, screenshots.image_id, genres.id, involved_companies.company.name, involved_companies.publisher, involved_companies.developer, first_release_date, total_rating, total_rating_count, videos.video_id;";
  const query = `${fields}
where cover != null & platforms = (6) & category = 0 & parent_game = null & involved_companies.company = ${companyId} & first_release_date != null;
sort first_release_date desc;
limit ${Math.min(maxGames, 500)};`;

  const games: IGDBGame[] = await igdbQuery("games", query);
  let added = 0;
  let skipped = 0;

  for (const game of games) {
    if (isBadTitle(game.name)) { skipped++; continue; }

    const slug = slugify(game.name);
    const existing = await prisma.game.findUnique({ where: { slug } });
    if (existing) { skipped++; continue; }

    const publisherInfo = game.involved_companies?.find((c) => c.publisher);
    const developerInfo = game.involved_companies?.find((c) => c.developer);
    const pubName = publisherInfo?.company?.name || developerInfo?.company?.name || companyName;
    const pubSlug = slugify(pubName);

    let publisher = await prisma.publisher.findUnique({ where: { slug: pubSlug } });
    if (!publisher) {
      publisher = await prisma.publisher.create({ data: { name: pubName, slug: pubSlug, contactEmail: `contact@${pubSlug}.com` } });
    }

    const coverUrl = game.cover ? igdbCoverUrl(game.cover.image_id) : "https://via.placeholder.com/264x374";
    const heroImage = game.artworks?.[0] ? igdbArtworkUrl(game.artworks[0].image_id) : game.screenshots?.[0] ? igdbScreenshotUrl(game.screenshots[0].image_id) : null;
    const screenshots = [...(heroImage ? [heroImage] : []), ...(game.screenshots || []).slice(0, 5).map((s) => igdbScreenshotUrl(s.image_id))];
    const genres = (game.genres || []).map((g) => GENRE_MAP[g.id] || "Other").filter(Boolean);
    const trailerUrl = game.videos?.[0] ? `https://www.youtube.com/watch?v=${game.videos[0].video_id}` : null;
    const releaseDate = game.first_release_date ? new Date(game.first_release_date * 1000) : new Date();
    const description = game.summary || game.storyline || game.name;
    const shortDesc = description.slice(0, 150) + (description.length > 150 ? "..." : "");

    try {
      await prisma.game.create({
        data: {
          title: game.name, slug, description, shortDescription: shortDesc, price: 0,
          coverImageUrl: coverUrl, screenshots: JSON.stringify(screenshots), trailerUrl,
          publisherId: publisher.id, releaseDate, categories: genres,
          status: releaseDate > new Date() ? "COMING_SOON" : "PUBLISHED",
        },
      });
      added++;
    } catch { skipped++; }
  }

  return { added, skipped, total: games.length, company: companyName };
}

/**
 * Search for a company ID on IGDB by name.
 */
export async function findCompanyId(name: string): Promise<{ id: number; name: string } | null> {
  try {
    // Try exact match first, then fuzzy
    let results = await igdbQuery("companies", `fields name; where name ~ "${name.replace(/"/g, "")}"*; limit 1;`);
    if (results.length === 0) {
      results = await igdbQuery("companies", `fields name; where name ~ *"${name.replace(/"/g, "")}"*; limit 1;`);
    }
    return results.length > 0 ? { id: results[0].id, name: results[0].name } : null;
  } catch (e: any) {
    console.error(`  [findCompanyId ERROR] ${name}: ${e.message?.slice(0, 80)}`);
    return null;
  }
}

/**
 * Bulk sync: find each known company on IGDB and fetch their PC games.
 */
export async function syncAllKnownCompanies(companiesPerBatch = 10) {
  // Major companies to prioritize
  const priorityCompanies = [
    "Rockstar Games", "CD Projekt Red", "FromSoftware", "Bethesda Game Studios",
    "Ubisoft", "Electronic Arts", "Capcom", "Square Enix", "Sega",
    "Valve", "Blizzard Entertainment", "Bungie", "Riot Games",
    "Naughty Dog", "Insomniac Games", "Sony Interactive Entertainment",
    "Bandai Namco Entertainment", "Konami", "Kojima Productions",
    "Larian Studios", "Remedy Entertainment", "Obsidian Entertainment",
    "BioWare", "DICE", "Respawn Entertainment", "id Software",
    "Arkane Studios", "MachineGames", "Techland", "Deep Silver",
    "IO Interactive", "Avalanche Studios", "Crystal Dynamics",
    "Playground Games", "Ninja Theory", "Rare", "Double Fine Productions",
    "Gearbox Software", "Crytek", "Game Science", "Supergiant Games",
    "Team Cherry", "Re-Logic", "Mojang Studios", "Paradox Interactive",
    "Firaxis Games", "Creative Assembly", "Asobo Studio",
    "Hazelight Studios", "Moon Studios", "Warhorse Studios",
    "Grinding Gear Games", "Digital Extremes", "Pearl Abyss",
    "Quantic Dream", "4A Games", "Focus Entertainment",
    "THQ Nordic", "Devolver Digital", "Annapurna Interactive",
    "505 Games", "Private Division", "11 bit studios",
  ];

  const results: Array<{ company: string; added: number; skipped: number }> = [];

  for (let i = 0; i < Math.min(priorityCompanies.length, companiesPerBatch); i++) {
    const compName: string = priorityCompanies[i]!;
    try {
      const company = await findCompanyId(compName);
      if (!company) { console.log(`  [SKIP] ${compName}: company not found on IGDB`); results.push({ company: compName, added: 0, skipped: 0 }); continue; }
      const r = await syncByCompanyId(company.id, company.name, 50);
      results.push({ company: compName, added: r.added, skipped: r.skipped });
      // Longer delay to avoid IGDB rate limiting (4 requests per second)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e: any) {
      console.error(`  [ERROR] ${compName}: ${e.message?.slice(0, 100)}`);
      results.push({ company: compName, added: 0, skipped: 0 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const totalAdded = results.reduce((s, r) => s + r.added, 0);
  return { results, totalAdded };
}

/**
 * Search IGDB for a specific game (for user suggestions).
 */
export async function searchGamesOnIGDB(searchQuery: string) {
  const query = `fields name, summary, cover.image_id, involved_companies.company.name, involved_companies.publisher, first_release_date, total_rating, platforms.id;
search "${searchQuery.replace(/"/g, "")}";
where cover != null & platforms = (6) & category = 0 & parent_game = null;
limit 10;`;

  const games: IGDBGame[] = await igdbQuery("games", query);
  return games.map((g) => ({
    igdbId: g.id,
    name: g.name,
    coverUrl: g.cover ? igdbCoverUrl(g.cover.image_id) : null,
    rating: g.total_rating ? Math.round(g.total_rating) : null,
    releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    publisher: g.involved_companies?.find((c) => c.publisher)?.company?.name || g.involved_companies?.[0]?.company?.name || "Unknown",
  }));
}
