-- CreateEnum (idempotent — may already exist if migration was partially applied)
DO $$ BEGIN
  CREATE TYPE "whale_classification" AS ENUM ('UNKNOWN', 'RETAIL_WHALE', 'MARKET_MAKER', 'TOP_100', 'SMART_MONEY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: add classification + label to whale_profiles (idempotent)
ALTER TABLE "whale_profiles" ADD COLUMN IF NOT EXISTS "classification" "whale_classification" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "whale_profiles" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);

-- CreateTable: whale_alert_filters
CREATE TABLE IF NOT EXISTS "whale_alert_filters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minSize" DECIMAL(20,6),
    "marketIds" TEXT[],
    "walletAddresses" TEXT[],
    "sides" "OrderSide"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whale_alert_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "whale_alert_filters_userId_key" ON "whale_alert_filters"("userId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "whale_alert_filters" ADD CONSTRAINT "whale_alert_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
