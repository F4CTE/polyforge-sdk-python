-- Add `status` column to audit_logs for explicit attempt/success/failure tracking.
-- This enables a retry-safe two-row audit pattern:
--   1. Write audit row with status='attempt' BEFORE the side effect
--   2. Execute the side effect
--   3. Write audit row with status='success' AFTER the side effect
-- If audit persistence fails, the attempt row provides evidence the
-- operation was at least attempted, even for non-idempotent side effects
-- (email sends, notification broadcasts) that cannot be rolled back.
--
-- Existing rows default to 'success' for backward compatibility.

ALTER TABLE "audit_logs"
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'success';

-- Update the insert-only prevention trigger to include the new `status` column.
-- Without this, the trigger would allow updating status on existing rows
-- (since it wasn't part of the column equality check).
-- This is a full replacement of the function defined in the prior migration
-- (20260513000000_add_audit_logs_insert_only_rule) preserving both FK-driven
-- allow-paths: ON DELETE SET NULL and ON UPDATE CASCADE.

CREATE OR REPLACE FUNCTION audit_logs_prevent_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow FK-driven SET NULL only when admin deletion triggers
  -- ON DELETE SET NULL (audit_logs_adminId_fkey) and no other
  -- column was tampered with.
  IF OLD."adminId" IS NOT NULL
     AND NEW."adminId" IS NULL
     AND OLD."id" = NEW."id"
     AND OLD."action" = NEW."action"
     AND OLD."status" = NEW."status"
     AND OLD."targetType" = NEW."targetType"
     AND OLD."targetId" IS NOT DISTINCT FROM NEW."targetId"
     AND OLD."payload" IS NOT DISTINCT FROM NEW."payload"
     AND OLD."ip" = NEW."ip"
     AND OLD."createdAt" = NEW."createdAt" THEN
    IF NOT EXISTS (SELECT 1 FROM admins WHERE id = OLD."adminId") THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Allow FK-driven adminId CASCADE when a parent admin row id is
  -- updated (audit_logs_adminId_fkey has ON UPDATE CASCADE).  The
  -- old admin row no longer exists because the FK cascade runs in
  -- the same transaction as the UPDATE on admins.  Direct tampering
  -- (changing adminId while the old admin still exists) is rejected.
  IF OLD."adminId" IS NOT NULL
     AND NEW."adminId" IS NOT NULL
     AND OLD."adminId" != NEW."adminId"
     AND OLD."id" = NEW."id"
     AND OLD."action" = NEW."action"
     AND OLD."status" = NEW."status"
     AND OLD."targetType" = NEW."targetType"
     AND OLD."targetId" IS NOT DISTINCT FROM NEW."targetId"
     AND OLD."payload" IS NOT DISTINCT FROM NEW."payload"
     AND OLD."ip" = NEW."ip"
     AND OLD."createdAt" = NEW."createdAt" THEN
    IF NOT EXISTS (SELECT 1 FROM admins WHERE id = OLD."adminId")
       AND EXISTS (SELECT 1 FROM admins WHERE id = NEW."adminId") THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Suppress all other application-level updates
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
