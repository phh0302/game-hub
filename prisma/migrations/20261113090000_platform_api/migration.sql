-- CreateEnum
CREATE TYPE "ApiKeyKind" AS ENUM ('PUBLISHABLE', 'SECRET');

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "gameId" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" "ApiKeyKind" NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_gameId_idx" ON "ApiKey"("gameId");

-- CreateIndex
CREATE INDEX "AuthSession_gameId_idx" ON "AuthSession"("gameId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
