-- Normalize existing user emails to lowercase so the unique index on email
-- can serve as the canonical lookup path for login, password recovery, and
-- email verification. Skipped rows (collisions or already-lowercase) are
-- intentionally left alone to avoid data loss; they will be caught by the
-- insensitive fallback in application code and auto-normalized on next login.
--
-- The collision subquery includes deleted rows so that an active mixed-case
-- row whose lowercase form matches a soft-deleted row is skipped rather than
-- violating the unique index on update.
UPDATE users
SET email = LOWER(email)
WHERE email <> LOWER(email)
  AND deleted = false
  AND LOWER(email) NOT IN (
    SELECT LOWER(u2.email)
    FROM users u2
    WHERE u2.id <> users.id
  );
