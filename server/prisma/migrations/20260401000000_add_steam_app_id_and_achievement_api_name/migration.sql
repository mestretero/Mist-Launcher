-- Add steam_app_id to games table
ALTER TABLE "games" ADD COLUMN "steam_app_id" INTEGER;
CREATE UNIQUE INDEX "games_steam_app_id_key" ON "games"("steam_app_id");

-- Add api_name to achievements table
ALTER TABLE "achievements" ADD COLUMN "api_name" TEXT;
