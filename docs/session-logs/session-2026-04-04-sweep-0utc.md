## Issue Sweep — 2026-04-04 00:00 UTC

### Workflow
ISSUE SWEEP (hour 0 UTC)

### Actions Taken

#### 1. Triaged all open issues (31 total)
- **Security HIGH (4):** #132, #133, #143, #144 — all have open PRs
- **Security MEDIUM (11):** #134-139, #145-147, #155, #156
- **Design (16):** #121-131, #148-152

#### 2. Diagnosed CI failures on 5 existing PRs
All 5 open PRs (#140, #141, #142, #153, #154) had failing CI (Lint, Typecheck, Test all FAILURE). Investigation revealed **all jobs had 0 steps** — GitHub Actions runners failed to start, not code issues. Verified all 5 branches pass lint + typecheck + build locally.

- Re-triggered CI on all 5 runs via `gh api .../rerun`
- CI still failing (runner infrastructure issue — outside our control)

#### 3. Fixed #155 and #156 → PR #169
- **#155 (host-header injection):** Replaced `$host` with `$server_name` (prod) / `localhost` (dev) in 58 `proxy_set_header` directives across 4 nginx configs
- **#156 (wildcard CORS):** Restricted mock-polymarket CORS to localhost origins + added production startup guard

### Open PRs (6 total)
| PR | Issues | Status |
|----|--------|--------|
| #140 | #132, #133 (HIGH) | Code verified, CI infra broken |
| #153 | #143, #144 (HIGH) | Code verified, CI infra broken |
| #141 | #135, #136, #139 (MED) | Code verified, CI infra broken |
| #142 | #134, #137, #138 (MED) | Code verified, CI infra broken |
| #154 | #145, #146, #147 (MED) | Code verified, CI infra broken |
| #169 | #155, #156 (MED) | NEW — just created |

### Blocked
- GitHub Actions runners not starting (0 steps on all jobs) — prevents CI green status on all PRs

### Next Session Focus
1. Investigate CI runner issue (may need workflow dispatch or runner re-registration)
2. Merge security HIGH PRs (#140, #153) once CI is green
3. Start design issues batch PR
