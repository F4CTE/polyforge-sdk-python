# Self-Hosted GitHub Actions Runners

PolyForge's runner estate has 15 local GitHub Actions runner installations on
`polyforge-lab`, the on-premise Linux server. The runners are registered at the
repository level: each managed repository has 3 GitHub-registered runners, and
the host has 15 systemd services total across the 5 repositories.

Health checks must compare the same inventory layer:

- Host inventory: expect 15 `actions.runner.*.service` units and 15
  `Runner.Listener` processes on `polyforge-lab`.
- GitHub repository inventory: expect 3 registered runners per repository.
- Fleet inventory: expect 15 total GitHub runners only after summing the 5
  managed repositories below.

A single GitHub API query for `F4CTE/PolyForge` should return 3 runners, not 15.
That is healthy as long as the corresponding 3 local services are running.

---

## Runner Inventory

| Runner Group | Repo | GitHub repo count | Host service count | Systemd service pattern |
|---|---|---|---|---|
| PolyForge main | `F4CTE/PolyForge` | 3 | 3 | `actions.runner.F4CTE-PolyForge.polyforge-lab*.service` |
| polyforge-mcp | `F4CTE/polyforge-mcp` | 3 | 3 | `actions.runner.F4CTE-polyforge-mcp.polyforge-lab*.service` |
| polyforge-sdk-ts | `F4CTE/polyforge-sdk-ts` | 3 | 3 | `actions.runner.F4CTE-polyforge-sdk-ts.polyforge-lab*.service` |
| polyforge-sdk-python | `F4CTE/polyforge-sdk-python` | 3 | 3 | `actions.runner.F4CTE-polyforge-sdk-python.polyforge-lab*.service` |
| polyforge-sdk-rust | `F4CTE/polyforge-sdk-rust` | 3 | 3 | `actions.runner.F4CTE-polyforge-sdk-rust.polyforge-lab*.service` |

**Runner directories:** `/home/f4cte/actions-runner*` (15 directories total)

The runner names are reused per repository (`polyforge-lab`,
`polyforge-lab-2`, `polyforge-lab-3`). This is expected because runner names are
scoped to a repository registration, not globally across the organization.

---

## Host Machine

| Property | Value |
|---|---|
| Hostname | `polyforge-lab` |
| OS | Ubuntu Linux |
| User | `f4cte` |
| GPU | NVIDIA RTX 3080 (NVIDIA Container Toolkit installed) |
| Docker | Full stack via `docker-compose.infra.yml` |
| Runner binary | v2.333.1 (auto-updates via GitHub) |

---

## Runner Status

```bash
# Check all host runner services at once
systemctl list-units --type=service --all "actions.runner*" --no-pager

# Check a specific runner
systemctl status "actions.runner.F4CTE-PolyForge.polyforge-lab.service"

# Check if all 15 host services are active
systemctl list-units --type=service --all "actions.runner*" --no-pager \
  | grep -c "active running"

# Check if all 15 listener processes are running
pgrep -fc "Runner[.]Listener"
```

---

## Inventory Reconciliation

Use both host-level and GitHub-level checks when investigating runner drift:

```bash
# Host layer: 15 local runner services across all managed repos
systemctl list-units --type=service --all "actions.runner*" --no-pager
pgrep -af "Runner[.]Listener"

# GitHub layer: 3 registered runners per repository
for repo in PolyForge polyforge-mcp polyforge-sdk-ts polyforge-sdk-python polyforge-sdk-rust; do
  echo "## F4CTE/$repo"
  gh api "repos/F4CTE/$repo/actions/runners" \
    --jq '.total_count as $total | "total=\($total)", (.runners[] | [.name,.status,.busy] | @tsv)'
done
```

Interpretation:

- Healthy host inventory is 15 active systemd units and 15 listener processes.
- Healthy GitHub inventory is 3 online runners for each managed repository.
- Do not flag "15 local vs 3 GitHub" as drift when the GitHub data came from
  one repository. Flag it only when the per-repo expected count is not 3, a
  runner is offline, or the host total is not 15.
