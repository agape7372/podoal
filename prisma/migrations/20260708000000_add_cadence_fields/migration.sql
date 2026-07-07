-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dayResetHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul';

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "cadenceN" INTEGER,
ADD COLUMN     "cadenceType" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN     "strictMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sticker" ADD COLUMN     "earlyFill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBackfill" BOOLEAN NOT NULL DEFAULT false;

