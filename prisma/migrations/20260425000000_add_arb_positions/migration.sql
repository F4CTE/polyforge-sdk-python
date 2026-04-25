-- CreateEnum
CREATE TYPE "ArbPositionStatus" AS ENUM ('PENDING', 'PARTIAL', 'OPEN', 'CLOSING', 'CLOSED', 'FAILED');

-- CreateTable
CREATE TABLE "arb_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" VARCHAR(255) NOT NULL,
    "status" "ArbPositionStatus" NOT NULL DEFAULT 'PENDING',
    "buyVenue" "Venue" NOT NULL,
    "buyOrderId" VARCHAR(255),
    "buyTokenId" VARCHAR(255) NOT NULL,
    "buyPrice" DECIMAL(10,6) NOT NULL,
    "buySize" DECIMAL(20,6) NOT NULL,
    "buyFillPrice" DECIMAL(10,6),
    "buyFillSize" DECIMAL(20,6),
    "sellVenue" "Venue" NOT NULL,
    "sellOrderId" VARCHAR(255),
    "sellTokenId" VARCHAR(255) NOT NULL,
    "sellPrice" DECIMAL(10,6) NOT NULL,
    "sellSize" DECIMAL(20,6) NOT NULL,
    "sellFillPrice" DECIMAL(10,6),
    "sellFillSize" DECIMAL(20,6),
    "entrySpreadPct" DECIMAL(8,4) NOT NULL,
    "currentSpreadPct" DECIMAL(8,4),
    "realizedPnl" DECIMAL(20,6),
    "unrealizedPnl" DECIMAL(20,6),
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arb_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arb_positions_userId_status_idx" ON "arb_positions"("userId", "status");

-- CreateIndex
CREATE INDEX "arb_positions_matchId_idx" ON "arb_positions"("matchId");

-- CreateIndex
CREATE INDEX "arb_positions_status_idx" ON "arb_positions"("status");

-- CreateIndex
CREATE INDEX "arb_positions_createdAt_idx" ON "arb_positions"("createdAt");

-- AddForeignKey
ALTER TABLE "arb_positions" ADD CONSTRAINT "arb_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