- `polyforge-mcp` and SDK repositories are public and their normal CI workflows
  use GitHub-hosted runners. Their self-hosted registrations may appear idle in
  GitHub; that is not a queue or capacity problem unless a trusted workflow is
  explicitly configured to use `runs-on: [self-hosted, linux]`.

---

## Runner Management

```bash
# Start a runner
sudo systemctl start "actions.runner.F4CTE-PolyForge.polyforge-lab.service"

# Stop a runner
sudo systemctl stop "actions.runner.F4CTE-PolyForge.polyforge-lab.service"

# Restart a runner (use after runner binary updates)
sudo systemctl restart "actions.runner.F4CTE-PolyForge.polyforge-lab.service"

# View logs
journalctl -u "actions.runner.F4CTE-PolyForge.polyforge-lab.service" -n 50 -f

# Restart all runners registered to the PolyForge main repository
for i in "" "-2" "-3"; do
  sudo systemctl restart "actions.runner.F4CTE-PolyForge.polyforge-lab${i}.service"
done

# Restart the full 15-runner host fleet
systemctl list-unit-files "actions.runner*.service" --no-legend \
  | awk '{print $1}' \
  | xargs -r -n1 sudo systemctl restart
```

---

## CI Pipeline Structure

The PolyForge CI workflow (`.github/workflows/ci.yml`) uses `runs-on: [self-hosted, linux]`:

| Job | Runner | Notes |
|---|---|---|
| Lint | self-hosted | pnpm cache warm — ~5s install |
| Typecheck | self-hosted | pnpm cache warm |
| Test | self-hosted | pnpm cache warm; unit tests with mocked infra |
| Build | self-hosted | pnpm cache + Docker build cache via local registry |
| Deploy to Dev | self-hosted | SSH to `polyforge-lab` → Docker rebuild → health check |
| E2E | self-hosted | Playwright against Docker services on `polyforge-lab` |
| Deploy to Production | self-hosted | Requires `workflow_dispatch` on main + `production` environment approval |

### Concurrency

- **Per-branch concurrency**: a push to the same branch cancels its previous run (all jobs)
- **Deploy serialization**: `deploy-polyforge-lab` concurrency group serializes Deploy to Dev + E2E — only one branch deploys at a time (no cancel, queues instead)

---

## Docker Cache Setup

The runners use two local Docker registries to avoid Docker Hub rate limits:

| Registry | Port | Purpose |
|---|---|---|
| `polyforge-docker-cache` | 5001 | Pull-through proxy for Docker Hub base images |
| `polyforge-buildcache-registry` | 5002 | BuildKit layer cache (push/pull) |

To reconfigure (e.g. after OS reinstall):

```
GitHub → Actions → Runner Setup — Docker Cache → Run workflow
```

This re-creates both registries and warms the cache with the base images used by `docker-compose.infra.yml`.

---

## Adding a New Runner

To register an additional runner for `F4CTE/PolyForge`:

```bash
# 1. Download runner binary (check latest at https://github.com/actions/runner/releases)
mkdir ~/actions-runner-4 && cd ~/actions-runner-4
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.333.1/actions-runner-linux-x64-2.333.1.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz

# 2. Get a registration token from GitHub
# GitHub → F4CTE/PolyForge → Settings → Actions → Runners → New self-hosted runner → token

# 3. Configure and register
./config.sh --url https://github.com/F4CTE/PolyForge \
            --token <TOKEN> \
            --name polyforge-lab-4 \
            --labels self-hosted,linux \
            --unattended

# 4. Install as systemd service
sudo ./svc.sh install
sudo ./svc.sh start
```

---

## Disk Space Maintenance

Runner work directories accumulate in `~/actions-runner*/_work/`. Run weekly:

```bash
# Prune Docker build cache and stopped containers (safe to run anytime)
docker system prune -f

# Remove stale work dirs older than 7 days
find /home/f4cte/actions-runner*/_work -maxdepth 2 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

# Check disk usage
df -h /
du -sh /home/f4cte/actions-runner*/_work 2>/dev/null | sort -h
```

Keep at least **50 GB free** for Docker image builds (the full service set builds ~18 images totalling ~12 GB).

---

## Troubleshooting

### Runner shows offline in GitHub

