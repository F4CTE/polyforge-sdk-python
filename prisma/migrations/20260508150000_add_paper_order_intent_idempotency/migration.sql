-- Add nullable intentId so existing rows can be backfilled
ALTER TABLE "paper_orders" ADD COLUMN "intentId" VARCHAR(128);

-- Backfill existing rows with a generated UUID (format: backfill-{paper_order_id})
UPDATE "paper_orders" SET "intentId" = CONCAT('backfill-', "id") WHERE "intentId" IS NULL;

-- Now set NOT NULL and UNIQUE
ALTER TABLE "paper_orders" ALTER COLUMN "intentId" SET NOT NULL;
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_intentId_key" UNIQUE ("intentId");

-- Add tracking columns for Redis effects retry safety
ALTER TABLE "paper_orders" ADD COLUMN "fillCompletedAt" TIMESTAMP(3);
ALTER TABLE "paper_orders" ADD COLUMN "realizedPnl" DECIMAL(20, 6) NOT NULL DEFAULT 0;
ALTER TABLE "paper_orders" ADD COLUMN "redisEffectsApplied" BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing paper orders as completed (already processed, Redis effects already applied)
UPDATE "paper_orders" SET "fillCompletedAt" = "createdAt", "redisEffectsApplied" = TRUE;
