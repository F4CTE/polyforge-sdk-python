# Issue Sweep — 2026-04-05 23:00 UTC

## Workflow
ISSUE SWEEP (hour 23 UTC)

## Open Issues Scanned
17 open issues total:
- 0 critical, 0 high
- 3 security + medium (#264, #265, #266)
- 3 design + medium (#252, #253, #256)
- 11 design (low/no priority)

## PRs Created

### PR #267 — fix(security): .env.example credentials (closes #266)
- **Branch:** `fix/issue-266-env-credentials`
- **Changes:** Replaced `devpass`, `devpass_admin`, `devredispass` with `<GENERATE_ME>` placeholders; added `devpass`/`devredis`/`<GENERATE_ME>` to `rejectPlaceholderSecrets()` startup guard; added generation instructions at top of `.env.example`

### PR #268 — fix(gateway): nginx $host + H2C smuggling (closes #264, closes #265)
- **Branch:** `fix/issues-264-265-nginx-security`
- **Changes:**
  - Replaced `$host` with `$server_name` in all HTTP→HTTPS redirects and `X-Forwarded-Host` headers across 4 nginx configs
  - Added `proxy_set_header Upgrade ""` to all non-WebSocket locations across 4 nginx configs

## Quality Gates
- `pnpm lint` ✅ (0 errors, 3164 warnings — all pre-existing)
- `pnpm typecheck` ⚠️ pre-existing failure in `shared-db` (missing Prisma client — no PostgreSQL in env)
- `pnpm build` ⚠️ pre-existing failure in `shared-db` (same root cause)

## Pre-existing Issues Noted
- `shared-db` typecheck/build fails due to missing `.prisma/client` — needs `prisma generate` which requires a database connection

## Next Session Focus
1. Merge #267 and #268 if CI green (PR review session at 18 UTC)
2. Pick up medium design issues (#252, #253, #256)
3. Address remaining 11 low-priority design issues
