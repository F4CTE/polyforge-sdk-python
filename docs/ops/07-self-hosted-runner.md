# Self-Hosted GitHub Actions Runner

PolyForge CI runs on a local self-hosted runner to avoid GitHub Actions minute
limits. Jobs 1-6 (lint, typecheck, test, build, E2E, audit) run locally; deploy
stays on GitHub-hosted `ubuntu-latest`.

## Prerequisites

- **Windows 11** with Docker Desktop running
- **Node.js 24+** and **pnpm 9+** installed globally
- **Git** configured with push access to `F4CTE/PolyForge`
- **GitHub PAT** with `repo` scope (classic) or `administration:write` (fine-grained)

## Initial Setup

```powershell
# Generate a PAT at https://github.com/settings/tokens
# Required scope: repo (classic) or administration:write (fine-grained on F4CTE/PolyForge)

cd C:\Users\User\Documents\polyForge
.\scripts\setup-runner.ps1 -Token ghp_YOUR_TOKEN_HERE
```

This will:
1. Download the GitHub Actions runner v2.323.0
2. Register it as `polyforge-local` with labels `self-hosted,windows,x64,polyforge`
3. Install and start it as a Windows service

## Runner Management

```powershell
# Check status
.\scripts\runner-ctl.ps1 status

# Start / stop / restart
.\scripts\runner-ctl.ps1 start
.\scripts\runner-ctl.ps1 stop
.\scripts\runner-ctl.ps1 restart

# View latest logs
.\scripts\runner-ctl.ps1 logs

# Clean up old work dirs + Docker cache (run weekly)
.\scripts\runner-ctl.ps1 cleanup
```

## How It Works

The CI workflow (`.github/workflows/ci.yml`) uses `runs-on: [self-hosted, polyforge]`
for all non-deploy jobs. The runner picks up jobs from GitHub's queue and executes
them using your local Node.js, pnpm, and Docker.

### What runs locally vs GitHub-hosted

| Job | Runner | Why |
|-----|--------|-----|
| Lint | self-hosted | No external deps |
| Typecheck | self-hosted | No external deps |
| Test | self-hosted | No external deps |
| Build | self-hosted | No external deps |
| E2E | self-hosted | Docker cache persists locally (huge speedup) |
| Audit | self-hosted | No external deps |
| Deploy | ubuntu-latest | Needs AWS secrets + SSH to EC2 |

### Performance comparison

| Metric | GitHub-hosted | Self-hosted |
|--------|--------------|-------------|
| pnpm install | ~45s (cold) | ~5s (warm cache) |
| Docker build (E2E) | ~15min (cold layers) | ~3min (cached layers) |
| Full CI pipeline | ~25-35min | ~8-12min |
| Monthly cost | 2000-3000 min limit | Unlimited (your electricity) |

## Disk Space

The runner stores work in `C:\actions-runner\_work`. This grows over time.

- Run `.\scripts\runner-ctl.ps1 cleanup` weekly to remove stale dirs and prune Docker
- The cleanup script removes work dirs older than 7 days and runs `docker system prune`
- Keep at least 50GB free for Docker image builds (E2E builds ~18 images)

## Troubleshooting

### Runner shows as offline in GitHub

1. Check Docker Desktop is running
2. Run `.\scripts\runner-ctl.ps1 status` — service must be `Running`
3. If stopped: `.\scripts\runner-ctl.ps1 start`
4. Check logs: `.\scripts\runner-ctl.ps1 logs`

### E2E fails with port conflicts

The E2E job starts Docker Compose on ports 80, 3001-3011, 5432, 5434, 6379.
If you're running the dev stack locally, stop it first:

```bash
docker compose -f docker-compose.infra.yml down
```

### Jobs queue indefinitely

If your machine is off or the runner service is stopped, jobs will queue until the
runner comes back online. Jobs time out after 6 hours by default.

To unblock immediately: temporarily change `runs-on` back to `ubuntu-latest` and push.

### Updating the runner

GitHub auto-updates the runner binary. If you need to force an update:

```powershell
.\scripts\runner-ctl.ps1 stop
cd C:\actions-runner
# Re-run setup with a fresh token
.\scripts\setup-runner.ps1 -Token ghp_NEW_TOKEN
```

## Security Notes

- The runner executes code from PRs. For public repos, restrict to `push` events only.
- Since PolyForge is private, PR jobs are safe.
- The runner service runs as your Windows user — it has access to your filesystem.
- Never store production secrets on the runner machine (use GitHub Secrets for deploy).
- The PAT used for registration is consumed once and not stored.
