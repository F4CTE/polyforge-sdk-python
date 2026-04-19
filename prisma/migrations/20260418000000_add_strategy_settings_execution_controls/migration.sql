-- Phase 2: Strategy settings & execution controls (POLA-192)
-- Adds warmup period, schedule-based execution, and profit target/loss limit settings

ALTER TABLE "strategies" ADD COLUMN "warmupTicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "strategies" ADD COLUMN "schedule" JSONB;
ALTER TABLE "strategies" ADD COLUMN "settings" JSONB;
