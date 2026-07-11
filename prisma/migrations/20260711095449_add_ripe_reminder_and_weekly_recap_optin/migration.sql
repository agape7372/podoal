-- AlterTable
ALTER TABLE "NotificationSetting" ADD COLUMN     "weeklyRecapEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'time';
