-- Fix api_keys FK: RESTRICT → CASCADE (matches Prisma schema onDelete)
-- When a user is deleted, their API keys should be cleaned up automatically.
-- Prior behavior (RESTRICT) would block user deletion if API keys existed,
-- forcing a manual key revocation before the user could be deleted.
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
