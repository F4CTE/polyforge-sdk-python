-- Backfill existing copy_configs.targetWallet values to a consistent canonical
-- form.  The backfill normalizes legacy rows to lowercase while new writes from
-- CopyService.create() store EIP-55 checksummed addresses (via
-- checksumEthereumAddress()).  Mixed casing is safe in practice because all
-- application-layer lookups use {equals, mode:"insensitive"} — both case forms
-- match identically via the CopyConfig_targetWallet_lower_idx functional index.
--
-- Legacy rows may contain arbitrary casing that breaks case-sensitive consumers
-- (analytics, leaderboards, direct DB queries).
--
-- We canonicalize to LOWER() (rather than EIP-55, which requires keccak256)
-- because:
--   1. Pure SQL — no application dependency
--   2. All lookups use {equals, mode:"insensitive"} which maps to LOWER() on
--      the already-existing functional index CopyConfig_targetWallet_lower_idx
--   3. The Prisma @@unique([userId, targetWallet]) constraint is case-sensitive;
--      lowering guarantees legacy rows for the same wallet share the same value
--      and the unique constraint works correctly.

-- Step 1: Resolve case-colliding duplicates that would violate the unique
-- constraint after lowercasing.  When a user has multiple rows whose
-- targetWallet differs only in case (e.g. 0xAbc... and 0xabc...), keep the
-- oldest config (by createdAt) and reassign the newer duplicates' copy_trades
-- to the keeper before deleting the duplicates.  This avoids data loss from
-- the ON DELETE CASCADE on CopyTrade.config → CopyConfig.
--
-- CopyTrade.config uses onDelete: Cascade (prisma/schema.prisma:1154), so
-- without this step, deleting duplicate config rows would also delete all
-- associated trade history.

WITH
    grouped AS (
        SELECT
            id,
            "userId",
            lower("targetWallet") AS lower_wallet,
            row_number() OVER (
                PARTITION BY "userId", lower("targetWallet")
                ORDER BY "createdAt" ASC, id ASC
            ) AS rn
        FROM "copy_configs"
    ),
    keeper AS (
        SELECT id, "userId", lower_wallet
          FROM grouped
         WHERE rn = 1
    ),
    duplicate AS (
        SELECT g.id AS duplicate_id, k.id AS keeper_id
          FROM grouped g
          JOIN keeper k
            ON k."userId" = g."userId"
           AND k.lower_wallet = g.lower_wallet
         WHERE g.rn > 1
    )
-- Reassign trades from duplicate configs to the keeper before deletion
UPDATE "copy_trades" ct
   SET "configId" = dup.keeper_id
  FROM duplicate dup
 WHERE ct."configId" = dup.duplicate_id;

-- Step 2: Delete duplicate configs (trades already reassigned, safe to
-- cascade-remove any remaining child rows like copy-trade references).
DELETE FROM "copy_configs"
 WHERE id IN (
     SELECT duplicate_id
       FROM (
           SELECT
               id,
               row_number() OVER (
                   PARTITION BY "userId", lower("targetWallet")
                   ORDER BY "createdAt" ASC, id ASC
               ) AS rn
             FROM "copy_configs"
       ) ranked
      WHERE rn > 1
 );

-- Step 3: Normalize remaining targetWallet values to lowercase.
--
-- After steps 1–2, no two rows for the same (userId, lower(targetWallet)) pair
-- remain, so the bulk UPDATE cannot violate the @@unique constraint.

UPDATE "copy_configs"
   SET "targetWallet" = lower("targetWallet")
 WHERE "targetWallet" <> lower("targetWallet");
