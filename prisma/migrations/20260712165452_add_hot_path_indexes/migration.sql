-- CreateIndex
CREATE INDEX "Message_boardId_idx" ON "Message"("boardId");

-- CreateIndex
CREATE INDEX "Relay_creatorId_idx" ON "Relay"("creatorId");

-- CreateIndex
CREATE INDEX "Reminder_isActive_time_idx" ON "Reminder"("isActive", "time");

-- CreateIndex
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");

-- CreateIndex
CREATE INDEX "TimeCapsule_boardId_idx" ON "TimeCapsule"("boardId");

-- CreateIndex
CREATE INDEX "TimeCapsule_userId_openAt_idx" ON "TimeCapsule"("userId", "openAt");
