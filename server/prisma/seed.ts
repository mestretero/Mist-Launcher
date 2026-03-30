import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/stealike?schema=public" }),
});

async function main() {
  // Clear existing data for re-seed (order matters for FK constraints)
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.gameCollectionItem.deleteMany({});
  await prisma.gameCollection.deleteMany({});
  await prisma.userAchievement.deleteMany({});
  await prisma.achievement.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.libraryItem.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.game.deleteMany({});

  const publisher = await prisma.publisher.upsert({
    where: { slug: "demo-publisher" },
    update: {},
    create: {
      name: "Demo Publisher",
      slug: "demo-publisher",
      contactEmail: "demo@stealike.com",
      commissionRate: 0.80,
      isVerified: true,
    },
  });

  const publisher2 = await prisma.publisher.upsert({
    where: { slug: "nova-games" },
    update: {},
    create: {
      name: "Nova Games",
      slug: "nova-games",
      contactEmail: "nova@stealike.com",
      commissionRate: 0.80,
      isVerified: true,
    },
  });

  const publisher3 = await prisma.publisher.upsert({
    where: { slug: "anadolu-studios" },
    update: {},
    create: {
      name: "Anadolu Studios",
      slug: "anadolu-studios",
      contactEmail: "anadolu@stealike.com",
      commissionRate: 0.80,
      isVerified: true,
    },
  });

  const games = [
    {
      title: "Galactic Odyssey",
      slug: "galactic-odyssey",
      description: "Uzay keşif ve macera oyunu. Galaksiler arası yolculuğa çık, yeni gezegenler keşfet ve uzaylı medeniyetlerle tanış. Devasa açık dünya, 200+ gezegen sistemi ve derinlemesine hikaye.",
      shortDescription: "Epik uzay keşif macerası",
      categories: ["Aksiyon", "Macera", "Uzay"],
      price: 499.99,
      coverImageUrl: "https://picsum.photos/seed/galactic-odyssey/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/galactic-ss1/1920/1080",
        "https://picsum.photos/seed/galactic-ss2/1920/1080",
        "https://picsum.photos/seed/galactic-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-8400", gpu: "GTX 1060", ram: "8 GB", storage: "50 GB" }),
      releaseDate: new Date("2025-06-15"),
      downloadSize: BigInt(25 * 1024 * 1024),
      publisherId: publisher.id,
    },
    {
      title: "Shadow Realm",
      slug: "shadow-realm",
      description: "Karanlık fantezi dünyasında geçen aksiyon RPG. Güçlü büyüler öğren, efsanevi silahlar topla ve karanlık lordu yenilgiye uğrat. 60+ saat hikaye, New Game+ modu.",
      shortDescription: "Karanlık fantezi aksiyon RPG",
      categories: ["RPG", "Aksiyon", "Fantazi"],
      price: 349.99,
      discountPercent: 15,
      coverImageUrl: "https://picsum.photos/seed/shadow-realm/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/shadow-ss1/1920/1080",
        "https://picsum.photos/seed/shadow-ss2/1920/1080",
        "https://picsum.photos/seed/shadow-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-6600", gpu: "GTX 970", ram: "8 GB", storage: "35 GB" }),
      releaseDate: new Date("2025-03-22"),
      downloadSize: BigInt(18 * 1024 * 1024),
      publisherId: publisher2.id,
    },
    {
      title: "Speed Legends",
      slug: "speed-legends",
      description: "Adrenalin dolu yarış oyunu. 50'den fazla araç, 30+ pist ve online multiplayer ile yarışın keyfini çıkar. Gerçekçi fizik motoru ve dinamik hava koşulları.",
      shortDescription: "Arcade yarış deneyimi",
      categories: ["Yarış", "Arcade", "Spor"],
      price: 249.99,
      discountPercent: 25,
      coverImageUrl: "https://picsum.photos/seed/speed-legends/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/speed-ss1/1920/1080",
        "https://picsum.photos/seed/speed-ss2/1920/1080",
        "https://picsum.photos/seed/speed-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-8100", gpu: "GTX 750 Ti", ram: "4 GB", storage: "20 GB" }),
      releaseDate: new Date("2025-01-10"),
      downloadSize: BigInt(12 * 1024 * 1024),
      publisherId: publisher.id,
    },
    {
      title: "Fortress Builder",
      slug: "fortress-builder",
      description: "Stratejik kale inşa ve savunma oyunu. Kendi kaleni tasarla, ordu kur ve düşman saldırılarına karşı savun. 100+ bina, 50+ birim türü.",
      shortDescription: "Kale inşa ve strateji",
      categories: ["Strateji", "Simülasyon", "İnşa"],
      price: 179.99,
      discountPercent: 10,
      coverImageUrl: "https://picsum.photos/seed/fortress-builder/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/fortress-ss1/1920/1080",
        "https://picsum.photos/seed/fortress-ss2/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-6100", gpu: "GTX 660", ram: "4 GB", storage: "10 GB" }),
      releaseDate: new Date("2024-11-05"),
      downloadSize: BigInt(8 * 1024 * 1024),
      publisherId: publisher2.id,
    },
    {
      title: "Cyber Strike",
      slug: "cyber-strike",
      description: "Cyberpunk temalı FPS. Neon ışıklı sokaklarda, siber geliştirmeler ve gelişmiş silahlarla savaş. Rekabetçi 5v5 mod ve battle royale.",
      shortDescription: "Cyberpunk FPS aksiyonu",
      categories: ["FPS", "Aksiyon", "Cyberpunk"],
      price: 599.99,
      coverImageUrl: "https://picsum.photos/seed/cyber-strike/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/cyber-ss1/1920/1080",
        "https://picsum.photos/seed/cyber-ss2/1920/1080",
        "https://picsum.photos/seed/cyber-ss3/1920/1080",
        "https://picsum.photos/seed/cyber-ss4/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i7-8700", gpu: "RTX 2060", ram: "16 GB", storage: "70 GB" }),
      releaseDate: new Date("2025-09-01"),
      downloadSize: BigInt(35 * 1024 * 1024),
      publisherId: publisher.id,
    },
    {
      title: "Ocean Explorer",
      slug: "ocean-explorer",
      description: "Derin deniz keşif ve hayatta kalma oyunu. Okyanus derinliklerini keşfet, denizaltını güçlendir ve gizemli yaratıklarla karşılaş.",
      shortDescription: "Derin deniz macerası",
      categories: ["Macera", "Simülasyon", "Keşif"],
      price: 299.99,
      discountPercent: 20,
      coverImageUrl: "https://picsum.photos/seed/ocean-explorer/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/ocean-ss1/1920/1080",
        "https://picsum.photos/seed/ocean-ss2/1920/1080",
        "https://picsum.photos/seed/ocean-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-7500", gpu: "GTX 1050 Ti", ram: "8 GB", storage: "25 GB" }),
      releaseDate: new Date("2024-07-20"),
      downloadSize: BigInt(15 * 1024 * 1024),
      publisherId: publisher2.id,
    },
    {
      title: "Pixel Warriors",
      slug: "pixel-warriors",
      description: "Retro pixel art aksiyon platformer. 100+ bölüm, boss savaşları ve kooperatif mod ile klasik oyun keyfi. Yerel ve online co-op desteği.",
      shortDescription: "Retro aksiyon platformer",
      categories: ["Indie", "Platform", "Retro"],
      price: 89.99,
      discountPercent: 40,
      coverImageUrl: "https://picsum.photos/seed/pixel-warriors/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/pixel-ss1/1920/1080",
        "https://picsum.photos/seed/pixel-ss2/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Any dual-core", gpu: "Integrated", ram: "2 GB", storage: "500 MB" }),
      releaseDate: new Date("2024-04-12"),
      downloadSize: BigInt(2 * 1024 * 1024),
      publisherId: publisher3.id,
    },
    {
      title: "Anadolu Efsaneleri",
      slug: "anadolu-efsaneleri",
      description: "Türk mitolojisinden ilham alan aksiyon macera oyunu. Anadolu'nun kadim topraklarında destansı bir yolculuğa çık. Tepegöz, Asena ve daha fazlası.",
      shortDescription: "Türk mitolojisi aksiyon macera",
      categories: ["Aksiyon", "RPG", "Türk"],
      price: 399.99,
      coverImageUrl: "https://picsum.photos/seed/anadolu-efsaneleri/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/anadolu-ss1/1920/1080",
        "https://picsum.photos/seed/anadolu-ss2/1920/1080",
        "https://picsum.photos/seed/anadolu-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-9400", gpu: "GTX 1660", ram: "12 GB", storage: "45 GB" }),
      releaseDate: new Date("2025-10-29"),
      downloadSize: BigInt(28 * 1024 * 1024),
      publisherId: publisher3.id,
    },
    {
      title: "Istanbul Underground",
      slug: "istanbul-underground",
      description: "İstanbul'un karanlık sokaklarında geçen stealth aksiyon oyunu. Gizli örgütleri çökert, ipuçlarını takip et ve şehrin altındaki gizli dünyayı keşfet.",
      shortDescription: "İstanbul temalı stealth aksiyon",
      categories: ["Aksiyon", "Gizlilik", "Açık Dünya"],
      price: 449.99,
      discountPercent: 30,
      coverImageUrl: "https://picsum.photos/seed/istanbul-underground/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/istanbul-ss1/1920/1080",
        "https://picsum.photos/seed/istanbul-ss2/1920/1080",
        "https://picsum.photos/seed/istanbul-ss3/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-10400", gpu: "GTX 1660 Super", ram: "12 GB", storage: "40 GB" }),
      releaseDate: new Date("2025-08-15"),
      downloadSize: BigInt(22 * 1024 * 1024),
      publisherId: publisher3.id,
    },
    {
      title: "Mech Arena",
      slug: "mech-arena",
      description: "Dev robotlarla savaş! Kendi mech'ini özelleştir, silahlarını seç ve online arenada rakiplerini alt et. 4v4 takım savaşları ve turnuva modu.",
      shortDescription: "Online mech savaş arena",
      categories: ["Aksiyon", "FPS", "Mech"],
      price: 199.99,
      coverImageUrl: "https://picsum.photos/seed/mech-arena/460/215",
      screenshots: JSON.stringify([
        "https://picsum.photos/seed/mech-ss1/1920/1080",
        "https://picsum.photos/seed/mech-ss2/1920/1080",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-8500", gpu: "GTX 1060", ram: "8 GB", storage: "30 GB" }),
      releaseDate: new Date("2025-05-20"),
      downloadSize: BigInt(16 * 1024 * 1024),
      publisherId: publisher.id,
    },
  ];

  const createdGames = [];
  for (const game of games) {
    const created = await prisma.game.upsert({
      where: { slug: game.slug },
      update: {
        coverImageUrl: game.coverImageUrl,
        screenshots: game.screenshots,
        categories: game.categories,
      },
      create: {
        ...game,
        downloadUrl: `http://localhost:3001/public/downloads/${game.slug}.zip`,
        status: "PUBLISHED",
      },
    });
    createdGames.push(created);
  }

  console.log(`Seeded ${createdGames.length} games`);

  // Create achievements for each game
  for (const game of createdGames) {
    await prisma.achievement.createMany({
      data: [
        { gameId: game.id, name: "İlk Adım", description: "10 dakika oynadın" },
        { gameId: game.id, name: "Kaşif", description: "1 saat oynadın" },
        { gameId: game.id, name: "Veteran", description: "10 saat oynadın" },
        { gameId: game.id, name: "Uzman", description: "30 saat oynadın" },
        { gameId: game.id, name: "Efsane", description: "100 saat oynadın" },
      ],
      skipDuplicates: true,
    });
  }
  console.log(`Seeded achievements for ${createdGames.length} games`);

  // Create library items for all users
  const users = await prisma.user.findMany();
  if (users.length > 0) {
    for (const user of users) {
      const playTimes = [1420, 890, 245, 67, 2100, 30, 510, 0, 1800, 150];
      const lastPlayedDates = [
        new Date("2026-03-18"),
        new Date("2026-03-15"),
        new Date("2026-03-10"),
        new Date("2026-02-28"),
        new Date("2026-03-19"),
        new Date("2026-01-20"),
        new Date("2026-03-17"),
        null,
        new Date("2026-03-12"),
        new Date("2026-03-01"),
      ];
      const installPaths = [
        "C:/Games/Stealike/galactic-odyssey",
        "C:/Games/Stealike/shadow-realm",
        "C:/Games/Stealike/speed-legends",
        null,
        "C:/Games/Stealike/cyber-strike",
        null,
        "C:/Games/Stealike/pixel-warriors",
        null,
        "C:/Games/Stealike/istanbul-underground",
        null,
      ];

      for (let i = 0; i < createdGames.length; i++) {
        await prisma.libraryItem.upsert({
          where: { userId_gameId: { userId: user.id, gameId: createdGames[i].id } },
          update: {
            playTimeMins: playTimes[i],
            lastPlayedAt: lastPlayedDates[i],
            installPath: installPaths[i],
          },
          create: {
            userId: user.id,
            gameId: createdGames[i].id,
            playTimeMins: playTimes[i],
            lastPlayedAt: lastPlayedDates[i],
            installPath: installPaths[i],
            purchasedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          },
        });
      }
      console.log(`Created ${createdGames.length} library items for ${user.email}`);
    }
  } else {
    console.log("No users found to seed library items.");
  }
}

