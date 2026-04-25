-- AlterEnum
ALTER TYPE "Venue" ADD VALUE 'POLYMARKET_US';

-- AlterTable: add polymarket_us_connected and country to users
ALTER TABLE "users"
  ADD COLUMN "polymarket_us_connected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "country" VARCHAR(2);

-- CreateTable: polymarket_us_credentials (Ed25519 keys for US API)
CREATE TABLE "polymarket_us_credentials" (
    "userId" TEXT NOT NULL,
    "secretKeyCt" BYTEA NOT NULL,
    "secretKeyIv" BYTEA NOT NULL,
    "secretKeyTag" BYTEA NOT NULL,
    "keyId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polymarket_us_credentials_pkey" PRIMARY KEY ("userId")
);
