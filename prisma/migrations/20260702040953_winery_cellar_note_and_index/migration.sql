-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "cellarNote" TEXT;

-- CreateIndex
CREATE INDEX "Board_ownerId_isCompleted_completedAt_idx" ON "Board"("ownerId", "isCompleted", "completedAt");
