-- Add per-event notification preferences and email digest to NotificationPreference (closes #572)
ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "eventPrefs"   JSONB,
  ADD COLUMN IF NOT EXISTS "emailDigest"  VARCHAR(10) NOT NULL DEFAULT 'DAILY';
