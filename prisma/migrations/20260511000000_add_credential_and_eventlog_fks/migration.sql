-- Ensure canary user row exists so the FK on user_credentials does not block
-- signer-service's startup canary (signer-service/src/canary/canary.service.ts).
INSERT INTO "users" ("id", "email", "username", "passwordHash", "deleted", "createdAt", "lastSeen")
VALUES ('__canary__', 'canary@polyforge.internal', 'canary_signer', '', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Clean orphaned rows before enforcing foreign keys.
-- These tables previously had no FK protection, so rows referencing deleted
-- users are a realistic state. Adding a validated FK without cleanup would
-- block the migration on existing environments.

DELETE FROM "user_credentials"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "kalshi_credentials"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "polymarket_us_credentials"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

-- event_log.userId is already nullable; set invalid references to NULL instead
-- of deleting rows so the audit trail is preserved.
UPDATE "event_log"
SET "userId" = NULL
WHERE "userId" IS NOT NULL
  AND "userId" NOT IN (SELECT "id" FROM "users");

-- AddForeignKey: user_credentials.userId -> users.id (CASCADE)
-- Previously this table had no FK, causing orphaned credentials on user deletion.
ALTER TABLE "user_credentials"
  ADD CONSTRAINT "user_credentials_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: kalshi_credentials.userId -> users.id (CASCADE)
ALTER TABLE "kalshi_credentials"
  ADD CONSTRAINT "kalshi_credentials_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: polymarket_us_credentials.userId -> users.id (CASCADE)
ALTER TABLE "polymarket_us_credentials"
  ADD CONSTRAINT "polymarket_us_credentials_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: event_log.userId -> users.id (SET NULL)
-- userId is already nullable; SET NULL preserves the audit trail on user deletion.
ALTER TABLE "event_log"
  ADD CONSTRAINT "event_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
