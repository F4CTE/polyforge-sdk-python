-- Add backup codes column to admins table for TOTP recovery.
ALTER TABLE "admins"
  ADD COLUMN "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
