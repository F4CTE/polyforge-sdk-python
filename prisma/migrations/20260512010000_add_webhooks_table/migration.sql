-- Create the webhooks table declared by model Webhook (@@map("webhooks")) in
-- prisma/schema.prisma:1276.  The table declaration was introduced alongside
-- the ApiKeyScope enum addition (20260416000000) but a CREATE TABLE migration
-- was never generated.  This migration backfills the missing DDL so that
-- `prisma migrate deploy` creates the table on fresh databases.

CREATE TABLE IF NOT EXISTS "webhooks" (
    "id"        TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "url"       VARCHAR(1000) NOT NULL,
    "events"    TEXT[]        NOT NULL,
    "secret"    VARCHAR(255)  NOT NULL,
    "active"    BOOLEAN       NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- FK: userId → users(id) with ON DELETE CASCADE, matching the Prisma
-- @relation(onDelete: Cascade) declaration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhooks_userId_fkey' AND conrelid = '"webhooks"'::regclass
  ) THEN
    ALTER TABLE "webhooks"
      ADD CONSTRAINT "webhooks_userId_fkey"
          FOREIGN KEY ("userId")
           REFERENCES "users" ("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for userId lookup matching @@index([userId]) in the schema.
CREATE INDEX IF NOT EXISTS "webhooks_userId_idx" ON "webhooks" ("userId");
