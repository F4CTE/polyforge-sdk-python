-- CreateTable
CREATE TABLE "arbitrage_snapshots" (
    "id" TEXT NOT NULL,
    "matchId" VARCHAR(255) NOT NULL,
    "spreadPct" DECIMAL(8,4) NOT NULL,
    "direction" VARCHAR(30) NOT NULL,
    "polyYes" DECIMAL(10,6) NOT NULL,
    "kalshiYes" DECIMAL(10,6) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arbitrage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minSpreadPct" DECIMAL(8,4) NOT NULL,
    "marketId" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arbitrage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arbitrage_snapshots_matchId_idx" ON "arbitrage_snapshots"("matchId");

-- CreateIndex
CREATE INDEX "arbitrage_snapshots_scannedAt_idx" ON "arbitrage_snapshots"("scannedAt");

-- CreateIndex
CREATE INDEX "arbitrage_alerts_userId_active_idx" ON "arbitrage_alerts"("userId", "active");

-- AddForeignKey
ALTER TABLE "arbitrage_alerts" ADD CONSTRAINT "arbitrage_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
