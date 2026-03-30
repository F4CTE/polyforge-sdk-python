-- AlterTable: add drawdown circuit breaker fields to user_limits
ALTER TABLE "user_limits"
  ADD COLUMN "drawdownEnabled"         BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "drawdownLookbackHours"   INTEGER      NOT NULL DEFAULT 24,
  ADD COLUMN "drawdownThresholdPct"    DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
  ADD COLUMN "circuitBreakerTripped"   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "circuitBreakerTrippedAt" TIMESTAMPTZ;
