-- Backfill existing copy_configs.targetWallet values to a consistent canonical
-- form.  New writes are EIP-55 checksummed by copy.service.ts (PR #1318), but
-- legacy rows may contain arbitrary casing that breaks case-sensitive consumers
-- (analytics, leaderboards, direct DB queries).
--
-- We use LOWER() instead of an EIP-55 pass (which requires keccak256) because:
--   1. Pure SQL — no application dependency
--   2. All lookups use {equals, mode:"insensitive"} which maps to LOWER() on
--      the already-existing functional index CopyConfig_targetWallet_lower_idx
--   3. The Prisma @@unique([userId, targetWallet]) constraint is case-sensitive;
--      lowering guarantees all rows for the same wallet share the same value
--      and the unique constraint works correctly.
--
-- The UNIQUE constraint will reject collisions only if a user already has two
-- rows whose targetWallet differ only in case — the service-level duplicate
-- check in copy.service.ts prevents new collisions, but a historical one could
-- block this migration.  If it fails with a unique-violation, manually merge
-- the duplicate rows before re-running.

UPDATE "copy_configs"
   SET "targetWallet" = lower("targetWallet")
 WHERE "targetWallet" <> lower("targetWallet");
