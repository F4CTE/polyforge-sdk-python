# Issue Sweep — 2026-04-03 17:00 UTC

## Workflow
ISSUE SWEEP (hour 17 UTC)

## Triage Summary

### Open Issues: ~6 design issues remaining without PRs
- No new critical/high security issues
- Previous sweep (16 UTC) pushed #40, #48 branches

### Branch Pushed: 1
| Branch | Closes | Status |
|--------|--------|--------|
| `fix/issues-46-62-44-design-sweep` | #46, #62, #44 | Pushed, PR pending (no gh auth) |

## Shipped

### fix/issues-46-62-44-design-sweep (closes #46, #62, #44)

**1. Strategy-chart hex fallbacks — theme-aware (closes #46)**
Updated `getTheme()` in `strategy-chart.tsx` — all 8 fallback hex values now:
- Match exact token values from `globals.css` (were outdated/approximate)
- Switch between dark and light mode fallbacks via `isDark` detection
- Pattern: `get('--color-pf-X') || (isDark ? '#dark' : '#light')`

Misaligned values fixed:
| Token | Old fallback | Dark correct | Light correct |
|-------|-------------|-------------|---------------|
| elevated | `#111D2E` | `#0f172a` | `#ffffff` |
| border | `#1E3350` | `#1e293b` | `#cbd5e1` |
| text-muted | `#445E7A` | `#64748b` | `#64748b` |
| text-secondary | `#7A94B4` | `#94a3b8` | `#334155` |
| base | `#0F172A` | `#020817` | `#f1f5f9` |

**2. Hero particles inline animation → CSS class (closes #62)**
- Extracted `animation: float-particle ${dur} linear ${delay} infinite` inline string
- Added `.hero-particle` CSS class in `landing/globals.css` using `--particle-dur` / `--particle-delay` custom properties
- Per-instance position/size (`width`, `height`, `left`, `top`) remains as style props (data-driven)

**3. Missing meta image assets (closes #44)**
- Generated `og-image.png` (1200×630) — dark theme, hexagon+bolt logo, title, feature chips
- Generated `apple-touch-icon.png` (180×180) — icon with "PF" text
- Both placed in `apps/landing/public/`
- Social share previews (Twitter, LinkedIn, Discord) now render properly

### Documentation
- `docs/13-design-charter.md` — added §37 "Social Meta Images" covering OG image specs, chart fallback pattern, hero particle animation pattern
- `CHANGELOG.md` — version 6.35.15

## Quality Gates
- **Lint**: 17/17 PASS (0 errors, 3164 warnings — baseline)
- **Typecheck**: user-app ✓, admin-app ✓, landing ✓ (shared-db pre-existing failure — no PostgreSQL)
- **Build**: user-app ✓, admin-app ✓ (landing fails on main too — Google Fonts network issue, pre-existing)

## Blocked
- **No `gh` CLI auth** — cannot create PRs or verify CI status. Branch pushed; PR to be created when auth is available.

## Remaining Open Issues (no PR)
| # | Title | Priority |
|---|-------|----------|
| #42 | Spacing not on 4px grid | Medium |
| #49 | Transition durations | Low |
| #52 | Unused design tokens | Low |

## Open Branches (PRs pending)
| Branch | Closes |
|--------|--------|
| `fix/issue-40-builder-nodes-inline-styles` | #40 |
| `fix/issue-48-form-input-labels` | #48 |
| `fix/issues-46-62-44-design-sweep` | #46, #62, #44 |
| `fix/issue-7-elasticache-ha` | #7 |

## Next Session Focus
1. Create PRs for all pushed branches when auth available
2. PR review & merge at 18 UTC session
3. Fix #42 (spacing 4px grid — large batch, 600+ instances)
