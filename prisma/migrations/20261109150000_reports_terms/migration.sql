-- Phase 10: báo cáo vi phạm game + điều khoản người đăng game (chỉ THÊM, không sửa dữ liệu cũ)

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('BROKEN', 'INAPPROPRIATE', 'COPYRIGHT', 'CHEATING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedById" TEXT,
ADD COLUMN     "termsVersion" TEXT;

-- CreateTable
CREATE TABLE "GameReport" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "message" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameReport_status_createdAt_idx" ON "GameReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GameReport_gameId_status_idx" ON "GameReport"("gameId", "status");

-- CreateIndex
CREATE INDEX "GameReport_reporterId_gameId_idx" ON "GameReport"("reporterId", "gameId");

-- AddForeignKey
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
