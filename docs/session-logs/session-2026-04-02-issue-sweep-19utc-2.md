# Issue Sweep Session — 2026-04-02 19:00 UTC (2nd run)

## Workflow: D (Issue Sweep)

## Environment
- UTC hour: 19
- No `gh` CLI pre-installed (installed during session but no GitHub auth token available)
- PR creation via GitHub API not possible — branches pushed for manual PR creation
- Git proxy at 127.0.0.1:33403 functional for push/pull

## Pre-existing CI Baseline
- Lint: PASS (17/17, 0 errors)
- Typecheck: fails only on `@polyforge/shared-db` (Prisma — no PostgreSQL in environment)
- Build: fails only on `@polyforge/shared-db` dependency cascade
- App builds (vite): user-app ✓, admin-app ✓

## Assessment

Checked all remote branches from prior sessions:
- `fix/issue-76-ssrf-webhook-validation` — already pushed with SSRF, WhatsApp verify token, and webhook signature fixes
- `fix/issues-design-token-violations-batch-2` — already pushed with shadow-lg and bg-black backdrop fixes
- Issues #3, #6, #8, #59, #75 — already merged to main

## New Branches Created

### 1. `fix/issues-design-rounded-full-batch`

**Design token: `rounded-full` → `rounded-pf-full`**
- Replaced all 409 occurrences of `rounded-full` across 86 TSX files
- Covers: user-app, admin-app, landing, packages/ui
- Token `--radius-pf-full: 9999px` already defined in `@theme` block
- Zero `rounded-full` violations remain

**Cookie `sameSite` hardening**
- Changed `sameSite: 'lax'` → `sameSite: 'strict'` in `auth-service/auth.controller.ts`
- Prevents CSRF via cross-site navigation for `pf_token` and `pf_refresh` cookies

**Quality gates:** Lint 17/17 PASS, Build PASS (user-app ✓, admin-app ✓)

### 2. `fix/issues-design-text-black-batch`

**Design token: `text-black` → `text-pf-text-contrast`**
- Added `--color-pf-text-contrast: #000000` to both dark and light themes in `globals.css`
- Replaced all 73 hardcoded `text-black` instances across 49 files
- Consistent with existing token pattern (text-pf-text, text-pf-text-secondary, etc.)
- Zero `text-black` violations remain

**Quality gates:** Lint 17/17 PASS, Build PASS (user-app ✓, admin-app ✓)

## Remaining Design Token Violations
- Inline `style={}` attributes: 100+ instances (many are dynamic layout calculations — not all fixable with Tailwind)
- Arbitrary font sizes (`text-[Npx]`): 30+ instances across 20+ files

## Branches Pushed (awaiting PR creation)
| Branch | Commits | Files Changed | Status |
|--------|---------|---------------|--------|
| `fix/issues-design-rounded-full-batch` | 1 | 88 | NEW |
| `fix/issues-design-text-black-batch` | 1 | 49 | NEW |
