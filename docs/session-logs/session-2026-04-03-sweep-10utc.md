# Issue Sweep — 2026-04-03 10:00 UTC

## Workflow
ISSUE SWEEP (hour 10 UTC)

## Audit Summary

Full security and design token scan of the entire codebase.

### Security Scan: CLEAN
All 9 OWASP categories scanned — no active vulnerabilities found:
- SQL injection: All queries use `Prisma.sql` tagged templates
- Code injection: No `eval()`, `new Function()` — safe parser in place (v6.35.12)
- XSS: No `innerHTML`; `dangerouslySetInnerHTML` only for safe schema.org data
- Hardcoded secrets: None; `rejectPlaceholderSecrets()` validates at startup
- Input validation: All controllers enforce JWT auth + class-validator DTOs
- CORS: Whitelist-based, credentials required
- Rate limiting: Global 120 req/min + per-endpoint throttling
- Path traversal: No `fs` ops on user-supplied paths
- Auth/authz: JWT with 15min expiry, refresh rotation, account lockout

### Design Token Scan
| Category | Count | Status |
|----------|-------|--------|
| shadow-2xl (not pf) | 1 | **Fixed this session** |
| text-[11px] arbitrary | 1 | **Fixed this session** |
| Inline styles | 96 | Pre-existing (mostly dynamic CSS vars — acceptable) |
| rounded-full | 0 | All migrated to pf tokens |
| text-black / bg-black | 0 | All migrated to pf tokens |

## Shipped

**Branch: `fix/issues-design-token-cleanup-batch`**
- `tooltip-tour.tsx`: `shadow-2xl` → `shadow-pf-2xl`
- `badge.tsx`: `text-[11px]` → `text-pf-label` (11px design token)
- CHANGELOG.md updated (v6.35.13)

## Quality Gates
- Lint: PASS (0 errors, 3164 warnings — pre-existing)
- Typecheck (user-app): PASS
- Build (user-app, admin-app): PASS
- Pre-existing failures: shared-db (Prisma types — no PostgreSQL in env)

## Issues Closed by Commit History (main)
#3, #6, #7, #8, #56, #57, #58, #59, #61, #70, #75, #78, #79, #80

## Remaining Open Work
### Main Repo
- 96 inline styles across 33 files (most are dynamic CSS vars, acceptable)
- 232+ `any` type assertions (tracked for future cleanup)

### Cross-Repo (from previous session notes)
- SSRF blocklist gaps: sdk-python #7, sdk-ts #6, sdk-rust #10
- Compatibility/breaking issues across SDK repos
- Design issues #37-#67 (19 open, mostly token-related)

## Next Session Focus
1. Continue cross-repo SDK fixes (SSRF blocklist pattern)
2. Monitor for new audit agent issues (nightly agents at 2-4 UTC)
3. Merge ready PRs at evening review (18 UTC)
