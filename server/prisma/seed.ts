import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/stealike?schema=public" }),
});

async function main() {
  // Clear existing data for re-seed
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

  const games = [
    {
      title: "Galactic Odyssey",
      slug: "galactic-odyssey",
      description: "Uzay keşif ve macera oyunu. Galaksiler arası yolculuğa çık, yeni gezegenler keşfet ve uzaylı medeniyetlerle tanış.",
      shortDescription: "Epik uzay keşif macerası",
      price: 499.99,
      coverImageUrl: "https://placehold.co/460x215/1a1a2e/e94560?text=Galactic+Odyssey&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/1a1a2e/e94560?text=Screenshot+1",
        "https://placehold.co/1920x1080/1a1a2e/e94560?text=Screenshot+2",
        "https://placehold.co/1920x1080/1a1a2e/e94560?text=Screenshot+3",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-8400", gpu: "GTX 1060", ram: "8 GB", storage: "50 GB" }),
      releaseDate: new Date("2025-06-15"),
      downloadSize: BigInt(25 * 1024 * 1024),
    },
    {
      title: "Shadow Realm",
      slug: "shadow-realm",
      description: "Karanlık fantezi dünyasında geçen aksiyon RPG. Güçlü büyüler öğren, efsanevi silahlar topla ve karanlık lordu yenilgiye uğrat.",
      shortDescription: "Karanlık fantezi aksiyon RPG",
      price: 349.99,
      discountPercent: 15,
      coverImageUrl: "https://placehold.co/460x215/0d0d0d/8b0000?text=Shadow+Realm&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/0d0d0d/8b0000?text=Screenshot+1",
        "https://placehold.co/1920x1080/0d0d0d/8b0000?text=Screenshot+2",
        "https://placehold.co/1920x1080/0d0d0d/8b0000?text=Screenshot+3",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-6600", gpu: "GTX 970", ram: "8 GB", storage: "35 GB" }),
      releaseDate: new Date("2025-03-22"),
      downloadSize: BigInt(18 * 1024 * 1024),
    },
    {
      title: "Speed Legends",
      slug: "speed-legends",
      description: "Adrenalin dolu yarış oyunu. 50'den fazla araç, 30+ pist ve online multiplayer ile yarışın keyfini çıkar.",
      shortDescription: "Arcade yarış deneyimi",
      price: 249.99,
      discountPercent: 25,
      coverImageUrl: "https://placehold.co/460x215/ff6b00/ffffff?text=Speed+Legends&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/ff6b00/ffffff?text=Screenshot+1",
        "https://placehold.co/1920x1080/ff6b00/ffffff?text=Screenshot+2",
        "https://placehold.co/1920x1080/ff6b00/ffffff?text=Screenshot+3",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-8100", gpu: "GTX 750 Ti", ram: "4 GB", storage: "20 GB" }),
      releaseDate: new Date("2025-01-10"),
      downloadSize: BigInt(12 * 1024 * 1024),
    },
    {
      title: "Fortress Builder",
      slug: "fortress-builder",
      description: "Stratejik kale inşa ve savunma oyunu. Kendi kaleni tasarla, ordu kur ve düşman saldırılarına karşı savun.",
      shortDescription: "Kale inşa ve strateji",
      price: 179.99,
      discountPercent: 10,
      coverImageUrl: "https://placehold.co/460x215/2d5016/c8e6c9?text=Fortress+Builder&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/2d5016/c8e6c9?text=Screenshot+1",
        "https://placehold.co/1920x1080/2d5016/c8e6c9?text=Screenshot+2",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i3-6100", gpu: "GTX 660", ram: "4 GB", storage: "10 GB" }),
      releaseDate: new Date("2024-11-05"),
      downloadSize: BigInt(8 * 1024 * 1024),
    },
    {
      title: "Cyber Strike",
      slug: "cyber-strike",
      description: "Cyberpunk temalı FPS. Neon ışıklı sokaklarda, siber geliştirmeler ve gelişmiş silahlarla savaş.",
      shortDescription: "Cyberpunk FPS aksiyonu",
      price: 599.99,
      coverImageUrl: "https://placehold.co/460x215/0a0a23/00ff41?text=Cyber+Strike&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/0a0a23/00ff41?text=Screenshot+1",
        "https://placehold.co/1920x1080/0a0a23/00ff41?text=Screenshot+2",
        "https://placehold.co/1920x1080/0a0a23/00ff41?text=Screenshot+3",
        "https://placehold.co/1920x1080/0a0a23/00ff41?text=Screenshot+4",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i7-8700", gpu: "RTX 2060", ram: "16 GB", storage: "70 GB" }),
      releaseDate: new Date("2025-09-01"),
      downloadSize: BigInt(35 * 1024 * 1024),
    },
    {
      title: "Ocean Explorer",
      slug: "ocean-explorer",
      description: "Derin deniz keşif ve hayatta kalma oyunu. Okyanus derinliklerini keşfet, denizaltını güçlendir ve gizemli yaratıklarla karşılaş.",
      shortDescription: "Derin deniz macerası",
      price: 299.99,
      discountPercent: 20,
      coverImageUrl: "https://placehold.co/460x215/003366/00bcd4?text=Ocean+Explorer&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/003366/00bcd4?text=Screenshot+1",
        "https://placehold.co/1920x1080/003366/00bcd4?text=Screenshot+2",
        "https://placehold.co/1920x1080/003366/00bcd4?text=Screenshot+3",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-7500", gpu: "GTX 1050 Ti", ram: "8 GB", storage: "25 GB" }),
      releaseDate: new Date("2024-07-20"),
      downloadSize: BigInt(15 * 1024 * 1024),
    },
    {
      title: "Pixel Warriors",
      slug: "pixel-warriors",
      description: "Retro pixel art aksiyon platformer. 100+ bölüm, boss savaşları ve kooperatif mod ile klasik oyun keyfi.",
      shortDescription: "Retro aksiyon platformer",
      price: 89.99,
      discountPercent: 40,
      coverImageUrl: "https://placehold.co/460x215/4a148c/e040fb?text=Pixel+Warriors&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/4a148c/e040fb?text=Screenshot+1",
        "https://placehold.co/1920x1080/4a148c/e040fb?text=Screenshot+2",
      ]),
      minRequirements: JSON.stringify({ cpu: "Any dual-core", gpu: "Integrated", ram: "2 GB", storage: "500 MB" }),
      releaseDate: new Date("2024-04-12"),
      downloadSize: BigInt(2 * 1024 * 1024),
    },
    {
      title: "Anadolu Efsaneleri",
      slug: "anadolu-efsaneleri",
      description: "Türk mitolojisinden ilham alan aksiyon macera oyunu. Anadolu'nun kadim topraklarında destansı bir yolculuğa çık.",
      shortDescription: "Türk mitolojisi aksiyon macera",
      price: 399.99,
      coverImageUrl: "https://placehold.co/460x215/5d0000/ffd700?text=Anadolu+Efsaneleri&font=montserrat",
      screenshots: JSON.stringify([
        "https://placehold.co/1920x1080/5d0000/ffd700?text=Screenshot+1",
        "https://placehold.co/1920x1080/5d0000/ffd700?text=Screenshot+2",
        "https://placehold.co/1920x1080/5d0000/ffd700?text=Screenshot+3",
      ]),
      minRequirements: JSON.stringify({ cpu: "Intel i5-9400", gpu: "GTX 1660", ram: "12 GB", storage: "45 GB" }),
      releaseDate: new Date("2025-10-29"),
      downloadSize: BigInt(28 * 1024 * 1024),
    },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: {
        ...game,
        downloadUrl: `http://localhost:3001/public/downloads/${game.slug}.zip`,
        publisherId: publisher.id,
        status: "PUBLISHED",
      },
    });
  }

  console.log(`Seeded ${games.length} games`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
