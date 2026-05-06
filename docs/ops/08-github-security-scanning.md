# GitHub Security Scanning Visibility

Last verified: 2026-05-06

## Scope

This runbook documents the security-alert visibility posture for
`F4CTE/PolyForge`. The main repository is private, and GitHub-native code
scanning and secret scanning currently depend on repository/organization
entitlements that are not available for this repo.

## Current GitHub State

Live GitHub API checks on 2026-05-06 showed:

| Control | API check | Result |
| --- | --- | --- |
| Dependabot alerts | `GET /repos/F4CTE/PolyForge/dependabot/alerts?state=open` | Enabled and readable; returned an empty alert list. |
| Code scanning alerts | `GET /repos/F4CTE/PolyForge/code-scanning/alerts?state=open` | Unavailable; GitHub returned `403` because code scanning is not enabled. |
| CodeQL default setup | `GET /repos/F4CTE/PolyForge/code-scanning/default-setup` | Unavailable; GitHub returned `403` because code scanning is not enabled. |
| Secret scanning alerts | `GET /repos/F4CTE/PolyForge/secret-scanning/alerts?state=open` | Unavailable; GitHub returned `404` because secret scanning is disabled. |

Attempts to enable the GitHub-native controls through the repository settings
API also failed:

| Setting attempted | GitHub result |
| --- | --- |
| `security_and_analysis.advanced_security.status=enabled` | `422`: Advanced Security has not been purchased. |
| `security_and_analysis.secret_scanning.status=enabled` | `422`: Secret scanning is not available for this repository. |

Because of these entitlement failures, the GitHub code scanning and secret
scanning alert APIs must not be treated as a reliable source of security signal
for `F4CTE/PolyForge` until the organization purchases/enables the required
GitHub Advanced Security capability or GitHub makes these controls available for
this private repository.

## Replacement Controls

Until GitHub-native visibility is available, PolyForge uses these repository
controls:

- Pull requests and pushes run the CI `Secret scan` job in
  `.github/workflows/ci.yml`.
- The `Secret scan` job installs a pinned `gitleaks` release, verifies its
  SHA-256 checksum, and runs `gitleaks detect --no-git --redact --no-banner
  --config .gitleaks.toml --source .`.
- The CI `Build` job runs `pnpm audit --audit-level=high` after the workspace
  build succeeds.
- Dependabot alert visibility remains enabled and should continue to be checked
  with `GET /repos/F4CTE/PolyForge/dependabot/alerts?state=open`.
- Secret exposure incidents still follow `docs/ops/05-incident-response.md`,
  including rotation and historical-exposure review.

These controls are CI gates, not GitHub Security tab alert feeds. Failed CI must
be treated as the operational alert source for leaked secrets or high-severity
dependency advisories while GitHub-native scanning is unavailable.

## Enablement Procedure When Entitlement Is Available

When GitHub Advanced Security or equivalent private-repo scanning entitlement is
available, enable the native controls and verify the alert APIs:

```bash
gh api -X PATCH repos/F4CTE/PolyForge \
  -f security_and_analysis[advanced_security][status]=enabled \
  -f security_and_analysis[secret_scanning][status]=enabled \
  -f security_and_analysis[secret_scanning_push_protection][status]=enabled

gh api repos/F4CTE/PolyForge/code-scanning/default-setup
gh api 'repos/F4CTE/PolyForge/code-scanning/alerts?state=open&per_page=1'
gh api 'repos/F4CTE/PolyForge/secret-scanning/alerts?state=open&per_page=1'
```

If code scanning still has no analyses after enablement, add a CodeQL workflow
or enable CodeQL default setup from GitHub settings, then wait for the first
successful analysis before relying on the code scanning alerts API.
