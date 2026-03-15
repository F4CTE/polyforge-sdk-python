-- Critical indexes for query performance
-- Generated: 2026-03-16

-- strategies
CREATE INDEX IF NOT EXISTS "strategies_userId_idx" ON "strategies"("userId");
CREATE INDEX IF NOT EXISTS "strategies_status_idx" ON "strategies"("status");
CREATE INDEX IF NOT EXISTS "strategies_userId_status_idx" ON "strategies"("userId", "status");
CREATE INDEX IF NOT EXISTS "strategies_template_idx" ON "strategies"("template");

-- orders
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders"("userId");
CREATE INDEX IF NOT EXISTS "orders_userId_status_idx" ON "orders"("userId", "status");
CREATE INDEX IF NOT EXISTS "orders_strategyId_idx" ON "orders"("strategyId");
CREATE INDEX IF NOT EXISTS "orders_tokenId_idx" ON "orders"("tokenId");
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders"("createdAt" DESC);

-- positions
CREATE INDEX IF NOT EXISTS "positions_userId_idx" ON "positions"("userId");
CREATE INDEX IF NOT EXISTS "positions_tokenId_idx" ON "positions"("tokenId");

-- paper_orders
CREATE INDEX IF NOT EXISTS "paper_orders_userId_idx" ON "paper_orders"("userId");
CREATE INDEX IF NOT EXISTS "paper_orders_userId_status_idx" ON "paper_orders"("userId", "status");

-- backtest_runs
CREATE INDEX IF NOT EXISTS "backtest_runs_userId_idx" ON "backtest_runs"("userId");
CREATE INDEX IF NOT EXISTS "backtest_runs_strategyId_idx" ON "backtest_runs"("strategyId");

-- price_alerts
CREATE INDEX IF NOT EXISTS "price_alerts_userId_idx" ON "price_alerts"("userId");
CREATE INDEX IF NOT EXISTS "price_alerts_tokenId_triggered_idx" ON "price_alerts"("tokenId", "triggered");

-- markets
CREATE INDEX IF NOT EXISTS "markets_category_idx" ON "markets"("category");
CREATE INDEX IF NOT EXISTS "markets_closed_idx" ON "markets"("closed");
CREATE INDEX IF NOT EXISTS "markets_seriesSlug_idx" ON "markets"("seriesSlug");

-- price_snapshots (TimescaleDB — use regular index, not composite with sort)
CREATE INDEX IF NOT EXISTS "price_snapshots_tokenId_time_idx" ON "price_snapshots"("tokenId", "time" DESC);

-- pnl_snapshots (TimescaleDB)
CREATE INDEX IF NOT EXISTS "pnl_snapshots_userId_time_idx" ON "pnl_snapshots"("userId", "time" DESC);

-- user_login_history
CREATE INDEX IF NOT EXISTS "user_login_history_userId_createdAt_idx" ON "user_login_history"("userId", "createdAt" DESC);

-- event_log
CREATE INDEX IF NOT EXISTS "event_log_userId_idx" ON "event_log"("userId");
CREATE INDEX IF NOT EXISTS "event_log_eventType_idx" ON "event_log"("eventType");
CREATE INDEX IF NOT EXISTS "event_log_createdAt_idx" ON "event_log"("createdAt" DESC);
