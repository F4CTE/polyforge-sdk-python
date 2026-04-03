# Issue Sweep — 2026-04-03 09:00 UTC

## Workflow
ISSUE SWEEP (hour 9 UTC)

## Audit Summary
Scanned entire codebase for security, design token, and code quality issues.

### Findings
1. **CRITICAL — `new Function()` code injection** in `apps/user-app/src/components/builder/nodes/variable-node.tsx:33`
   - `new Function("use strict"; return (${expression}))()` used for expression preview
   - Regex whitelist `[\d\s+\-*/().%]+` is insufficient guard against code injection
   - Replaced with safe recursive-descent arithmetic parser (no dynamic code generation)

2. **Design token `text-white`** — 25+ instances across admin-app and user-app
   - All on accent backgrounds (bg-pf-danger, bg-pf-success, bg-pf-cyan-500, bg-pf-warning)
   - White text on colored backgrounds is correct in both themes — no token needed
   - **No action required**

3. **Design token `bg-white`** — 9 instances
   - Toggle switch thumbs (4): standard shadcn pattern, needs white contrast in both themes
   - QR code background (1): functional requirement for scanability
   - `bg-white/4` and `bg-white/20` overlays: translucent effects, acceptable
   - **No action required**

4. **`any` type assertions** — 232+ instances across services (pre-existing)
   - Tracked for future cleanup, not blocking

5. **Pre-existing build failures** — `shared-db` (no Prisma types without DB), landing (no network for Google Fonts)

## Shipped
- fix(security): replace `new Function()` with safe arithmetic parser in variable-node.tsx

## Quality Gates
- Lint: PASS (0 errors)
- Typecheck (user-app): PASS
- Build (user-app): PASS
- Pre-existing failures: shared-db (Prisma types), landing (Google Fonts network)

## Next Session Focus
1. Check for new audit issues from nightly agents
2. Fix remaining `any` type assertions in critical auth/strategy paths
3. Monitor open PRs for CI failures
