-- CreateEnum
CREATE TYPE "vote_type" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "community_links" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "size" VARCHAR(20),
    "crack_info" VARCHAR(100),
    "score" INTEGER NOT NULL DEFAULT 0,
    "virus_reports" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_admin_post" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_link_mirrors" (
    "id" UUID NOT NULL,
    "community_link_id" UUID NOT NULL,
    "source_name" VARCHAR(50) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_link_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_link_votes" (
    "id" UUID NOT NULL,
    "community_link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vote_type" "vote_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_link_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_link_reports" (
    "id" UUID NOT NULL,
    "community_link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_link_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_links_game_id_is_hidden_idx" ON "community_links"("game_id", "is_hidden");

-- CreateIndex
CREATE INDEX "community_links_game_id_score_idx" ON "community_links"("game_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "community_link_votes_community_link_id_user_id_key" ON "community_link_votes"("community_link_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_link_reports_community_link_id_user_id_key" ON "community_link_reports"("community_link_id", "user_id");

-- AddForeignKey
ALTER TABLE "community_links" ADD CONSTRAINT "community_links_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_links" ADD CONSTRAINT "community_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_link_mirrors" ADD CONSTRAINT "community_link_mirrors_community_link_id_fkey" FOREIGN KEY ("community_link_id") REFERENCES "community_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_link_votes" ADD CONSTRAINT "community_link_votes_community_link_id_fkey" FOREIGN KEY ("community_link_id") REFERENCES "community_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_link_votes" ADD CONSTRAINT "community_link_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_link_reports" ADD CONSTRAINT "community_link_reports_community_link_id_fkey" FOREIGN KEY ("community_link_id") REFERENCES "community_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_link_reports" ADD CONSTRAINT "community_link_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
