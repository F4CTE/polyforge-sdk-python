-- AlterTable: add venue preferences (JSONB) and Kalshi credential flags to users
ALTER TABLE "users" ADD COLUMN "venue_preferences" JSONB;
ALTER TABLE "users" ADD COLUMN "kalshi_connected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "kalshi_user_id" VARCHAR(255);
