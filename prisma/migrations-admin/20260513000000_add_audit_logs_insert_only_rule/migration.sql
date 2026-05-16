-- Enforce append-only semantics on audit_logs at the database level.
-- The Prisma schema comment says "INSERT-only trigger/rule is already in place"
-- but no rule exists in any prior migration. This closes that gap.
--
-- SECURITY: Defense-in-depth measure. Application code (AuditService)
-- only INSERTs into audit_logs, but a compromised admin account or direct DB
-- access should not be able to tamper with the audit trail.
--
-- DELETE: Silently suppressed via DO INSTEAD NOTHING rule (no FK cascade
-- into audit_logs, so this is safe).
--
-- UPDATE: A BEFORE UPDATE trigger allows only FK-driven adminId changes
-- (ON DELETE SET NULL and ON UPDATE CASCADE) when no other column is
-- modified.  For SET NULL, the referenced admin row must no longer exist
-- (deleted in the same transaction).  For CASCADE, the old admin row must
-- no longer exist AND the new admin row must exist (renamed in the same
-- transaction).  All other application-level updates are silently
-- suppressed to preserve append-only integrity.
--
-- TRUNCATE: Rules and row-level triggers do NOT fire on TRUNCATE, so a
-- dedicated BEFORE TRUNCATE statement-level trigger raises an error to
-- prevent privileged DB access from wiping the audit trail in one command.

CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs
  DO INSTEAD NOTHING;

CREATE OR REPLACE FUNCTION audit_logs_prevent_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow FK-driven SET NULL only when admin deletion triggers
  -- ON DELETE SET NULL (audit_logs_adminId_fkey) and no other
  -- column was tampered with.
  --
  -- The field-equality check catches smuggling data changes inside
  -- the same UPDATE.  The NOT EXISTS check prevents direct NULL-ing
  -- of adminId (e.g. UPDATE audit_logs SET "adminId" = NULL): since
  -- the FK cascade runs inside the same transaction as the DELETE on
  -- admins, the referenced admin row is already gone.  If the admin
  -- still exists, this UPDATE is direct tampering and must be rejected.
  IF OLD."adminId" IS NOT NULL
     AND NEW."adminId" IS NULL
     AND OLD."id" = NEW."id"
     AND OLD."action" = NEW."action"
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

CREATE TRIGGER audit_logs_prevent_update_trigger
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_prevent_update();

-- TRUNCATE: Rules and row-level triggers do NOT fire on TRUNCATE,
-- so a dedicated statement-level trigger is required to prevent
-- privileged DB access from wiping the audit trail with a single
-- TRUNCATE audit_logs command.
CREATE OR REPLACE FUNCTION audit_logs_prevent_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE is not allowed on audit_logs (append-only table)'
    USING ERRCODE = 'read_only_sql_transaction';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_prevent_truncate_trigger
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_logs_prevent_truncate();
