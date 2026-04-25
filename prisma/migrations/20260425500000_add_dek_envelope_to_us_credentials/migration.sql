-- AlterTable: Add DEK/KEK envelope columns to polymarket_us_credentials
-- Security fix: credentials must use per-user DEK, not direct master key encryption
ALTER TABLE "polymarket_us_credentials"
ADD COLUMN "encrypted_dek" BYTEA NOT NULL DEFAULT '\x00',
ADD COLUMN "dek_iv" BYTEA NOT NULL DEFAULT '\x00',
ADD COLUMN "kek_version" SMALLINT NOT NULL DEFAULT 1;

-- Remove defaults after adding columns (existing rows need re-encryption)
ALTER TABLE "polymarket_us_credentials" ALTER COLUMN "encrypted_dek" DROP DEFAULT;
ALTER TABLE "polymarket_us_credentials" ALTER COLUMN "dek_iv" DROP DEFAULT;