async function seedHostingProfiles() {
  const count = await prisma.gameHostingProfile.count();
  if (count > 0) return;

  await prisma.gameHostingProfile.createMany({
    data: [
      { gameName: "Minecraft", port: 25565, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Oyun içinde 'Open to LAN' seçeneğini kullanın." },
      { gameName: "Terraria", port: 7777, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Host & Play ile sunucu açın." },
      { gameName: "Left 4 Dead 2", port: 27015, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Create Lobby ile oda oluşturun." },
      { gameName: "Counter-Strike 2", port: 27015, protocol: "UDP", hostType: "DEDICATED", isOfficial: true, serverFileName: "srcds.exe", setupInstructions: "SteamCMD ile dedicated server indirin." },
      { gameName: "Valheim", port: 2456, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Start Server ile sunucu açın." },
      { gameName: "Don't Starve Together", port: 10999, protocol: "UDP", hostType: "DEDICATED", isOfficial: true, setupInstructions: "Oyun içi Host Game seçeneğini kullanın." },
      { gameName: "Risk of Rain 2", port: 27015, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Multiplayer > Host ile oda oluşturun." },
      { gameName: "The Forest", port: 8766, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Multiplayer > Host seçeneğini kullanın." },
      { gameName: "Stardew Valley", port: 24642, protocol: "TCP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Co-op > Host Farm ile başlatın." },
      { gameName: "Among Us", port: 22023, protocol: "UDP", hostType: "LAN_HOST", isOfficial: true, setupInstructions: "Local > Create Game ile oda oluşturun." },
    ],
  });
  console.log("Seeded 10 hosting profiles");
}

main()
  .then(() => seedHostingProfiles())
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
