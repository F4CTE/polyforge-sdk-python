-- AlterTable: add drawdown circuit breaker fields to user_limits
ALTER TABLE "user_limits"
  ADD COLUMN "drawdown_enabled"           BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "drawdown_lookback_hours"    INTEGER   NOT NULL DEFAULT 24,
  ADD COLUMN "drawdown_threshold_pct"     DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
  ADD COLUMN "circuit_breaker_tripped"    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "circuit_breaker_tripped_at" TIMESTAMPTZ;
