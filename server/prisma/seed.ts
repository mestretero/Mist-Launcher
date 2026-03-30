import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/stealike?schema=public" }),
});

// Seed hosting profiles for P2P multiplayer
// Games are synced from Steam via admin routes — NOT seeded here
async function seedHostingProfiles() {
  const count = await prisma.gameHostingProfile.count();
  if (count > 0) {
    console.log("Hosting profiles already seeded, skipping.");
    return;
  }

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

seedHostingProfiles()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
