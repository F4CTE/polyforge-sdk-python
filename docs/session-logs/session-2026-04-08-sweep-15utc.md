## Issue Sweep — 2026-04-08 15:00 UTC

### Summary

All 16 open issues already have corresponding PRs. The primary blocker was that
all PRs were behind `main` and missing recent E2E auth test fixes (commits
`90c9807`, `3c31685`, `b65568e`, `ff9165b`), causing E2E failures or cancelled
CI runs on every open PR.

### Actions Taken

1. **Audited CI status on all 12 fix PRs** — every PR passed lint/typecheck/build
   but had E2E failures (FAILURE) or cancellations (CANCELLED) due to being behind main.

2. **Merged `main` into all 12 fix PR branches** to pick up E2E auth test fixes:
   - PR #457 (`fix/issue-455-stub-signer-env-guard`) — security + high
   - PR #458 (`fix/issue-453-ci-key-leak-mitigation`) — security + high + secret-leak
   - PR #459 (`fix/issue-456-zero-key-warning`) — security + medium
   - PR #460 (`fix/issue-454-cookie-secure-default`) — security + medium
   - PR #461 (`fix/issue-451-hono-cves`) — security + medium + dependencies
   - PR #474 (`fix/e2e-orders-filter-aria-pressed`) — UI fix
   - PR #464 (`fix/issues-446-448-449-450-design-batch`) — design batch
   - PR #462 (`fix/issue-447-glow-shadow-tokens`) — design
   - PR #441 (`fix/issue-440-key-rotation-spec`) — admin-api
   - PR #438 (`fix/issues-258-274-282-295-design-batch`) — design batch
   - PR #437 (`fix/issue-260-shared-card-skeleton`) — UI shared component
   - PR #401 (`fix/issue-393-throttler-redis-storage`) — security + high

3. **Resolved CHANGELOG.md merge conflicts** on 8 branches (programmatic resolution
   preserving both branch and main entries).

4. **CI re-triggered** on all 12 PRs. At session end, PRs #457 and #458 had already
   passed Check and were progressing through Build.

### Open Issues (16 total)

| # | Title | Priority | PR |
|---|-------|----------|----|
| 455 | Stub signer not restricted to dev | security + high | #457 |
| 453 | Hardcoded CI encryption keys | security + high + secret-leak | #458 |
| 393 | ThrottlerModule in-memory storage | security + high | #401 |
| 456 | All-zeros MASTER_ENCRYPTION_KEY | security + medium | #459 |
| 454 | COOKIE_SECURE=false in .env.example | security + medium | #460 |
| 451 | hono + @hono/node-server CVEs | security + medium + deps | #461 |
| 447 | Glow shadow tokens missing | design + medium | #462 |
| 446 | Arbitrary max-w-[1100px] | design + low | #464 |
| 448 | Recharts Legend hardcoded styles | design + low | #464 |
| 449 | OTP tracking arbitrary value | design + low | #464 |
| 450 | Landing opacity modifiers | design + low | #464 |
| 260 | CardSkeleton duplicated | design | #437 |
| 258 | Strategy builder animation durations | design + low | #438 |
| 274 | clamp() font sizes | design + low | #438 |
| 282 | Auth background animation durations | design + low | #438 |
| 295 | Hero badge animation durations | design + low | #438 |

### Decisions Made

- Merged main into all PR branches (rather than rebasing) to preserve commit
  history and avoid force-push risks on shared branches.

### Next Session Focus

1. Verify all 12 PRs have green CI after the main merge
2. PRs that still fail E2E need individual investigation
3. Evening PR review session (18 UTC) should be able to merge green PRs
