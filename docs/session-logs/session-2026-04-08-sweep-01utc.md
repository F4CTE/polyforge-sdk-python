# Session Log — 2026-04-08 01:00 UTC (Issue Sweep)

## Workflow

ISSUE SWEEP (UTC hour 1)

## PolyForge (main repo)

### Status check
- All HIGH/CRITICAL issues already have open PRs
- PR #441 (key-rotation spec fix, closes #440): lint ✅, no new typecheck errors
- PR #438 (design batch, closes #258, #274, #282, #295): lint ✅
- PR #437 (CardSkeleton, closes #260): lint ✅
- PR #401 (throttler Redis, closes #393): lint ✅
- Pre-existing typecheck/build failures in `@polyforge/shared-db` due to missing Prisma generated clients (no DB in environment) — same on main
- No medium-priority issues remaining
- No new PRs created for main repo (nothing to fix)

## polyforge-mcp

### Created: PR #71 — fix(compat): batch compat fixes
Branch: `fix/issues-61-64-67-68-compat-batch`

Fixes:
- **#67** (BREAKING): `callApi()` crashes on 204 No Content — `delete_strategy` and `delete_alert` now work
- **#68** (BREAKING): `createWebhookSchema` removed non-existent `secret` field, made `events` required
- **#64** (BREAKING): `placeSmartOrderSchema` added all 8 optional TWAP/DCA/BRACKET/OCO parameters
- **#61** (compat): `run_backtest` renamed `initialCapital` to `initialBalance` in schema + tool definition

Quality: `npm run build` (tsc) ✅

## polyforge-sdk-python

### Created: PR #72 — fix(compat): batch compat fixes
Branch: `fix/issues-62-64-71-compat-batch`

Fixes:
- **#71** (BREAKING): `_delete()` crashes on 204 No Content — sync + async both fixed
- **#64** (BREAKING): `place_smart_order()` renamed `interval_minutes` to `interval_seconds`, sends `intervalSeconds`
- **#62** (BREAKING): `_parse()` added `_camel_to_snake()` helper so camelCase API keys map to snake_case dataclass fields

Quality: Python syntax ✅, import + signature verification ✅

## polyforge-sdk-rust

### Created: PR #73 — fix(compat): batch compat fixes
Branch: `fix/issues-66-70-compat-batch`

Fixes:
- **#70** (BREAKING): `handle_response()` crashes on 204 No Content — returns `Value::Null`; `delete_strategy()` now returns `Result<()>`
- **#66** (BREAKING): `PlaceSmartOrderParams.interval_minutes` renamed to `interval_seconds`, serializes as `"intervalSeconds"`

Quality: `cargo check` ✅

## polyforge-sdk-ts

### Created: PR #70 — fix(compat): batch compat fixes
Branch: `fix/issues-62-64-compat-batch`

Fixes:
- **#62** (BREAKING): `PlaceSmartOrderParams.intervalMinutes` renamed to `intervalSeconds`
- **#64**: `RunBacktestParams.initialBalance` removed (phantom field stripped by platform)
- Fixed duplicate type imports in `client.ts` that caused `TS2300` build errors

Quality: `npm run build` (tsc + ESM emit) ✅

## Summary

| Repo | PRs Created | Issues Addressed |
|------|-------------|-----------------|
| PolyForge | 0 (verified 4 existing) | — |
| polyforge-mcp | 1 (#71) | #61, #64, #67, #68 |
| polyforge-sdk-python | 1 (#72) | #62, #64, #71 |
| polyforge-sdk-rust | 1 (#73) | #66, #70 |
| polyforge-sdk-ts | 1 (#70) | #62, #64 |
| **Total** | **4 new PRs** | **12 issues addressed** |
