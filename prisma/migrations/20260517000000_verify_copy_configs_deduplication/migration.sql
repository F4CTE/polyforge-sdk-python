-- Verify copy_configs deduplication invariants and clean up any remaining
-- case-variant duplicates.  The original migration
-- 20260511010000_normalize_copy_configs_target_wallet_case handled
-- deduplication at the time it ran, but this migration provides a safety
-- net for environments where duplicates may persist (e.g. concurrent
-- inserts during the original migration window) and asserts two invariants
-- required by the @@unique([userId, targetWallet]) constraint:
--   (a) No duplicate (userId, lower(targetWallet)) pairs remain
--   (b) Every targetWallet value is fully lowercase
--
-- The cleanup + verification runs inside a single atomic DO block that
-- takes SHARE ROW EXCLUSIVE locks on both copy_configs and copy_trades
-- before any data manipulation:
--
--   copy_trades — prevents concurrent INSERT from
--     CopyEngineService.processCopyForConfig() between Step 1 (trade
--     reassignment) and Step 3 (duplicate deletion).  The live FK is
--     ON DELETE RESTRICT (migration 20260323190323_add_phase8_models),
--     so a new trade referencing a duplicate config inserted after Step 1
--     would block the Step 3 DELETE with a foreign-key violation.
--
--   copy_configs — prevents concurrent INSERT/UPDATE/DELETE from
--     CopyService.create() between cleanup and verification, eliminating
--     the race where a new checksummed row inserted after Step 4
--     (lowercase normalization) causes a spurious Step 5 failure, or a
--     case-variant insert before Step 4 causes the bulk UPDATE to violate
--     the @@unique constraint.
--
-- SHARE ROW EXCLUSIVE blocks ROW EXCLUSIVE (INSERT/UPDATE/DELETE) while
-- still allowing ACCESS SHARE (plain SELECT), so application reads remain
-- available.  The migration is idempotent and fast — the locks are held
-- only for the duration of the DO block.
--
-- All steps are idempotent: if no duplicates or mixed-case rows remain
-- from the previous migration, every step is a no-op and the final
-- verification passes.

DO $$
DECLARE
    duplicate_count INTEGER;
    mixed_case_count INTEGER;
BEGIN
    -- Prevent concurrent writes during the full cleanup + verification
    -- window.  Locks acquired in copy_trades→copy_configs order to match
    -- the application's table access order (CopyService.create() and
    -- CopyEngineService.processCopyForConfig() both touch copy_trades first,
    -- copy_configs second), avoiding a deadlock cycle.
    --   copy_trades lock: stops CopyEngineService.processCopyForConfig()
    --     from inserting a trade referencing a duplicate config between
    --     Step 1/3, which would block the Step 3 DELETE because the live FK
    --     is ON DELETE RESTRICT.
    --   copy_configs lock: stops CopyService.create() from inserting between
    --     Step 4/5 (spurious mixed_case_count) or Step 3/4 (unique violation
    --     on bulk UPDATE).
    LOCK TABLE "copy_trades" IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE "copy_configs" IN SHARE ROW EXCLUSIVE MODE;

    -- Step 1: Reassign copy_trades from any remaining case-variant duplicates
    -- to their keeper config (oldest by createdAt, then id).
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
    UPDATE "copy_trades" ct
       SET "configId" = dup.keeper_id
      FROM duplicate dup
     WHERE ct."configId" = dup.duplicate_id;

    -- Step 2: Merge aggregate fields (totalCopied, totalPnl) from any remaining
    -- duplicate configs into their keepers.
    WITH
        grouped_agg AS (
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
        keeper_agg AS (
            SELECT id, "userId", lower_wallet
              FROM grouped_agg
             WHERE rn = 1
        ),
        duplicate_agg AS (
            SELECT g.id AS duplicate_id, k.id AS keeper_id
              FROM grouped_agg g
              JOIN keeper_agg k
                ON k."userId" = g."userId"
               AND k.lower_wallet = g.lower_wallet
             WHERE g.rn > 1
        )
    UPDATE "copy_configs" cc
       SET "totalCopied" = cc."totalCopied" + COALESCE(agg.total_copied, 0),
           "totalPnl"    = cc."totalPnl"    + COALESCE(agg.total_pnl, 0)
      FROM (
          SELECT dup.keeper_id,
                 SUM(dcfg."totalCopied")::int AS total_copied,
                 SUM(dcfg."totalPnl")         AS total_pnl
            FROM duplicate_agg dup
            JOIN "copy_configs" dcfg ON dcfg.id = dup.duplicate_id
           GROUP BY dup.keeper_id
      ) agg
     WHERE cc.id = agg.keeper_id;

    -- Step 3: Delete any remaining duplicate configs.
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

    -- Step 4: Normalize any remaining targetWallet values to lowercase.
    -- The original migration (20260511010000) already did this, but rows
    -- inserted between the two migrations may carry EIP-55 checksummed
    -- (mixed-case) addresses from CopyService.create().  This step
    -- guarantees every surviving row is lowercase so the Step 5 casing
    -- invariant passes.
    UPDATE "copy_configs"
       SET "targetWallet" = lower("targetWallet")
     WHERE "targetWallet" <> lower("targetWallet");

    -- Step 5: Verification — assert both invariants hold after all cleanup:
    --   (a) no duplicate (userId, lower(targetWallet)) pairs
    --   (b) every targetWallet is lowercase
    SELECT count(*) INTO duplicate_count
      FROM (
          SELECT "userId", lower("targetWallet"), count(*)
            FROM "copy_configs"
           GROUP BY "userId", lower("targetWallet")
          HAVING count(*) > 1
      ) dupes;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Migration verification failed: % duplicate (userId, lower(targetWallet)) pairs remain after deduplication', duplicate_count;
    END IF;

    SELECT count(*) INTO mixed_case_count
      FROM "copy_configs"
     WHERE "targetWallet" <> lower("targetWallet");

    IF mixed_case_count > 0 THEN
        RAISE EXCEPTION 'Migration verification failed: % rows have mixed-case targetWallet after normalization', mixed_case_count;
    END IF;
END $$;
