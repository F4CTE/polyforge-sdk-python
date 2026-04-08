# Issue Sweep — 2026-04-08 02:00 UTC

## Workflow

**ISSUE SWEEP** (hour 2 UTC — all-other-hours routing)

## Open Issues Reviewed

| # | Title | Labels | Status |
|---|-------|--------|--------|
| 440 | key-rotation.service.spec.ts typecheck fails | bug, priority: high | PR #441 open |
| 393 | ThrottlerModule in-memory storage bypass | security, priority: high | PR #401 open |
| 295 | Landing hero badge non-standard CSS durations | design, priority: low | PR #438 (batch) |
| 282 | Auth-background ambient float animations | design, priority: low | PR #438 (batch) |
| 274 | Landing clamp() font sizes bypass tokens | design, priority: low | PR #438 (batch) |
| 260 | CardSkeleton duplicated across 8 pages | design, code-quality | PR #437 open |
| 258 | Strategy builder non-standard durations | design, priority: low | PR #438 (batch) |

**All 7 open issues already have PRs.** No new fix branches needed.

## Actions Taken

### Resolved merge conflicts on PR #401 (security, priority: high)

PR #401 (`fix/issue-393-throttler-redis-storage`) had **CONFLICTING** merge status due to divergence from main.

**Conflicts resolved:**
- `CHANGELOG.md` — kept both ThrottlerModule Redis entry and mathjs blocklist entry, preserved date section ordering
- `services/admin-api-service/package.json` — kept `@nest-lab/throttler-storage-redis: ^1.2.0`, updated `@nestjs/common` to `^11.1.18`
- `services/admin-auth-service/package.json` — same resolution
- `services/api-service/package.json` — same resolution
- `services/auth-service/package.json` — same resolution

Created proper merge commit (two parents) and pushed. PR #401 is now **MERGEABLE**.

### CI Status Check

- PR #401: Check ✅, Build ✅, E2E queued — now MERGEABLE
- PR #441: CI queued (recently created)
- PR #438: CI queued (design batch)
- PR #437: CI queued (CardSkeleton)
- Session log PRs #442-#444: CI queued

### Quality Gates (local, this branch)

- `pnpm lint` ✅ (17/17 packages, 0 errors)
- `pnpm typecheck` — `shared-db` fails (pre-existing: Prisma client not generated without PostgreSQL, same on main)
- `pnpm build` — `shared-db` fails (same pre-existing cause, same on main)

## Decisions Made

- Resolved PR #401 conflicts by keeping the new `@nest-lab/throttler-storage-redis` dependency while adopting main's `@nestjs/common ^11.1.18` version bump — correct approach since both changes are independent.

## Next Session Focus

1. PR #401 and #441 should have CI results — ready for merge review at 18:00 UTC
2. Design batch PRs (#437, #438) CI results
3. No new high/critical issues to address
