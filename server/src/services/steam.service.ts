import { prisma } from "../lib/prisma.js";

const STEAM_KEY = process.env.STEAM_API_KEY || "";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

// DLC / edition filter
const BAD_TITLE = [
  /\b(dlc|expansion|season pass|soundtrack|artbook|art book|ost|demo|playtest|beta|prologue)\b/i,
  /\b(deluxe edition|ultimate edition|gold edition|premium edition|collector'?s edition|goty edition|complete edition|definitive edition|enhanced edition|special edition|limited edition)\b/i,
  / - .+ (pack|bundle|pass|kit|set)$/i,
  /\bDLC\b/i,
  /\bupgrade\b/i,
];

function isBadTitle(title: string): boolean {
  return BAD_TITLE.some((p) => p.test(title));
}

interface SteamAppDetail {
  name: string;
  type: string;
  steam_appid: number;
  short_description: string;
  detailed_description: string;
  header_image: string;
  screenshots?: Array<{ path_full: string }>;
  genres?: Array<{ description: string }>;
  developers?: string[];
  publishers?: string[];
  release_date?: { date: string };
  movies?: Array<{ webm?: { max?: string } }>;
}

async function fetchAppDetails(appId: number): Promise<SteamAppDetail | null> {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Cookie: "birthtime=0; wants_mature_content=1; lastagecheckage=1-0-1990; mature_content=1",
      },
    });
    const data = await res.json();
    const entry = data[String(appId)];
    if (!entry?.success || !entry?.data) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function addGameFromSteam(detail: SteamAppDetail): Promise<boolean> {
  // Skip non-games and DLC
  if (detail.type !== "game") return false;
  if (isBadTitle(detail.name)) return false;

  const slug = slugify(detail.name);
  const existing = await prisma.game.findUnique({ where: { slug } });
  if (existing) return false; // Already in DB — not an error, just skip

  // Publisher
  const pubName = detail.publishers?.[0] || detail.developers?.[0] || "Unknown";
  const pubSlug = slugify(pubName);
  let publisher = await prisma.publisher.findUnique({ where: { slug: pubSlug } });
  if (!publisher) {
    publisher = await prisma.publisher.create({
      data: { name: pubName, slug: pubSlug, contactEmail: `contact@${pubSlug}.com` },
    });
  }

  const screenshots = (detail.screenshots || []).slice(0, 6).map((s) => s.path_full);
  const genres = (detail.genres || []).map((g) => g.description);
  const trailerUrl = detail.movies?.[0]?.webm?.max || null;
  const description = detail.short_description || detail.name;
  // Parse Steam date format ("15 Aug, 2012" or "Aug 15, 2012" or "2012")
  let validDate = new Date(2000, 0, 1); // fallback: old date so it doesn't appear in "new releases"
  if (detail.release_date?.date) {
    const raw = detail.release_date.date;
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      validDate = parsed;
    } else {
      // Try manual parse: "15 Aug, 2012" → "Aug 15, 2012"
      const m = raw.match(/(\d{1,2})\s+(\w+),?\s+(\d{4})/);
      if (m) {
        const retry = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
        if (!isNaN(retry.getTime())) validDate = retry;
      } else {
        // Just a year: "2012"
        const yearMatch = raw.match(/(\d{4})/);
        if (yearMatch) validDate = new Date(parseInt(yearMatch[1]!), 0, 1);
      }
    }
  }

  try {
    await prisma.game.create({
      data: {
        title: detail.name,
        slug,
        description: detail.detailed_description?.slice(0, 5000) || description,
        shortDescription: description.slice(0, 150),
        price: 0,
        coverImageUrl: detail.header_image,
        screenshots: JSON.stringify(screenshots),
        trailerUrl,
        publisherId: publisher.id,
        releaseDate: validDate,
        categories: genres,
        status: "PUBLISHED",
        steamAppId: detail.steam_appid,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch achievement schema for a Steam game and upsert into DB.
 */
export async function syncAchievementsForGame(steamAppId: number, gameId: string) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_KEY}&appid=${steamAppId}&l=turkish`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    const achs: Array<{ name: string; displayName: string; description?: string; icon?: string; icongray?: string }> =
      data.game?.availableGameStats?.achievements || [];

    let added = 0;
    for (const ach of achs) {
      const existing = await prisma.achievement.findFirst({ where: { gameId, apiName: ach.name } });
      if (existing) continue;
      await prisma.achievement.create({
        data: {
          gameId,
          apiName: ach.name,
          name: ach.displayName || ach.name,
          description: ach.description || "",
          iconUrl: ach.icon || null,
        },
      });
      added++;
    }
    return { added, total: achs.length };
  } catch {
    return { added: 0, total: 0 };
  }
}

/**
 * Fetch most played games on Steam and add to DB.
 */
export async function syncMostPlayed(limit = 100) {
  const res = await fetch(
    `https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/?key=${STEAM_KEY}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const data = await res.json();
  const ranks: Array<{ appid: number; peak_in_game: number }> = data.response?.ranks || [];

  let added = 0;
  let skipped = 0;

  for (const rank of ranks.slice(0, limit)) {
    const detail = await fetchAppDetails(rank.appid);
    if (!detail) { skipped++; continue; }
    const ok = await addGameFromSteam(detail);
    if (ok) { added++; console.log(`  ✓ ${detail.name}`); }
    else skipped++;
    // Steam rate limit: ~200 requests per 5 minutes
    await new Promise((r) => setTimeout(r, 300));
  }

  return { added, skipped, total: ranks.length };
}

/**
 * Fetch top sellers from Steam Store.
 */
export async function syncTopSellers() {
  const res = await fetch("https://store.steampowered.com/api/featuredcategories/", {
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();

  let added = 0;
  let skipped = 0;

  // Top sellers
  const topSellers: Array<{ id: number; name: string }> = data.top_sellers?.items || [];
  // New releases
  const newReleases: Array<{ id: number; name: string }> = data.new_releases?.items || [];
  // Coming soon
  const comingSoon: Array<{ id: number; name: string }> = data.coming_soon?.items || [];

  const allItems = [...topSellers, ...newReleases, ...comingSoon];
  const seen = new Set<number>();

  for (const item of allItems) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const detail = await fetchAppDetails(item.id);
    if (!detail) { skipped++; continue; }
    const ok = await addGameFromSteam(detail);
    if (ok) { added++; console.log(`  ✓ ${detail.name}`); }
    else skipped++;
    await new Promise((r) => setTimeout(r, 300));
  }

  return { added, skipped };
}

/**
 * Fetch games by a list of known appids (AAA titles).
 */
export async function syncByAppIds(appIds: number[]) {
  let added = 0;
  let skipped = 0;

  for (const appId of appIds) {
    const detail = await fetchAppDetails(appId);
    if (!detail) { skipped++; continue; }
    const ok = await addGameFromSteam(detail);
    if (ok) { added++; console.log(`  ✓ ${detail.name}`); }
    else skipped++;
    await new Promise((r) => setTimeout(r, 300));
  }

  return { added, skipped };
}

// Curated list of AAA/AA/well-known game AppIDs on Steam — ONLY quality titles
export const AAA_APPIDS = [
  // === ROCKSTAR ===
  271590,  // GTA V
  1174180, // Red Dead Redemption 2
  // === CD PROJEKT RED ===
  1091500, // Cyberpunk 2077
  292030,  // The Witcher 3: Wild Hunt
  // === FROMSOFTWARE ===
  1245620, // ELDEN RING
  374320,  // Dark Souls III
  814380,  // Sekiro: Shadows Die Twice
  570940,  // Dark Souls: Remastered
  // === BETHESDA ===
  489830,  // Skyrim Special Edition
  611670,  // Starfield
  377160,  // Fallout 4
  22380,   // Fallout: New Vegas
  22300,   // Fallout 3
  // === VALVE ===
  620,     // Portal 2
  550,     // Left 4 Dead 2
  4000,    // Garry's Mod
  // === CAPCOM ===
  883710,  // Resident Evil Village
  2050650, // Resident Evil 4 (Remake)
  418370,  // Resident Evil 7 Biohazard
  1196590, // Devil May Cry 5
  1446780, // Monster Hunter Rise
  1817070, // Monster Hunter Wilds
  // === UBISOFT ===
  2225070, // Star Wars Outlaws
  // 359550, // Rainbow Six Siege (multiplayer-only, removed)
  552520,  // Far Cry 5
  2369390, // Far Cry 6
  // === EA ===
  1237970, // Titanfall 2
  1238810, // Battlefield V
  1238840, // Battlefield 1
  1517290, // Battlefield 2042
  // === SQUARE ENIX ===
  1382330, // Persona 5 Royal
  // === BANDAI NAMCO ===
  1888160, // Armored Core VI
  1794680, // Tekken 8
  // === KOJIMA ===
  1338770, // Death Stranding Director's Cut
  // === LARIAN ===
  1086940, // Baldur's Gate 3
  // === REMEDY ===
  870780,  // Control
  // === TECHLAND ===
  534380,  // Dying Light 2
  239140,  // Dying Light
  // === IO INTERACTIVE ===
  1659040, // Hitman World of Assassination
  // === CRYTEK ===
  594650,  // Hunt: Showdown
  // === GAME SCIENCE ===
  2358720, // Black Myth: Wukong
  // === OBSIDIAN ===
  578650,  // The Outer Worlds
  // === GEARBOX ===
  397540,  // Borderlands 3
  // === CRYSTAL DYNAMICS ===
  750920,  // Shadow of the Tomb Raider
  // === SONY / PLAYSTATION ===
  1888930, // The Last of Us Part I
  1593500, // God of War
  1338770, // Death Stranding DC
  1332010, // Stray
  // === (multiplayer-only games removed) ===
  // === STRATEGY / SIM ===
  813780,  // Age of Empires II DE
  1466860, // Age of Empires IV
  255710,  // Cities: Skylines
  394360,  // Hearts of Iron IV
  281990,  // Stellaris
  236850,  // Europa Universalis IV
  1551360, // Forza Horizon 5
  // === SURVIVAL ===
  242760,  // The Forest
  1326470, // Sons of the Forest
  892970,  // Valheim
  108600,  // Project Zomboid
  322330,  // Don't Starve Together
  606150,  // Grounded
  346110,  // ARK: Survival Evolved
  // === INDIE HITS ===
  105600,  // Terraria
  367520,  // Hollow Knight
  413150,  // Stardew Valley
  1145360, // Hades
  548430,  // Deep Rock Galactic
  1966720, // Lethal Company
  1623730, // Palworld
  1329410, // Cult of the Lamb
  250900,  // The Binding of Isaac: Rebirth
  2379780, // Balatro
  457140,  // Oxygen Not Included
  973230,  // Psychonauts 2
  1203220, // NARAKA: BLADEPOINT
  976730,  // Halo: The Master Chief Collection
  1621690, // Sea of Thieves
  1063730, // New World
  // === HORROR ===
  739630,  // Phasmophobia
  // === RACING ===
  244210,  // Assetto Corsa
  805550,  // Assetto Corsa Competizione
  // === SIMULATION ===
  227300,  // Euro Truck Simulator 2
  311210,  // Call of Duty: Black Ops III
  // 393380, // Squad (multiplayer-only)
  431960,  // Wallpaper Engine
  // === MORE QUALITY INDIE ===
  1092790, // Inscryption
  851850,  // Vampire Survivors
  1061090, // Brotato
  460950,  // Katana ZERO
  632360,  // Risk of Rain 2
  588650,  // Dead Cells
  264710,  // Subnautica
  1313140, // Subnautica: Below Zero
  427520,  // Factorio
  526870,  // Satisfactory
  // 304930, // Unturned (multiplayer-only)
  1150690, // OMORI
  1902490, // Dave the Diver
  560130,  // Celeste
  869480,  // Neon Abyss
  753640,  // Outer Wilds
  372360,  // SUPERHOT
  257510,  // The Talos Principle
  219740,  // Don't Starve
  774171,  // Mortal Shell
  1100600, // Sifu
  1794680, // Tekken 8
  2368860, // Manor Lords
  1313140, // Subnautica Below Zero
  239350,  // Spelunky
  1942280, // Lies of P
  495420,  // State of Decay 2
  1659420, // Remnant II
  585420,  // Pathfinder: Kingmaker
  1199280, // Pathfinder: Wrath of the Righteous
  261550,  // Mount & Blade II: Bannerlord
  240760,  // Verdun
  911430,  // Ghostrunner
  976310,  // Ghostrunner 2
  1057090, // Ori and the Will of the Wisps
  387290,  // Ori and the Blind Forest DE
  668580,  // Disco Elysium
  632470,  // Disco Elysium - The Final Cut
  985810,  // Raft
  1150690, // OMORI
  1313120, // Spiritfarer
  1174180, // RDR2
  // === RESIDENT EVIL SERIES ===
  21690,   // Resident Evil 5
  287290,  // Resident Evil 6
  304240,  // Resident Evil Revelations
  592580,  // Resident Evil Revelations 2
  1196590, // Devil May Cry 5
  // === LEGO GAMES ===
  960950,  // LEGO Star Wars: The Skywalker Saga
  1082770, // LEGO Builder's Journey
  271610,  // LEGO Marvel Super Heroes
  352460,  // LEGO Jurassic World
  397950,  // LEGO Worlds
  214010,  // LEGO Batman 2
  // === 2025-2026 BIG RELEASES ===
  2420510, // S.T.A.L.K.E.R. 2
  1904540, // Pacific Drive
  2507950, // Civilization VII
  1817190, // Marvel's Spider-Man: Miles Morales
  2868840, // Slay the Spire 2
  2246340, // Monster Hunter Wilds (if on Steam)
  3321460, // ARC Raiders
  1874490, // Crimson Desert
  2589550, // Avowed
  2677660, // Clair Obscur: Expedition 33
  1938090, // CoD Modern Warfare III
  2933620, // Marathon
  2767030, // DOOM: The Dark Ages
  2198510, // Fable
  1090630, // Marvel's Wolverine (if Steam)
  2784840, // Elden Ring Nightreign
  1659040, // Hitman World of Assassination
  // === MORE AAA ===
  1293830, // Forza Motorsport
  1888930, // The Last of Us Part I
  457140,  // Oxygen Not Included
  1942280, // Lies of P
  1659420, // Remnant II
  585420,  // Pathfinder: Kingmaker
  1199280, // Pathfinder: Wrath
  911430,  // Ghostrunner
  668580,  // Disco Elysium
  387290,  // Ori and the Blind Forest DE
  985810,  // Raft
  1313120, // Spiritfarer
  1092790, // Inscryption
  264710,  // Subnautica
  1902490, // Dave the Diver
  560130,  // Celeste
  753640,  // Outer Wilds
  2368860, // Manor Lords
  1057090, // Ori and the Will of the Wisps
  261550,  // Mount & Blade II: Bannerlord
  // === CLASSIC / POPULAR ===
  8930,    // Civilization V
  268500,  // Civilization VI
  227300,  // Euro Truck Simulator 2
  431960,  // Wallpaper Engine
  236390,  // War Thunder
  346110,  // ARK: Survival Evolved
  // 304930, // Unturned (multiplayer-only)
  526870,  // Satisfactory
  427520,  // Factorio
  // 393380, // Squad (multiplayer-only)
  // === CALL OF DUTY SERIES ===
  2933620, // Marathon (Bungie)
  1938090, // CoD: Modern Warfare III
  1962663, // CoD: Modern Warfare II
  393100,  // CoD: Modern Warfare Remastered
  10180,   // CoD: Modern Warfare 2 (2009)
  42680,   // CoD: Modern Warfare 3 (2011)
  7940,    // CoD 4: Modern Warfare
  311210,  // CoD: Black Ops III
  202990,  // CoD: Black Ops II
  42710,   // CoD: Black Ops
  2519060, // CoD: Black Ops 6
  476620,  // CoD: WWII
  2519060, // CoD: BO6
  // === BATTLEFIELD SERIES ===
  1238840, // Battlefield 1
  1238810, // Battlefield V
  1517290, // Battlefield 2042
  24960,   // Battlefield: Bad Company 2
  // === MORE MISSING AAA ===
  1245620, // Elden Ring
  2784840, // Elden Ring Nightreign
  2767030, // DOOM: The Dark Ages
  782330,  // DOOM Eternal
  379720,  // DOOM (2016)
  1326470, // Sons of the Forest
  1245620, // Elden Ring
  976730,  // Halo MCC
  1240440, // Halo Infinite
  1817070, // Monster Hunter Wilds
  2050650, // RE4 Remake
  // === ASSASSIN'S CREED SERIES ===
  2378900, // Assassin's Creed Shadows
  2208920, // Assassin's Creed Mirage
  812140,  // Assassin's Creed Odyssey
  582160,  // Assassin's Creed Origins
  2074920, // Assassin's Creed Valhalla
  // === FAR CRY SERIES ===
  2369390, // Far Cry 6
  552520,  // Far Cry 5
  298110,  // Far Cry 4
  220240,  // Far Cry 3
  // === TOMB RAIDER FULL SERIES ===
  203160,  // Tomb Raider (2013)
  391220,  // Rise of the Tomb Raider
  750920,  // Shadow of the Tomb Raider
  // === BATMAN ARKHAM SERIES ===
  200260,  // Batman: Arkham City GOTY
  209000,  // Batman: Arkham Asylum GOTY
  35140,   // Batman: Arkham Asylum
  21090,   // Batman: Arkham City
  474180,  // Batman: Arkham Knight
  // === BIOSHOCK SERIES ===
  7670,    // BioShock
  8850,    // BioShock 2
  8870,    // BioShock Infinite
  // === MASS EFFECT ===
  1328670, // Mass Effect Legendary Edition
  // === DRAGON AGE ===
  2305050, // Dragon Age: The Veilguard
  // === METAL GEAR SOLID ===
  287700,  // Metal Gear Solid V: The Phantom Pain
  2740960, // Metal Gear Solid: Master Collection
  945950,  // Metal Gear Solid V: Ground Zeroes
  // === SPIDER-MAN ===
  1817190, // Spider-Man: Miles Morales
  1817070, // Spider-Man Remastered
  // === HORIZON ===
  1151640, // Horizon Zero Dawn
  2411780, // Horizon Forbidden West
  // === UNCHARTED ===
  1659420, // Uncharted: Legacy of Thieves
  // === FINAL FANTASY ===
  1121560, // Final Fantasy VII Remake
  1462040, // Final Fantasy XVI
  39150,   // Final Fantasy XIII
  292120,  // Final Fantasy XIII-2
  345350,  // Final Fantasy XV
  // === KINGDOM HEARTS ===
  2552430, // Kingdom Hearts HD 1.5+2.5
  // === NI NO KUNI ===
  798460,  // Ni no Kuni
  // === YAKUZA / LIKE A DRAGON ===
  1235140, // Like a Dragon: Ishin!
  1330310, // Like a Dragon: Infinite Wealth
  1295510, // Yakuza: Like a Dragon
  1388590, // Yakuza 0
  // === DEVIL MAY CRY ===
  601150,  // Devil May Cry HD Collection
  1196590, // Devil May Cry 5
  // === ALAN WAKE ===
  108710,  // Alan Wake
  1942400, // Alan Wake 2
  // === MAX PAYNE ===
  12140,   // Max Payne
  12150,   // Max Payne 2
  204100,  // Max Payne 3
  // === DEAD SPACE ===
  1693980, // Dead Space (Remake)
  // === STAR WARS ===
  1338770, // Star Wars Jedi: Survivor
  1172380, // Star Wars Jedi: Fallen Order
  2225070, // Star Wars Outlaws
  32440,   // Star Wars: KOTOR
  208580,  // Star Wars: KOTOR II
  // === RED DEAD ===
  1174180, // Red Dead Redemption 2
  2668510, // Red Dead Redemption
  // === GTA ===
  271590,  // GTA V
  12120,   // GTA: San Andreas
  12100,   // GTA: Vice City
  // === MAFIA ===
  1030840, // Mafia: Definitive Edition
  1030830, // Mafia II: Definitive Edition
  360430,  // Mafia III: Definitive Edition
  // === SLEEPING DOGS ===
  307690,  // Sleeping Dogs: Definitive Edition
  // === SAINTS ROW ===
  1380020, // Saints Row (2022)
  978300,  // Saints Row The Third Remastered
  // === JUST CAUSE ===
  225540,  // Just Cause 3
  517630,  // Just Cause 4
  // === METRO SERIES ===
  286690,  // Metro: Last Light Redux
  287390,  // Metro 2033 Redux
  412020,  // Metro Exodus
  // === WOLFENSTEIN ===
  201810,  // Wolfenstein: The New Order
  612880,  // Wolfenstein II: The New Colossus
  // === PREY ===
  480490,  // Prey (2017)
  // === DISHONORED ===
  205100,  // Dishonored
  403640,  // Dishonored 2
  // === DEUS EX ===
  238010,  // Deus Ex: Human Revolution
  337000,  // Deus Ex: Mankind Divided
  // === HITMAN ===
  236870,  // Hitman: Absolution
  1659040, // Hitman: World of Assassination
  // === WATCH DOGS ===
  243470,  // Watch_Dogs
  447040,  // Watch_Dogs 2
  // === GHOST OF TSUSHIMA ===
  2215430, // Ghost of Tsushima
  // === HOGWARTS ===
  990080,  // Hogwarts Legacy
  // === MORTAL KOMBAT ===
  976310,  // Mortal Kombat 1
  307780,  // Mortal Kombat X
  838350,  // Mortal Kombat 11
  // === STREET FIGHTER ===
  1364780, // Street Fighter 6
  // === DRAGON BALL ===
  1790600, // Dragon Ball: Sparking! ZERO
  // === NARUTO ===
  349040,  // Naruto Ultimate Ninja Storm 4
  // === ONE PIECE ===
  2645980, // One Piece Odyssey
  // === PERSONA ===
  1382330, // Persona 5 Royal
  1113000, // Persona 4 Golden
  2400510, // Persona 3 Reload
  // === TOTAL WAR ===
  594570,  // Total War: Warhammer III
  364360,  // Total War: Warhammer
  779340,  // Total War: Three Kingdoms
  // === CIVILIZATION ===
  8930,    // Civilization V
  268500,  // Civilization VI
  2507950, // Civilization VII
  // === XCOM ===
  200510,  // XCOM: Enemy Unknown
  268500,  // XCOM 2
  // === CRUSADER KINGS ===
  1158310, // Crusader Kings III
  // === DIVINITY ===
  435150,  // Divinity: Original Sin 2
  // === PILLAR OF ETERNITY ===
  291650,  // Pillars of Eternity
  560340,  // Pillars of Eternity II
  // === CUPHEAD ===
  268910,  // Cuphead
  // === SHOVEL KNIGHT ===
  250760,  // Shovel Knight
  // === IT TAKES TWO ===
  1426210, // It Takes Two
  // === A WAY OUT ===
  1222700, // A Way Out
  // === PORTAL ===
  400,     // Portal
  620,     // Portal 2
  // === HALF-LIFE ===
  70,      // Half-Life
  220,     // Half-Life 2
  546560,  // Half-Life: Alyx
  // === LEFT 4 DEAD ===
  500,     // Left 4 Dead
  550,     // Left 4 Dead 2
  // === WITCHER SERIES ===
  20900,   // The Witcher: Enhanced Edition
  20920,  // The Witcher 2
  292030,  // The Witcher 3
  // === DARK SOULS FULL ===
  570940,  // Dark Souls Remastered
  236430,  // Dark Souls II: Scholar
  374320,  // Dark Souls III
  // === NEED FOR SPEED ===
  1262540, // Need for Speed Unbound
  1262560, // Need for Speed Heat
  1151640, // NFS Payback
  // === FORZA ===
  1551360, // Forza Horizon 5
  1293830, // Forza Motorsport
  // === MINECRAFT LEGENDS ===
  // (Not on Steam)
  // === DYING LIGHT ===
  239140,  // Dying Light
  534380,  // Dying Light 2
  // === DEAD ISLAND ===
  383150,  // Dead Island Definitive Edition
  2135150, // Dead Island 2
  // === RESIDENT EVIL FULL ===
  304240,  // RE Revelations
  592580,  // RE Revelations 2
  21690,   // RE5
  287290,  // RE6
  418370,  // RE7
  883710,  // RE Village
  2050650, // RE4 Remake
  // === SILENT HILL ===
  2124490, // Silent Hill 2 (Remake)
  // === LITTLE NIGHTMARES ===
  424840,  // Little Nightmares
  860510,  // Little Nightmares II
  // === OUTLAST ===
  238320,  // Outlast
  414700,  // Outlast 2
  // === AMNESIA ===
  57300,   // Amnesia: The Dark Descent
  999220,  // Amnesia: The Bunker
  // === LAYERS OF FEAR ===
  391720,  // Layers of Fear
  // === ALIEN ISOLATION ===
  214490,  // Alien: Isolation
  // === THE EVIL WITHIN ===
  268050,  // The Evil Within
  601430,  // The Evil Within 2
  // === SNIPER ELITE ===
  238090,  // Sniper Elite V2
  502890,  // Sniper Elite 4
  1029690, // Sniper Elite 5
  // === TROPICO ===
  492720,  // Tropico 6
  // === ANNO ===
  916440,  // Anno 1800
  // === RESIDENT EVIL 9 ===
  2835570, // Resident Evil 9
  // === EA SPORTS FC / FIFA SERIES ===
  1811260, // EA Sports FC 25
  2669320, // EA Sports FC 24
  1996670, // FIFA 23
  1506830, // FIFA 22
  // === NBA 2K SERIES ===
  2338770, // NBA 2K25
  2161580, // NBA 2K24
  1919590, // NBA 2K23
  // === SONIC ===
  2513280, // Sonic x Shadow Generations
  1237320, // Sonic Frontiers
  71340,   // Sonic Generations
  // === CRASH / SPYRO ===
  731490,  // Crash Bandicoot N. Sane Trilogy
  1627720, // Crash Bandicoot 4
  1702060, // Spyro Reignited Trilogy
  // === GOD OF WAR ===
  1593500, // God of War
  2322010, // God of War Ragnarok
  // === RATCHET & CLANK ===
  1895880, // Ratchet & Clank: Rift Apart
  // === RETURNAL ===
  1649240, // Returnal
  // === DEATH STRANDING ===
  1850570, // Death Stranding 2 (if on Steam)
  1338770, // Death Stranding DC
  // === ARMORED CORE ===
  1888160, // Armored Core VI
  // === NIOH ===
  1325200, // Nioh 2
  485510,  // Nioh
  // === CODE VEIN ===
  678960,  // Code Vein
  // === TALES OF ===
  740130,  // Tales of Arise
  // === SCARLET NEXUS ===
  775500,  // Scarlet Nexus
  // === JEDI ===
  1338770, // Jedi Survivor
  1172380, // Jedi Fallen Order
  // === TITANFALL ===
  1237970, // Titanfall 2
  // === BORDERLANDS FULL ===
  49520,   // Borderlands 2
  397540,  // Borderlands 3
  // === PREY / DEATHLOOP ===
  480490,  // Prey
  1252330, // Deathloop
  // === FAR CRY PRIMAL ===
  371660,  // Far Cry Primal
  // === PRINCE OF PERSIA ===
  2344520, // Prince of Persia: The Lost Crown
  // === IMMORTALS FENYX ===
  1245570, // Immortals Fenyx Rising
  // === SOUTH PARK ===
  213670,  // South Park: Stick of Truth
  488790,  // South Park: Fractured But Whole
  // === SIMS ===
  1222670, // The Sims 4 (Free)
  // === WWE ===
  1722090, // WWE 2K23
  2149970, // WWE 2K24
  // === SPLIT FICTION ===
  2001120, // Split Fiction
  // === HOLLOW KNIGHT SILKSONG ===
  1030300, // Hollow Knight: Silksong
  // === HADES II ===
  1145350, // Hades II
  // === CLAIR OBSCUR ===
  2677660, // Clair Obscur: Expedition 33
  // === KINGDOM COME ===
  379430,  // Kingdom Come: Deliverance
  1771300, // Kingdom Come: Deliverance II
  // === THE ALTERS ===
  1601570, // The Alters
  // === FIRST BERSERKER KHAZAN ===
  2680010, // The First Berserker: Khazan
  // === LAST OF US FULL ===
  1888930, // The Last of Us Part I
  2531310, // The Last of Us Part II Remastered
  // === ELDER SCROLLS FULL ===
  22330,   // Elder Scrolls IV: Oblivion GOTY
  2623190, // Elder Scrolls IV: Oblivion Remastered
  489830,  // Elder Scrolls V: Skyrim SE
  22320,   // Elder Scrolls III: Morrowind
  // === ASSASSIN'S CREED FULL SERIES ===
  15100,   // Assassin's Creed (Director's Cut)
  33230,   // Assassin's Creed II
  48190,   // Assassin's Creed Brotherhood
  201870,  // Assassin's Creed Revelations
  911400,  // Assassin's Creed III Remastered
  242050,  // Assassin's Creed IV: Black Flag
  289650,  // Assassin's Creed Unity
  368500,  // Assassin's Creed Syndicate
  582160,  // Assassin's Creed Origins
  812140,  // Assassin's Creed Odyssey
  2074920, // Assassin's Creed Valhalla
  2208920, // Assassin's Creed Mirage
  2378900, // Assassin's Creed Shadows
  // === FINAL FANTASY REBIRTH ===
  2909400, // Final Fantasy VII Rebirth
  // === GOD OF WAR RAGNAROK ===
  2322010, // God of War Ragnarok
  // === DISPATCH ===
  // (Not found on Steam as standalone)
  // === DOOM FULL SERIES ===
  379720,  // DOOM (2016)
  782330,  // DOOM Eternal
  2767030, // DOOM: The Dark Ages
  // === SILENT HILL FULL ===
  2124490, // Silent Hill 2 Remake
  // === BORDERLANDS FULL ===
  8980,    // Borderlands GOTY
  49520,   // Borderlands 2
  261640,  // Borderlands: Pre-Sequel
  397540,  // Borderlands 3
  // === MONSTER HUNTER FULL ===
  582010,  // Monster Hunter: World
  1446780, // Monster Hunter Rise
  1817070, // Monster Hunter Wilds
  // === DARK SOULS + ELDEN RING FULL ===
  570940,  // Dark Souls Remastered
  236430,  // Dark Souls II: Scholar
  374320,  // Dark Souls III
  1245620, // Elden Ring
  2784840, // Elden Ring Nightreign
  814380,  // Sekiro
  // === LIES OF P ===
  1942280, // Lies of P
  // === METAL GEAR FULL ===
  287700,  // MGSV: The Phantom Pain
  945950,  // MGSV: Ground Zeroes
  2740960, // MGS: Master Collection
  // === BATTLEFIELD FULL ===
  24960,   // Battlefield: Bad Company 2
  1238840, // Battlefield 1
  1238810, // Battlefield V
  1517290, // Battlefield 2042
  // === CALL OF DUTY FULL ===
  7940,    // CoD 4: Modern Warfare
  10180,   // CoD: Modern Warfare 2 (2009)
  42680,   // CoD: Modern Warfare 3 (2011)
  42710,   // CoD: Black Ops
  202990,  // CoD: Black Ops II
  311210,  // CoD: Black Ops III
  476620,  // CoD: WWII
  393100,  // CoD: Modern Warfare Remastered
  1962663, // CoD: Modern Warfare II (2022)
  1938090, // CoD: Modern Warfare III (2023)
  2519060, // CoD: Black Ops 6
  // === DYING LIGHT FULL ===
  239140,  // Dying Light
  534380,  // Dying Light 2
  // === MISSING BIG SERIES ===
  // Witcher full
  20900,   // The Witcher: Enhanced Edition
  20920,   // The Witcher 2
  // Mafia series
  1030840, // Mafia: Definitive Edition
  1030830, // Mafia II: Definitive Edition
  360430,  // Mafia III: Definitive Edition
  // Sleeping Dogs
  307690,  // Sleeping Dogs: Definitive Edition
  // Alan Wake 2
  1942400, // Alan Wake 2
  // Sekiro
  814380,  // Sekiro: Shadows Die Twice
  // Persona
  2400510, // Persona 3 Reload
  1382330, // Persona 5 Royal
  // Mortal Kombat 1
  976310,  // Mortal Kombat 1
  // Dragon Age
  2305050, // Dragon Age: The Veilguard
  // Spyro
  1702060, // Spyro Reignited Trilogy
  // Dead Island
  383150,  // Dead Island Definitive Edition
  2135150, // Dead Island 2
  // Nioh
  485510,  // Nioh
  1325200, // Nioh 2
  // GTA Vice City
  12100,   // GTA: Vice City
  // DOOM: The Dark Ages
  2767030, // DOOM: The Dark Ages
  // Avowed
  2589550, // Avowed
  // Fable
  2198510, // Fable
  // Sniper Elite 4
  502890,  // Sniper Elite 4
  // Elden Ring Nightreign
  2784840, // Elden Ring Nightreign
  // AC Mirage + Shadows
  2208920, // Assassin's Creed Mirage
  2378900, // Assassin's Creed Shadows
  // RE Revelations
  304240,  // RE Revelations
  // Batman Arkham Knight
  474180,  // Batman: Arkham Knight
  // Horizon Forbidden West
  2411780, // Horizon Forbidden West
  // Ghost Recon Wildlands/Breakpoint
  // Uncharted
  1659420, // Uncharted: Legacy of Thieves (already in list but may not have synced)
  // Ratchet & Clank
  1895880, // Ratchet & Clank: Rift Apart
  // Returnal
  1649240, // Returnal
  // God of War Ragnarok
  2322010, // God of War Ragnarok
  // Spider-Man Remastered
  1817190, // Spider-Man: Miles Morales
  // Jedi Survivor
  1774580, // Star Wars Jedi: Survivor
  // Tomb Raider (2013)
  203160,  // Tomb Raider (2013)
  // Shadow of the Tomb Raider
  750920,  // Shadow of the Tomb Raider
  // Yakuza 0
  1388590, // Yakuza 0
  // Like a Dragon: Infinite Wealth
  1330310, // Like a Dragon: Infinite Wealth
  // Like a Dragon: Ishin
  1235140, // Like a Dragon: Ishin!
  // Dead Space Remake
  1693980, // Dead Space
  // Control
  870780,  // Control
  // Remnant II
  1659420, // Remnant II
  // Need for Speed Unbound + Heat
  1262540, // NFS Unbound
  1262560, // NFS Heat
  // Ghostrunner
  911430,  // Ghostrunner
  976310,  // Ghostrunner 2
  // Resident Evil 9
  2835570, // Resident Evil 9
  // NBA 2K25
  2338770, // NBA 2K25
  // Crimson Desert (already there)
  // MGS Master Collection
  2740960, // MGS: Master Collection
  // MGS Ground Zeroes
  945950,  // MGSV: Ground Zeroes
  // Star Wars Outlaws
  2225070, // Star Wars Outlaws
  // STALKER 2
  2420510, // S.T.A.L.K.E.R. 2
  // Marvel's Wolverine (if on Steam)
  // Civilization VII
  2507950, // Civilization VII
  // EA FC 24
  2669320, // EA Sports FC 24
  // Clair Obscur
  2677660, // Clair Obscur: Expedition 33
  // Kingdom Come already in list
  // Split Fiction
  2001120, // Split Fiction
  // Last of Us already in list
  // The First Berserker already in list
];

/**
 * Search Steam Store for a game by name and auto-add to DB if found.
 * Returns the matched game info (cover, genres, etc.) or null.
 */
export async function searchAndAutoAdd(gameName: string): Promise<{
  title: string;
  coverUrl: string;
  genres: string[];
  description: string;
  slug: string;
} | null> {
  try {
    // Search Steam Store
    const searchRes = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=us`,
      { signal: AbortSignal.timeout(10000) }
    );
    const searchData = await searchRes.json();
    const items: Array<{ id: number; name: string; type: string }> = searchData.items || [];

    // Find best match — prefer exact or close match, only "app" type (not DLC/bundle)
    const match = items.find((i) => i.type === "app" && i.name.toLowerCase().includes(gameName.toLowerCase().slice(0, 10)))
      || items.find((i) => i.type === "app");

    if (!match) return null;

    // Fetch full details
    const detail = await fetchAppDetails(match.id);
    if (!detail || detail.type !== "game") return null;

    // Add to our DB if not already there
    const slug = slugify(detail.name);
    const existing = await prisma.game.findUnique({ where: { slug } });

    if (!existing) {
      await addGameFromSteam(detail);
    }

    return {
      title: detail.name,
      coverUrl: detail.header_image,
      genres: (detail.genres || []).map((g) => g.description),
      description: detail.short_description || detail.name,
      slug,
    };
  } catch {
    return null;
  }
}

/**
 * Search Steam and return results without auto-adding (for user to pick).
 */
export async function searchSteamGames(query: string): Promise<Array<{
  appId: number;
  name: string;
  coverUrl: string;
}>> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=us`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    return (data.items || [])
      .filter((i: any) => i.type === "app")
      .slice(0, 10)
      .map((i: any) => ({
        appId: i.id,
        name: i.name,
        coverUrl: i.tiny_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${i.id}/header.jpg`,
      }));
  } catch {
    return [];
  }
}

/**
 * Get achievements for a game directly from Steam API (no DB required).
 * Searches for the game by title, finds appId, fetches achievement schema.
 */
export async function getSteamAchievements(gameTitle: string, lang = "turkish"): Promise<{
  appId: number;
  achievements: Array<{ apiName: string; name: string; description: string; iconUrl: string | null; hidden: boolean }>;
} | null> {
  try {
    // 1. Search Steam for the game
    const searchRes = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameTitle)}&l=english&cc=us`,
      { signal: AbortSignal.timeout(10000) }
    );
    const searchData = await searchRes.json();
    const items: Array<{ id: number; name: string; type: string }> = searchData.items || [];
    const match = items.find((i) => i.type === "app") || null;
    if (!match) return null;

    // 2. Fetch achievement schema in requested language
    const achRes = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_KEY}&appid=${match.id}&l=${lang}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const achData = await achRes.json();
    const achs: Array<{ name: string; displayName: string; description?: string; icon?: string; hidden?: number }> =
      achData.game?.availableGameStats?.achievements || [];

    // 3. If some descriptions are empty and lang != english, fetch English as fallback
    const hasEmpty = achs.some((a) => !a.description);
    let enMap: Record<string, string> = {};
    if (hasEmpty && lang !== "english") {
      try {
        const enRes = await fetch(
          `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_KEY}&appid=${match.id}&l=english`,
          { signal: AbortSignal.timeout(10000) }
        );
        const enData = await enRes.json();
        const enAchs: Array<{ name: string; description?: string }> =
          enData.game?.availableGameStats?.achievements || [];
        for (const a of enAchs) {
          if (a.description) enMap[a.name] = a.description;
        }
      } catch { /* ignore fallback failure */ }
    }

    return {
      appId: match.id,
      achievements: achs.map((a) => ({
        apiName: a.name,
        name: a.displayName || a.name,
        description: a.description || enMap[a.name] || "",
        iconUrl: a.icon || null,
        hidden: a.hidden === 1,
      })),
    };
  } catch {
    return null;
  }
}