```bash
# Check service status
systemctl status "actions.runner.F4CTE-PolyForge.polyforge-lab.service"

# Check for errors in logs
journalctl -u "actions.runner.F4CTE-PolyForge.polyforge-lab.service" -n 100 | grep -i error

# Restart the service
sudo systemctl restart "actions.runner.F4CTE-PolyForge.polyforge-lab.service"
```

### Deploy to Dev fails with port conflicts

The deploy spins up Docker services on ports 80, 3001-3011, 5432, 5434, 6379.
If a previous deploy left services running in a bad state:

```bash
docker compose -f ~/PolyForge/docker-compose.infra.yml down --remove-orphans
```

### Jobs queue indefinitely

If all 3 runners for a repo are busy, jobs queue until one becomes free. Under normal
load this resolves in minutes. If queued for >30 min:

1. Check `docker ps` — a previous E2E run may be stuck
2. Check `journalctl -u "actions.runner.F4CTE-PolyForge.polyforge-lab.service" -n 50`
3. If a job is stuck, cancel it on GitHub and restart the affected runner

### Runner binary auto-update fails

GitHub auto-updates the runner binary. If an update fails and the runner crashes:

```bash
# Check which binary version is running
ls ~/actions-runner/bin.*/
# Manually re-run the update
cd ~/actions-runner && ./config.sh --version
```

---

## Security Notes

- Self-hosted CI runs only for pushes and same-repository PRs. External fork PRs are blocked by the `External PR approval required` guard job and must be reviewed before a trusted branch runs CI. Keep the repository Actions setting at **Require approval for all outside collaborators** so modified PR workflow files cannot be approved casually.
- SDK repos (`polyforge-sdk-*`, `polyforge-mcp`) are **public** — their workflows use `ubuntu-latest` (GitHub-hosted) intentionally to avoid running untrusted PR code on `polyforge-lab`.
- Never store production secrets on the runner machine. Dev deployment uses `DEV_*` GitHub secrets; production deployment uses the `production` environment gate and AWS Secrets Manager on EC2.
- The runners run as the `f4cte` user. They have access to the local Docker daemon and the `~/PolyForge` working directory.

---

## CI Secrets Required

| Secret | Purpose |
|---|---|
| `LAB_HOST` | polyforge-lab hostname/IP for SSH deploy |
| `LAB_SSH_KEY` | ED25519 private key for `f4cte@polyforge-lab` |
| `DEV_USER_JWT_SECRET` | Dev deploy user JWT secret |
| `DEV_ADMIN_JWT_SECRET` | Dev deploy admin JWT secret |
| `DEV_BOT_JWT_SECRET` | Dev deploy bot JWT secret |
| `DEV_INTERNAL_JWT_SECRET` | Dev deploy internal JWT secret |
| `DEV_MASTER_ENCRYPTION_KEY` | Dev deploy encryption key, distinct from prod |
| `DEV_TOTP_ENCRYPTION_KEY` | Dev deploy TOTP encryption key, distinct from prod |
| `DEV_DB_PASSWORD` | Dev deploy user database password |
| `DEV_ADMIN_DB_PASSWORD` | Dev deploy admin database password |
| `DEV_REDIS_PASSWORD` | Dev deploy Redis password |
| `DEV_POLY_BUILDER_API_KEY` | Dev deploy Polymarket builder API key |
| `DEV_POLY_BUILDER_SECRET` | Dev deploy Polymarket builder secret |
| `DEV_POLY_BUILDER_PASSPHRASE` | Dev deploy Polymarket builder passphrase |
| `DOCKERHUB_USERNAME` | Docker Hub credentials for pull-through proxy |
| `DOCKERHUB_TOKEN` | Docker Hub token for pull-through proxy |
| `AWS_ACCESS_KEY_ID` | Production deploy (workflow_dispatch only) |
| `AWS_SECRET_ACCESS_KEY` | Production deploy |
| `AWS_REGION` | Production deploy |
| `AWS_ACCOUNT_ID` | Production deploy |
| `EC2_HOST` | Production EC2 host |
| `EC2_SSH_KEY` | Production EC2 SSH key |
| `DIRECT_DATABASE_URL` | Production DB connection (migrations) |

Add via: **GitHub → F4CTE/PolyForge → Settings → Secrets and variables → Actions**.
