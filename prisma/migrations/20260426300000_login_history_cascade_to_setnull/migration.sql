-- AlterTable: make userId nullable to support SetNull on user deletion
ALTER TABLE "user_login_history" ALTER COLUMN "userId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "user_login_history" DROP CONSTRAINT "user_login_history_userId_fkey";

-- AddForeignKey with SET NULL
ALTER TABLE "user_login_history"
  ADD CONSTRAINT "user_login_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
