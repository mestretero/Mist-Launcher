-- CreateEnum
CREATE TYPE "room_visibility" AS ENUM ('FRIENDS', 'INVITE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('WAITING', 'PLAYING', 'CLOSED');

-- CreateEnum
CREATE TYPE "host_type" AS ENUM ('LAN_HOST', 'DEDICATED');

-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('CONNECTING', 'CONNECTED', 'READY', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "game_protocol" AS ENUM ('TCP', 'UDP', 'BOTH');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "game_id" UUID,
    "game_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "visibility" "room_visibility" NOT NULL DEFAULT 'FRIENDS',
    "status" "room_status" NOT NULL DEFAULT 'WAITING',
    "max_players" INTEGER NOT NULL DEFAULT 8,
    "host_type" "host_type" NOT NULL DEFAULT 'LAN_HOST',
    "port" INTEGER,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "virtual_ip" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "status" "player_status" NOT NULL DEFAULT 'CONNECTING',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID,
    "content" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_hosting_profiles" (
    "id" UUID NOT NULL,
    "game_id" UUID,
    "game_name" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "game_protocol" NOT NULL DEFAULT 'TCP',
    "host_type" "host_type" NOT NULL DEFAULT 'LAN_HOST',
    "server_file_url" TEXT,
    "server_file_name" TEXT,
    "setup_instructions" TEXT,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_hosting_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_status_visibility_idx" ON "rooms"("status", "visibility");

-- CreateIndex
CREATE INDEX "rooms_host_id_idx" ON "rooms"("host_id");

-- CreateIndex
CREATE INDEX "room_players_room_id_idx" ON "room_players"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_room_id_user_id_key" ON "room_players"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "room_messages_room_id_created_at_idx" ON "room_messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "game_hosting_profiles_game_id_idx" ON "game_hosting_profiles"("game_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_hosting_profiles" ADD CONSTRAINT "game_hosting_profiles_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
