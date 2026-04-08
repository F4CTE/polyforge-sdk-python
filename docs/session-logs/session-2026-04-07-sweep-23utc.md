# Issue Sweep — 2026-04-07 23:00 UTC

## Workflow
ISSUE SWEEP (hour 23 UTC)

## Summary

All 6 open issues already have corresponding PRs. CI checks were stuck in QUEUED state across all PRs. Focused on local validation and fixing a pre-existing typecheck blocker.

## Open Issues (6 total)

| # | Title | Labels | PR |
|---|-------|--------|-----|
| 393 | ThrottlerModule in-memory storage bypass | security, priority: high | #401 |
| 260 | CardSkeleton duplicated across 8 pages | design, code-quality | #437 |
| 258 | Strategy builder non-standard durations | design, priority: low | #438 |
| 274 | clamp() font sizes bypass typography tokens | design, priority: low | #438 |
| 282 | Auth-background non-standard durations | design, priority: low | #438 |
| 295 | Hero badge non-standard CSS durations | design, priority: low | #438 |

## Actions Taken

### 1. Created Issue #440 + PR #441 — key-rotation spec typecheck fix
- **Problem:** `key-rotation.service.spec.ts` referenced stale properties (`activeSecretsCount`, `secretHash`, `gracePeriodSeconds`) from an older service design, causing 4 TS2339 errors on `pnpm typecheck`
- **Fix:** Rewrote all tests to match the current session-invalidation model; added `getClient()` mock with SCAN/DEL stubs
- **PR:** [#441](https://github.com/F4CTE/PolyForge/pull/441) — `fix/issue-440-key-rotation-spec`
- **Quality gates:** lint 17/17, typecheck 21/21, build 24/24 (landing excluded — Google Fonts network unreachable in this environment)

### 2. Cherry-picked typecheck fix into PR #437 and PR #438
- Both branches had the same typecheck failure from main
- Cherry-picked the spec fix into both branches and pushed
- This unblocks CI for both PRs

### 3. Local verification of PR #401 (security, closes #393)
- Lint: 17/17 pass
- Typecheck: 21/21 pass
- Branch was created before the spec bug was introduced, so unaffected

## Open PRs Status

| # | Title | CI Status | Local Verified |
|---|-------|-----------|----------------|
| 401 | ThrottlerModule → Redis storage (closes #393) | Check+Build GREEN, E2E QUEUED | lint+typecheck pass |
| 437 | Shared CardSkeleton (closes #260) | QUEUED → pushed fix | lint+typecheck pass |
| 438 | Design token batch (closes #258,#274,#282,#295) | QUEUED → pushed fix | lint+typecheck pass |
| 441 | Key-rotation spec fix (closes #440) | NEW | lint+typecheck+build pass |
| 436 | PR review session log | QUEUED | docs only |
| 439 | Nightly prep session log | QUEUED | docs only |

## Next Session Focus
1. Merge PRs once CI completes (priority: #441 first, then #401, then #437/#438)
2. Monitor CI — all QUEUED checks should resolve
3. Pick up any new issues from nightly audit agents (4am UTC)
