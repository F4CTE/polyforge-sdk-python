-- CreateTable
CREATE TABLE "venue_fee_schedules" (
    "id" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "category" VARCHAR(100),
    "role" VARCHAR(10) NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "minPrice" DECIMAL(10,6),
    "maxPrice" DECIMAL(10,6),
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_fee_schedules_venue_idx" ON "venue_fee_schedules"("venue");

-- CreateIndex
CREATE INDEX "venue_fee_schedules_venue_effectiveAt_idx" ON "venue_fee_schedules"("venue", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "venue_fee_schedules_venue_category_role_minPrice_maxPrice_key" ON "venue_fee_schedules"("venue", "category", "role", "minPrice", "maxPrice");

-- Seed: Polymarket fee schedule (category-based, maker 0%, taker varies)
INSERT INTO "venue_fee_schedules" ("id", "venue", "category", "role", "feeBps", "effectiveAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'POLYMARKET', NULL,       'maker', 0,   NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', NULL,       'taker', 200, NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'politics', 'taker', 100, NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'sports',   'taker', 200, NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'crypto',   'taker', 200, NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'science',  'taker', 150, NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'politics', 'maker', 0,   NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'sports',   'maker', 0,   NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'crypto',   'maker', 0,   NOW(), NOW()),
  (gen_random_uuid(), 'POLYMARKET', 'science',  'maker', 0,   NOW(), NOW());

-- Seed: Kalshi fee schedule (price-band based, no category)
-- Taker fees: higher near mid-price, lower near extremes
INSERT INTO "venue_fee_schedules" ("id", "venue", "role", "feeBps", "minPrice", "maxPrice", "effectiveAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'KALSHI', 'taker', 70,  0.01, 0.10, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'taker', 150, 0.10, 0.25, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'taker', 300, 0.25, 0.50, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'taker', 300, 0.50, 0.75, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'taker', 150, 0.75, 0.90, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'taker', 70,  0.90, 0.99, NOW(), NOW());

-- Kalshi maker fees: rebates near extremes, small fee near mid
INSERT INTO "venue_fee_schedules" ("id", "venue", "role", "feeBps", "minPrice", "maxPrice", "effectiveAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'KALSHI', 'maker', -20, 0.01, 0.10, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'maker', 0,   0.10, 0.25, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'maker', 50,  0.25, 0.50, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'maker', 50,  0.50, 0.75, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'maker', 0,   0.75, 0.90, NOW(), NOW()),
  (gen_random_uuid(), 'KALSHI', 'maker', -20, 0.90, 0.99, NOW(), NOW());
