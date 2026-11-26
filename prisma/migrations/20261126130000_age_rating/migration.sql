-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('ALL', 'AGE_7', 'AGE_12', 'AGE_16', 'AGE_18');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL';
