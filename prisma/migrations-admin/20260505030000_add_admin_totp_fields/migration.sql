-- Add TOTP state used by admin-auth-service 2FA flows.
ALTER TABLE "admins"
  ADD COLUMN "totpSecret" VARCHAR(255),
  ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
