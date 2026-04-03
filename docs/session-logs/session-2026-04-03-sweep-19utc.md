# Issue Sweep — 2026-04-03 19:00 UTC

## Workflow
ISSUE SWEEP (hour 19 UTC)

## Triage Summary

### Open Issues Remaining: 3
| # | Title | Priority | Status |
|---|-------|----------|--------|
| #42 | Spacing not on 4px grid | Medium | **Fixed — branch pushed** |
| #49 | Transition durations | Low | No PR yet |
| #52 | Unused design tokens | Low | No PR yet |

- No critical or high priority issues open
- All security issues resolved
- #7 (ElastiCache HA) merged into main at 18 UTC PR review session

## Shipped

### fix/issue-42-spacing-4px-grid (closes #42)
**Align all spacing to 4px grid**

Replaced **1,686** off-grid `.5` Tailwind spacing values with nearest 4px-grid equivalents across **114 files**:

| Old value | px | New value | px |
|-----------|----|-----------|----|
| `0.5` | 2px | `1` | 4px |
| `1.5` | 6px | `2` | 8px |
| `2.5` | 10px | `3` | 12px |
| `3.5` | 14px | `4` | 16px |

**Scope:** All spacing/sizing Tailwind utilities (p, m, gap, space-x/y, w, h, top, left, etc.) across `apps/user-app`, `apps/admin-app`, `apps/landing`, and `packages/ui`.

Top affected files:
- `strategy-detail.tsx`: 134 replacements
- `portfolio.tsx`: 118 replacements
- `settings.tsx`: 105 replacements
- `market-detail.tsx`: 75 replacements
- `orders.tsx`: 53 replacements

### Documentation
- `CHANGELOG.md` — version 6.35.16
- `docs/13-design-charter.md` — added §4 enforcement note prohibiting `.5` spacing values

## Quality Gates
- **Lint**: 17/17 PASS (0 errors, 3164 warnings — baseline)
- **Typecheck**: user-app ✓, admin-app ✓ (shared-db pre-existing failure — no PostgreSQL)
- **Build**: user-app ✓, admin-app ✓ (landing pre-existing failure — Google Fonts network)

## Blocked
- **No `gh` CLI auth** — cannot create PR. Branch pushed; PR to be created when auth is available.

## Open Branches (PRs pending)
| Branch | Closes |
|--------|--------|
| `fix/issue-42-spacing-4px-grid` | #42 |

## Next Session Focus
1. Create PR for #42 branch when auth available
2. Fix #49 (transition durations — low priority)
3. Fix #52 (unused design tokens — low priority)
