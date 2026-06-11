-- CreateIndex
CREATE INDEX "Board_ownerId_idx" ON "Board"("ownerId");

-- CreateIndex
CREATE INDEX "Board_giftedToId_idx" ON "Board"("giftedToId");

-- CreateIndex
CREATE INDEX "Friendship_receiverId_idx" ON "Friendship"("receiverId");

-- CreateIndex
CREATE INDEX "Message_receiverId_createdAt_idx" ON "Message"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "RelayParticipant_userId_idx" ON "RelayParticipant"("userId");

-- CreateIndex
CREATE INDEX "Sticker_filledBy_idx" ON "Sticker"("filledBy");
