-- Fix AdminSession FK: RESTRICT → CASCADE (matches Prisma schema onDelete)
-- When an admin is deleted, their sessions should be cleaned up automatically.
ALTER TABLE "admin_sessions" DROP CONSTRAINT "admin_sessions_adminId_fkey";

ALTER TABLE "admin_sessions"
  ADD CONSTRAINT "admin_sessions_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "admins"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix AuditLog FK: RESTRICT → SET NULL (matches Prisma schema onDelete)
-- SECURITY: Preserves the append-only audit trail when admins are deleted.
-- audit_logs rows remain intact with adminId set to NULL, preventing
-- audit trail corruption that would occur if records were deleted to
-- work around a RESTRICT constraint.
ALTER TABLE "audit_logs" ALTER COLUMN "adminId" DROP NOT NULL;

ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_adminId_fkey";

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "admins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
