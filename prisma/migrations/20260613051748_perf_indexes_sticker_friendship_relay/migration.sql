-- DropIndex
DROP INDEX "Friendship_receiverId_idx";

-- DropIndex
DROP INDEX "Sticker_filledBy_idx";

-- CreateIndex
CREATE INDEX "Friendship_receiverId_status_idx" ON "Friendship"("receiverId", "status");

-- CreateIndex
CREATE INDEX "RelayParticipant_boardId_idx" ON "RelayParticipant"("boardId");

-- CreateIndex
CREATE INDEX "Sticker_filledBy_filledAt_idx" ON "Sticker"("filledBy", "filledAt");
