## Issue Sweep — 2026-04-04 15:00 UTC

### Context
Hour 15 UTC → Issue Sweep mode. All previous PRs (#140–#177) had failing CI due to **GitHub Actions billing exhaustion** (spending limit reached), not code errors. Local lint and typecheck pass cleanly on all branches.

### Root Cause: CI Failures
All 9 open PRs showed `Lint / Typecheck / Test FAILURE` with annotation:
> "The job was not started because recent account payments have failed or your spending limit needs to be increased."

This is a GitHub Actions billing issue, not a code issue. Needs manual resolution by the founder.

### PR Cleanup
Closed superseded duplicate PRs:
- **PR #172** (fix/issues-143-144-157-security-high) → Closed. Superseded by #175 (signer) + #178 (infra).
- **PR #154** (fix/issues-145-146-147-security-medium) → Closed. Superseded by #177 (nginx) + #178 (infra).
- **PR #173** (fix/issues-139-146-155-156-158-160-security-medium) → Closed. Superseded by #175, #176, #177, #178.

### Shipped

**PR #178** — `fix/issues-144-146-147-infra-security` — [https://github.com/F4CTE/PolyForge/pull/178]
- `infra/terraform/ec2.tf`: IMDSv2 enforced via `metadata_options { http_tokens = "required" }` — closes #144 HIGH
- `infra/terraform/ecr.tf`: `MUTABLE` → `IMMUTABLE` on all 13 ECR repos — closes #146 MEDIUM
- `infra/terraform/vpc.tf`: `map_public_ip_on_launch = false` on both public subnets — closes #147 MEDIUM

**PR #179** — `fix/issues-162-163-design-typography` — [https://github.com/F4CTE/PolyForge/pull/179]
- `packages/ui/src/components/ui/badge.tsx`: `rounded-pf-full` → `rounded-[4px]` per charter §5 — closes #163
- `apps/admin-app/src/pages/orders/orders.tsx`: `font-mono` on size/price columns — closes #162
- `apps/admin-app/src/pages/markets/markets.tsx`: `font-mono` on volume/YES/NO price cells — closes #162

### Current Open PR Status
| PR | Branch | Covers | Status |
|----|--------|--------|--------|
| #175 | fix/issues-157-143-158-159-signer | #143, #157, #158, #159 | CI billing blocked |
| #176 | fix/issue-160-logger-redaction | #160 | CI billing blocked |
| #177 | fix/issues-139-145-155-156-nginx-gitignore-cors | #139, #145, #155, #156 | CI billing blocked |
| #178 | fix/issues-144-146-147-infra-security | #144, #146, #147 | CI billing blocked |
| #179 | fix/issues-162-163-design-typography | #162, #163 | CI billing blocked |
| #142 | fix/issues-134-137-138-security-medium-batch2 | #134, #137, #138 | CI billing blocked |
| #141 | fix/issues-135-136-139-security-medium-batch | #135, #136, #139 | CI billing blocked |
| #140 | fix/issues-132-133-hardcoded-secrets | #132, #133 | CI billing blocked |

### Blocked
- **GitHub Actions billing** — ALL PRs blocked from CI. Zero code issues found locally. Founder must resolve the spending limit before any PR can merge.

### Escalated to Founder
**FOUNDER DECISION REQUIRED**
Context: GitHub Actions has hit its spending/billing limit. All 8 open PRs have complete, locally-verified fixes for 19 open security issues but cannot be merged until CI passes.
Options: A) Increase GitHub Actions spending limit / switch to a paid plan. B) Add a branch protection exception to allow squash-merge without CI (temporary).
My recommendation: **Option A** — increase the limit. CI is a non-negotiable release gate.
Deadline: Needed before next PR merge session (18:00 UTC today).

### Next Session Focus
1. If billing resolved: merge PRs #140–#179 in priority order (security HIGH first)
2. Continue design issue sweep: #148 (Recharts duplication), #149 (rounded-lg → rounded-pf), #161 (font-serif testimonials)
3. Start on P0 priorities: Stripe billing integration
