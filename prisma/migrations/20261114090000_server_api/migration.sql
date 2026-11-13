-- CreateTable
CREATE TABLE "ProjectBan" (
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBan_pkey" PRIMARY KEY ("gameId","userId")
);

-- CreateTable
CREATE TABLE "UsageDaily" (
    "gameId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "scores" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageDaily_pkey" PRIMARY KEY ("gameId","day")
);

-- CreateIndex
CREATE INDEX "ProjectBan_userId_idx" ON "ProjectBan"("userId");

-- AddForeignKey
ALTER TABLE "ProjectBan" ADD CONSTRAINT "ProjectBan_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBan" ADD CONSTRAINT "ProjectBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageDaily" ADD CONSTRAINT "UsageDaily_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
