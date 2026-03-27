-- CreateEnum
CREATE TYPE "profile_visibility" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "profile_block_type" AS ENUM ('GAME_SHOWCASE', 'FAVORITE_GAME', 'ACHIEVEMENTS', 'ACTIVITY', 'TEXT', 'SCREENSHOTS', 'SOCIAL_LINKS', 'STATS', 'COMMENT_WALL');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "visibility" "profile_visibility" NOT NULL DEFAULT 'PUBLIC',
    "allow_comments" BOOLEAN NOT NULL DEFAULT true,
    "banner_theme" TEXT NOT NULL DEFAULT 'default',
    "custom_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_blocks" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "type" "profile_block_type" NOT NULL,
    "position" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_comments" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "profile_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "profile_blocks_profile_id_position_idx" ON "profile_blocks"("profile_id", "position");

-- CreateIndex
CREATE INDEX "profile_comments_profile_id_created_at_idx" ON "profile_comments"("profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_blocks" ADD CONSTRAINT "profile_blocks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_comments" ADD CONSTRAINT "profile_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
