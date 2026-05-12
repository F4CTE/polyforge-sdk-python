-- Fix remaining User FK constraints: RESTRICT → CASCADE
-- Batch migration for all 24 tables that still have ON DELETE RESTRICT
-- despite the Prisma schema declaring onDelete: Cascade on the User relation.
-- See issue POLA-3884.
--
-- Risk: Since users are soft-deleted (deleted: true), this drift has no
-- immediate runtime impact. The FK cascade would only fire if a user row is
-- actually removed (GDPR hard-erasure, test cleanup, admin action).
--
-- Follows pattern from 20260513000000 (POLA-3654).

-- ═══ Init migration tables (17 tables, 18 FK constraints) ═══

ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fkey";
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bot_connections" DROP CONSTRAINT "bot_connections_userId_fkey";
ALTER TABLE "bot_connections"
  ADD CONSTRAINT "bot_connections_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follows" DROP CONSTRAINT "follows_followerId_fkey";
ALTER TABLE "follows"
  ADD CONSTRAINT "follows_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follows" DROP CONSTRAINT "follows_followingId_fkey";
ALTER TABLE "follows"
  ADD CONSTRAINT "follows_followingId_fkey"
  FOREIGN KEY ("followingId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_limits" DROP CONSTRAINT "user_limits_userId_fkey";
ALTER TABLE "user_limits"
  ADD CONSTRAINT "user_limits_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verifications" DROP CONSTRAINT "email_verifications_userId_fkey";
ALTER TABLE "email_verifications"
  ADD CONSTRAINT "email_verifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_history" DROP CONSTRAINT "notification_history_userId_fkey";
ALTER TABLE "notification_history"
  ADD CONSTRAINT "notification_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "strategies" DROP CONSTRAINT "strategies_userId_fkey";
ALTER TABLE "strategies"
  ADD CONSTRAINT "strategies_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "strategy_likes" DROP CONSTRAINT "strategy_likes_userId_fkey";
ALTER TABLE "strategy_likes"
  ADD CONSTRAINT "strategy_likes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "strategy_comments" DROP CONSTRAINT "strategy_comments_userId_fkey";
ALTER TABLE "strategy_comments"
  ADD CONSTRAINT "strategy_comments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "positions" DROP CONSTRAINT "positions_userId_fkey";
ALTER TABLE "positions"
  ADD CONSTRAINT "positions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "paper_orders" DROP CONSTRAINT "paper_orders_userId_fkey";
ALTER TABLE "paper_orders"
  ADD CONSTRAINT "paper_orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "paper_positions" DROP CONSTRAINT "paper_positions_userId_fkey";
ALTER TABLE "paper_positions"
  ADD CONSTRAINT "paper_positions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "backtest_runs" DROP CONSTRAINT "backtest_runs_userId_fkey";
ALTER TABLE "backtest_runs"
  ADD CONSTRAINT "backtest_runs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports" DROP CONSTRAINT "reports_reporterId_fkey";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_alerts" DROP CONSTRAINT "price_alerts_userId_fkey";
ALTER TABLE "price_alerts"
  ADD CONSTRAINT "price_alerts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ Non-init migration tables (7 tables, 7 FK constraints) ═══

ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";
ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets" DROP CONSTRAINT "tickets_userId_fkey";
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whale_follows" DROP CONSTRAINT "whale_follows_userId_fkey";
ALTER TABLE "whale_follows"
  ADD CONSTRAINT "whale_follows_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copy_configs" DROP CONSTRAINT "copy_configs_userId_fkey";
ALTER TABLE "copy_configs"
  ADD CONSTRAINT "copy_configs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conditional_orders" DROP CONSTRAINT "conditional_orders_userId_fkey";
ALTER TABLE "conditional_orders"
  ADD CONSTRAINT "conditional_orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trader_scores" DROP CONSTRAINT "trader_scores_userId_fkey";
ALTER TABLE "trader_scores"
  ADD CONSTRAINT "trader_scores_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trader_badges" DROP CONSTRAINT "trader_badges_userId_fkey";
ALTER TABLE "trader_badges"
  ADD CONSTRAINT "trader_badges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
