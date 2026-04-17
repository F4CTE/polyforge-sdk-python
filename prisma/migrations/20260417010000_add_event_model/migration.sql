-- CreateTable
CREATE TABLE "events" (
    "id" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_endDate_idx" ON "events"("endDate" ASC);

-- AlterTable
ALTER TABLE "markets" ADD COLUMN "eventId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "markets_eventId_idx" ON "markets"("eventId");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
