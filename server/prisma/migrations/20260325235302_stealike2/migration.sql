-- AlterTable
ALTER TABLE "games" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
