# Issue Sweep — 2026-04-03 20:00 UTC

## Workflow
ISSUE SWEEP (hour 20 UTC)

## Triage Summary

### Open Issues Remaining: 0
All known open issues now have fixes pushed.

| # | Title | Priority | Status |
|---|-------|----------|--------|
| #42 | Spacing not on 4px grid | Medium | **Fixed — branch pushed** |
| #49 | Transition durations | Low | **Fixed — branch pushed** |
| #52 | Unused design tokens | Low | **Fixed — branch pushed** |

## Shipped

### fix/issues-42-49-52-design-cleanup (closes #42, closes #49, closes #52)
**Batch design cleanup: spacing grid, transition durations, unused tokens**

#### Spacing grid alignment (#42)
Replaced **1,691** off-grid `.5` Tailwind spacing values with nearest 4px-grid equivalents across **114 files**:

| Old value | px | New value | px |
|-----------|----|-----------|----|
| `0.5` | 2px | `1` | 4px |
| `1.5` | 6px | `2` | 8px |
| `2.5` | 10px | `3` | 12px |
| `3.5` | 14px | `4` | 16px |

Top affected files: portfolio.tsx (117), strategy-detail.tsx (133), settings.tsx (105), market-detail.tsx (75), orders.tsx (53)

#### Transition duration standardization (#49)
Replaced all non-standard durations with the three design-token-aligned values:
- `duration-150` (33 uses) → `duration-100` (fast: hover/focus)
- `duration-250` (1 use) → `duration-200` (normal: component transitions)
- `duration-400` (1 use) → `duration-300` (slow)
- `duration-500` (7 uses) → `duration-300` (slow)
- `duration-700` (2 uses) → `duration-300` (slow)

#### Unused token cleanup (#52)
- Removed `--color-pf-cyan-100`, `--color-pf-cyan-200`, `--color-pf-cyan-700` (defined but never referenced)
- Removed `--color-pf-text-disabled` (defined but never referenced)
- Aliased `--color-pf-text-tertiary` to `var(--color-pf-text-muted)` (identical values)

### Documentation
- `CHANGELOG.md` — version 6.35.16
- `docs/13-design-charter.md` — added enforcement notes for spacing grid and transition durations

## Quality Gates
- **Lint**: 17/17 PASS (0 errors, 3164 warnings — baseline)
- **Typecheck**: user-app PASS, admin-app PASS (shared-db pre-existing failure — no PostgreSQL)
- **Build**: user-app PASS, admin-app PASS (landing pre-existing failure — Google Fonts network)

## Blocked
- **No `gh` CLI auth** — cannot create PR via API. Branch pushed to `origin/fix/issues-42-49-52-design-cleanup`; PR to be created when auth is available.

## Open Branches (PRs pending)
| Branch | Closes |
|--------|--------|
| `fix/issues-42-49-52-design-cleanup` | #42, #49, #52 |

## Next Session Focus
1. Create PR for batched design cleanup when auth available
2. Merge PR once CI green
3. All known issues resolved — monitor for new audit agent issues
