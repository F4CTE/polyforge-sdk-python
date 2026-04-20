-- Phase 1: Venue abstraction foundation (POLA-401)
-- Adds Venue enum, venue columns to Market/Order/Position,
-- venueOrderId to Order, and new MarketMatch + KalshiCredential tables.

-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('POLYMARKET', 'KALSHI');

-- AlterTable: markets — add venue column (default POLYMARKET, backward-compat)
ALTER TABLE "markets" ADD COLUMN "venue" "Venue" NOT NULL DEFAULT 'POLYMARKET';
CREATE INDEX "markets_venue_idx" ON "markets"("venue");

-- AlterTable: orders — add venue + venueOrderId columns
ALTER TABLE "orders" ADD COLUMN "venue" "Venue" NOT NULL DEFAULT 'POLYMARKET';
ALTER TABLE "orders" ADD COLUMN "venueOrderId" VARCHAR(255);
CREATE INDEX "orders_venue_idx" ON "orders"("venue");
CREATE INDEX "orders_venueOrderId_idx" ON "orders"("venueOrderId");

-- AlterTable: positions — add venue column (default POLYMARKET)
ALTER TABLE "positions" ADD COLUMN "venue" "Venue" NOT NULL DEFAULT 'POLYMARKET';

-- CreateTable: market_matches — cross-venue event correlation
CREATE TABLE "market_matches" (
    "id" TEXT NOT NULL,
    "polymarketId" VARCHAR(255) NOT NULL,
    "kalshiId" VARCHAR(255) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "matchMethod" VARCHAR(50) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_matches_polymarketId_kalshiId_key" ON "market_matches"("polymarketId", "kalshiId");
CREATE INDEX "market_matches_polymarketId_idx" ON "market_matches"("polymarketId");
CREATE INDEX "market_matches_kalshiId_idx" ON "market_matches"("kalshiId");

-- CreateTable: kalshi_credentials — RSA keys for Kalshi JWT auth (signer-service only)
CREATE TABLE "kalshi_credentials" (
    "userId" TEXT NOT NULL,
    "privateKeyCt" BYTEA NOT NULL,
    "privateKeyIv" BYTEA NOT NULL,
    "privateKeyTag" BYTEA NOT NULL,
    "keyId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kalshi_credentials_pkey" PRIMARY KEY ("userId")
);
