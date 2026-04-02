-- AlterTable: add kekVersion to user_credentials for KEK rotation tracking
ALTER TABLE "user_credentials" ADD COLUMN "kekVersion" SMALLINT NOT NULL DEFAULT 1;
