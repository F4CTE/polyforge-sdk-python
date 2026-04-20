-- AlterTable
ALTER TABLE "strategies" ADD COLUMN "venue" "Venue" NOT NULL DEFAULT 'POLYMARKET';

-- CreateIndex
CREATE INDEX "strategies_venue_idx" ON "strategies"("venue");
