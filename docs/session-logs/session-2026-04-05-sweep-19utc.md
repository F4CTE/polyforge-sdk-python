# Issue Sweep — 2026-04-05 19:00 UTC

## Workflow

**WORKFLOW D: ISSUE SWEEP** (UTC hour 19)

## Issues Fixed (3 PRs created)

### 1. #285 — CRITICAL: Hex opacity on CSS variable strings → PR #305
- **Branch:** `fix/issue-285-hex-opacity-css-vars`
- **Fix:** Replaced invalid `meta.color + 'CC'` / `${dotColor}18` hex suffix concatenation with `color-mix(in srgb, ..., transparent)` in `block-palette.tsx` and `revenue.tsx`
- CSS variable references like `var(--color-pf-danger)` were producing invalid CSS when concatenated with hex opacity suffixes

### 2. #302 — HIGH/security: Key rotation architecturally inert → PR #306
- **Branch:** `fix/issue-302-key-rotation-inert`
- **Fix:** `startRotation()` now flushes all `admin:session:*` Redis keys to force re-authentication; response includes `sessionsInvalidated` count and `action_required` field
- Updated `docs/ops/02-deployment-aws.md` to document that services must be restarted with updated env var

### 3. #296 — HIGH/security: Placeholder secrets not rejected → PR #307
- **Branch:** `fix/issue-296-reject-placeholder-secrets`
- **Fix:** Added `rejectPlaceholderSecrets()` calls to `order-service`, `strategy-engine`, and `admin-api-service` which were missing validation against `CHANGE_ME_*` patterns

## CI Fixes (7 PRs rebased)

All 7 open PRs had failing CI due to being based on stale commits. Rebased all onto current `main`:

| PR | Branch | Status |
|----|--------|--------|
| #276 | `fix/issue-261-shared-status-badge` | Rebased + conflict resolved |
| #271 | `fix/issue-252-svg-animation-durations` | Rebased + conflict resolved |
| #272 | `fix/issues-shared-ui-spacing-tokens` | Rebased + conflict resolved |
| #273 | `fix/issues-user-app-spacing` | Rebased + conflict resolved |
| #277 | `fix/design-border-radius-tokens` | Rebased + conflict resolved |
| #281 | `fix/design-ui-spacing-radius-tokens` | Rebased + conflict resolved |
| #294 | `fix/spacing-radius-tokens` | Rebased (no conflicts) |

## Open Issue Summary

- **33 open issues** remaining
- 1 critical (now has PR): #285
- 2 high/security (now have PRs): #302, #296
- 6 medium/security: #303, #300, #299, #298, #297, #290
- 3 medium/design: #292, #287, #252 (PR exists)
- ~21 low priority issues

## Next Session Focus

1. Review and merge PRs #305, #306, #307 (critical/high fixes)
2. Review and merge design PRs once CI passes
3. Start on medium-priority security issues (#303, #300)
