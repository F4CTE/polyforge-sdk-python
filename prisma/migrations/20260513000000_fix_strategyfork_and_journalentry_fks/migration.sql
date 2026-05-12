-- DropForeignKey: strategy_forks.forkedById → users.id (RESTRICT)
-- Re-create with CASCADE so that user deletion cascades to fork records.
ALTER TABLE "strategy_forks" DROP CONSTRAINT "strategy_forks_forkedById_fkey";

ALTER TABLE "strategy_forks"
  ADD CONSTRAINT "strategy_forks_forkedById_fkey"
  FOREIGN KEY ("forkedById") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: journal_entries.userId → users.id (CASCADE)
-- Previously this table had no FK, causing orphaned journal entries on user deletion.
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: journal_entries.orderId → orders.id (CASCADE)
-- Previously this table had no FK, causing orphaned journal entries on order deletion.
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
