## Issue Sweep — 2026-04-03 08:00 UTC

### Context
- UTC hour 8 → WORKFLOW D (Issue Sweep)
- Previous session (07 UTC) reported: 25 open issues, 0 critical/high remaining, all PRs blocked by GitHub Actions runner failure
- No `gh` CLI auth or GitHub MCP tools available — installed gh CLI but no GitHub token for private repo API access
- Git operations functional via local proxy

### Quality Gate Baseline (main)
- **Lint**: 17/17 PASS (0 errors, 3151 warnings)
- **Typecheck**: shared-db fails (pre-existing Prisma — no PostgreSQL in env)
- **Build**: shared-db cascade fails (pre-existing); user-app ✓, admin-app ✓

### Code Scan Results

**Security scan**: No critical vulnerabilities found. CORS, input validation, error masking, parameterized queries all properly implemented. Overall risk: LOW.

**Design token violations identified**:
| Category | Count | Status |
|----------|-------|--------|
| shadow-lg (not pf) | 6 | Fixed this session |
| shadow-xl (not pf) | 2 | Fixed this session |
| shadow-2xl (not pf) | 2 | Fixed this session |
| bg-black/{opacity} | 19 | Fixed this session |
| Arbitrary font sizes | 433 | Existing — large refactor needed |
| rounded-full (not pf) | 408 | Existing — branch fix/issues-design-tokens-batch-3 |
| text-black/text-white | 97 | Existing — branch fix/issues-design-tokens-batch-3 |
| inline styles | 97 | Existing — needs audit |

### Shipped

**Branch: `fix/issues-design-shadow-overlay-batch-2`** (pushed, PR not yet created — no GitHub API auth)
- Added `shadow-pf-xl` and `shadow-pf-2xl` tokens to dark and light themes in `globals.css`
- Replaced 6 `shadow-lg` → `shadow-pf-lg` across tooltips, dropdowns, chart overlays
- Replaced 2 `shadow-xl` → `shadow-pf-xl` in topbar notification/profile menus
- Replaced 2 `shadow-2xl` → `shadow-pf-2xl` in onboarding checklist and tooltip tour
- Replaced 19 `bg-black/{opacity}` → `bg-pf-base/{opacity}` across all modal backdrops, sidebar overlays, dialog components (15 files)
- **Lint**: 17/17 PASS (0 errors)
- **Build**: user-app ✓, admin-app ✓

### Open Branch Summary
| Branch | Issue(s) | Category |
|--------|----------|----------|
| fix/issues-design-shadow-overlay-batch-2 | design tokens | design (NEW) |
| fix/issue-57-helmet-security-headers | #57 | security |
| fix/issue-58-cors-missing-origin | #58 | security |
| fix/issue-78-rate-limiting-missing-services | #78 | security |
| fix/issues-security-cookie-mail-csp | misc | security |
| fix/issues-design-tokens-batch-3 | #70, #61 | design |
| fix/issue-7-elasticache-ha | #7 | infra |
| + 10 more existing branches | various | various |

### Blocked
- PR creation blocked — no GitHub API auth token available for private repo
- All PR merges blocked by GitHub Actions runner allocation failure (not a code issue)

### Next Session Focus
1. If GitHub API auth available: create PR for shadow/overlay batch
2. If CI resolved: merge ready PRs
3. Consider tackling arbitrary font sizes (433 violations) — largest remaining design debt
