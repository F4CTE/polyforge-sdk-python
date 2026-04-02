# Issue Sweep Session — 2026-04-02 19:00 UTC

## Workflow: D (Issue Sweep)

## Quality Gate Baseline (main)
- Lint: PASS (17/17, 0 errors)
- Typecheck: 5/8 pass (pre-existing shared-db Prisma failure — no DB in environment)
- Build: 7/12 pass (pre-existing shared-db + network-only failures)

## Environment
- No `gh` CLI or GitHub MCP tools available
- PR creation via API not possible — branches pushed for manual PR creation
- Issue numbers inferred from session logs and git history

## Branches Created

### 1. `fix/issue-76-ssrf-webhook-validation` — Security Hardening (3 fixes)

**SSRF in webhook URL dispatcher** (`notification-service/webhook-dispatcher.service.ts`)
- Old: naive `startsWith()` string blocklist missed IPv6 (`::1`), IPv4-mapped IPv6 (`::ffff:127.0.0.1`), full 172.16–31.x range, CGNAT (100.64/10), trailing-dot hostname bypass, `.internal`/`.local` TLDs
- New: robust `isBlockedHost()` method with proper IP parsing via `net.isIP()`, full RFC 1918/5735 coverage, IPv6 ULA/link-local blocking

**WhatsApp verify token default** (`bot-service/whatsapp.service.ts`)
- Removed predictable `"polyforge-verify"` fallback from `WHATSAPP_VERIFY_TOKEN`
- Verification now rejected when env var is not configured

**WhatsApp webhook signature bypass** (`bot-service/whatsapp-webhook.controller.ts`)
- Removed `NODE_ENV === "production"` gate on signature validation
- All environments now reject unsigned webhook payloads when `WHATSAPP_APP_SECRET` is empty

**Quality gates:** Lint PASS, Build PASS (notification-service + bot-service), no new typecheck errors

### 2. `fix/issues-design-token-violations-batch-2` — Design Token Cleanup (25 fixes)

**shadow-lg → shadow-pf-lg (6 files)**
- correlation.tsx, sentiment.tsx, alerts.tsx, feed.tsx, retention.tsx, public-profile.tsx
- Zero `shadow-lg` violations remain in codebase

**bg-black opacity → pf-backdrop tokens (19 replacements across 13 files)**
- Added `--color-pf-backdrop` (0.6), `--color-pf-backdrop-light` (0.5), `--color-pf-backdrop-subtle` (0.4) to dark and light theme in `globals.css`
- Replaced all `bg-black/60` → `bg-pf-backdrop`, `bg-black/50` → `bg-pf-backdrop-light`, `bg-black/40` → `bg-pf-backdrop-subtle`
- Files: copy-detail, onboarding-modal, market-detail, orders, command-palette, shortcuts-modal, segmentation, dialog, api-docs, settings, portfolio, app-layout, admin-layout, admins, tooltip-tour
- Zero `bg-black/N` violations remain in codebase

**Quality gates:** Lint 17/17 PASS, Build PASS (pre-existing shared-db failure only)

## Security Scan Summary

Full codebase security scan identified these remaining medium-priority patterns:
- Cookie `sameSite: 'lax'` (auth-service) — consider `strict`
- Mail TLS flag `secure: false` for SES port 587 (notification-service)
- `$queryRawUnsafe` pattern in markets.service.ts (safe via whitelist Map, but pattern is risky)
- CSP allows `'unsafe-inline'` for styles (gateway nginx.prod.conf)

## Design Token Scan Summary

Remaining violations not yet addressed:
- `rounded-full` → `rounded-pf-full`: 69+ instances across 20+ files
- `text-black` / hardcoded color: 91+ instances across 40+ files
- Inline `style={}` attributes: 100+ instances (many are dynamic layout calculations)
- Arbitrary font sizes (`text-[Npx]`): 30+ instances across 20+ files

## Branches Pushed (awaiting PR creation)
| Branch | Commits | Files Changed |
|--------|---------|---------------|
| `fix/issue-76-ssrf-webhook-validation` | 1 | 4 |
| `fix/issues-design-token-violations-batch-2` | 1 | 23 |
