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
-- Step 1: Resolve case-colliding duplicates that would violate the unique
-- constraint after lowercasing.  When a user has multiple rows whose
-- targetWallet differs only in case, keep the oldest (by createdAt) and
-- delete the others so the bulk UPDATE in step 2 can complete without a
-- unique-violation error.

WITH
    ranked AS (
        SELECT
            id,
            "userId",
            row_number() OVER (
                PARTITION BY "userId", lower("targetWallet")
                ORDER BY "createdAt" ASC, id ASC
            ) AS rn
        FROM "copy_configs"
        WHERE "targetWallet" <> lower("targetWallet")
    ),
    duplicates AS (
        SELECT id FROM ranked WHERE rn > 1
    )
DELETE FROM "copy_configs"
WHERE id IN (SELECT id FROM duplicates);

-- Step 2: Normalize remaining rows to lowercase.
--
-- After step 1, no two rows for the same (userId, lower(targetWallet)) pair
-- remain, so the bulk UPDATE cannot violate the @@unique constraint.

UPDATE "copy_configs"
   SET "targetWallet" = lower("targetWallet")
 WHERE "targetWallet" <> lower("targetWallet");
