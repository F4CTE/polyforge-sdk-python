-- CreateEnum
CREATE TYPE "SmartOrderType" AS ENUM ('TWAP', 'DCA', 'BRACKET', 'OCO');
CREATE TYPE "SmartOrderStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DELISTED');

-- AlterTable: add smartOrderId to orders
ALTER TABLE "orders" ADD COLUMN "smartOrderId" TEXT;

-- CreateTable: smart_orders
CREATE TABLE "smart_orders" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "type"           "SmartOrderType" NOT NULL,
    "status"         "SmartOrderStatus" NOT NULL DEFAULT 'PENDING',
    "marketId"       VARCHAR(255) NOT NULL,
    "tokenId"        VARCHAR(255) NOT NULL,
    "outcome"        "OrderOutcome" NOT NULL,
    "side"           "OrderSide" NOT NULL,
    "totalSize"      DECIMAL(20,6) NOT NULL,
    "config"         JSONB NOT NULL,
    "slicesFilled"   INTEGER NOT NULL DEFAULT 0,
    "slicesTotal"    INTEGER NOT NULL DEFAULT 1,
    "totalFilled"    DECIMAL(20,6) NOT NULL DEFAULT 0,
    "avgFillPrice"   DECIMAL(10,6) NOT NULL DEFAULT 0,
    "nextExecuteAt"  TIMESTAMPTZ,
    "completedAt"    TIMESTAMPTZ,
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "smart_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "smart_orders_userId_status_idx" ON "smart_orders"("userId", "status");
CREATE INDEX "smart_orders_nextExecuteAt_idx" ON "smart_orders"("nextExecuteAt");
CREATE INDEX "orders_smartOrderId_idx" ON "orders"("smartOrderId");

ALTER TABLE "smart_orders" ADD CONSTRAINT "smart_orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_smartOrderId_fkey"
    FOREIGN KEY ("smartOrderId") REFERENCES "smart_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: marketplace_listings
CREATE TABLE "marketplace_listings" (
    "id"             TEXT NOT NULL,
    "strategyId"     TEXT NOT NULL,
    "sellerId"       TEXT NOT NULL,
    "title"          VARCHAR(255) NOT NULL,
    "description"    TEXT,
    "priceUsdc"      DECIMAL(20,6) NOT NULL,
    "status"         "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "forkCount"      INTEGER NOT NULL DEFAULT 0,
    "platformFeePct" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "tags"           TEXT[] NOT NULL DEFAULT '{}',
    "purchaseCount"  INTEGER NOT NULL DEFAULT 0,
    "totalRevenue"   DECIMAL(20,6) NOT NULL DEFAULT 0,
    "avgRating"      DECIMAL(3,2),
    "ratingCount"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_listings_strategyId_key" ON "marketplace_listings"("strategyId");
CREATE INDEX "marketplace_listings_sellerId_status_idx" ON "marketplace_listings"("sellerId", "status");

ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_strategyId_fkey"
    FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: marketplace_purchases
CREATE TABLE "marketplace_purchases" (
    "id"               TEXT NOT NULL,
    "listingId"        TEXT NOT NULL,
    "buyerId"          TEXT NOT NULL,
    "forkedStrategyId" TEXT,
    "priceUsdc"        DECIMAL(20,6) NOT NULL,
    "platformFee"      DECIMAL(20,6) NOT NULL,
    "sellerNet"        DECIMAL(20,6) NOT NULL,
    "rating"           INTEGER,
    "review"           TEXT,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "marketplace_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_purchases_listingId_buyerId_key" ON "marketplace_purchases"("listingId", "buyerId");
CREATE INDEX "marketplace_purchases_buyerId_idx" ON "marketplace_purchases"("buyerId");
CREATE INDEX "marketplace_purchases_listingId_idx" ON "marketplace_purchases"("listingId");

ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
