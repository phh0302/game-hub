-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planLimits" JSONB,
ADD COLUMN     "planNote" TEXT;

-- CreateTable
CREATE TABLE "StudioUsageMonth" (
    "studioId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "scores" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "StudioUsageMonth_pkey" PRIMARY KEY ("studioId","month")
);

-- CreateTable
CREATE TABLE "StudioMonthlyPlayer" (
    "studioId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioMonthlyPlayer_pkey" PRIMARY KEY ("studioId","month","userId")
);

-- AddForeignKey
ALTER TABLE "StudioUsageMonth" ADD CONSTRAINT "StudioUsageMonth_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioMonthlyPlayer" ADD CONSTRAINT "StudioMonthlyPlayer_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
