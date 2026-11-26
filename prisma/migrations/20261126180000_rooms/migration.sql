-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "maxPlayers" INTEGER NOT NULL DEFAULT 2,
    "turnSeconds" INTEGER,
    "turnSeat" INTEGER,
    "turnDeadline" TIMESTAMP(3),
    "state" JSONB,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "RoomMove" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "seat" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_gameId_code_idx" ON "Room"("gameId", "code");

-- CreateIndex
CREATE INDEX "Room_status_expiresAt_idx" ON "Room"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_seat_key" ON "RoomPlayer"("roomId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMove_roomId_seq_key" ON "RoomMove"("roomId", "seq");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMove" ADD CONSTRAINT "RoomMove_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
