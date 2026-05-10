-- Functional index to support case-insensitive targetWallet lookups
-- Used by: CopyEngineService.handleWhaleTrade (hot path) and CopyService.create
--   duplicate/capacity checks — both use {equals, mode:insensitive} which maps to
--   LOWER("targetWallet") = LOWER($1) on PostgreSQL.
-- CREATE INDEX CONCURRENTLY avoids blocking INSERT/UPDATE/DELETE on copy_configs
-- during index build. Prisma migrations run outside transaction blocks by default,
-- which is required for CONCURRENTLY.
CREATE INDEX CONCURRENTLY "CopyConfig_targetWallet_lower_idx" ON "copy_configs" (lower("targetWallet"));
