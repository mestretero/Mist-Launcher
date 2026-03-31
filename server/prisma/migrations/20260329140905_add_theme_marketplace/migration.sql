-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTxType" ADD VALUE 'THEME_PURCHASE';
ALTER TYPE "WalletTxType" ADD VALUE 'DAILY_BONUS';
ALTER TYPE "WalletTxType" ADD VALUE 'SIGNUP_BONUS';

-- AlterTable
ALTER TABLE "user_profiles" ALTER COLUMN "banner_theme" SET DEFAULT 'midnight-bus-stop';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_daily_bonus" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 200,
    "category" TEXT NOT NULL DEFAULT 'game',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_themes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme_id" TEXT NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_themes_user_id_idx" ON "user_themes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_themes_user_id_theme_id_key" ON "user_themes"("user_id", "theme_id");

-- AddForeignKey
ALTER TABLE "user_themes" ADD CONSTRAINT "user_themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_themes" ADD CONSTRAINT "user_themes_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
