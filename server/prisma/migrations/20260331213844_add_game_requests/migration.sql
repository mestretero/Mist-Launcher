-- CreateEnum
CREATE TYPE "GameRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "game_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_title" VARCHAR(200) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "GameRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_requests_user_id_idx" ON "game_requests"("user_id");

-- CreateIndex
CREATE INDEX "game_requests_status_idx" ON "game_requests"("status");

-- AddForeignKey
ALTER TABLE "game_requests" ADD CONSTRAINT "game_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
