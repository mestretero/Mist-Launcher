-- CreateTable
CREATE TABLE "profile_game_cache" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "play_time_mins" INTEGER NOT NULL DEFAULT 0,
    "exe_path_hash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'local',
    "last_played_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_game_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_game_cache_user_id_idx" ON "profile_game_cache"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_game_cache_user_id_exe_path_hash_key" ON "profile_game_cache"("user_id", "exe_path_hash");

-- AddForeignKey
ALTER TABLE "profile_game_cache" ADD CONSTRAINT "profile_game_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
