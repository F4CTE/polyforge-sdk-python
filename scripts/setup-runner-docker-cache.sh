#!/usr/bin/env bash
# setup-runner-docker-cache.sh
#
# One-time setup: install a Docker Hub pull-through cache on a self-hosted
# GitHub Actions runner. Run this directly on the runner machine (not in CI).
#
# What this does:
#   1. Starts a local registry container (port 5001) that proxies Docker Hub.
#      First pull goes to Docker Hub; subsequent pulls are served locally.
#   2. Writes /etc/docker/daemon.json to tell Docker to use it as a mirror.
#   3. Restarts Docker daemon.
#   4. Creates /opt/polyforge-buildcache owned by the runner user.
#
# Usage (on the runner machine, as a user with sudo):
#   bash scripts/setup-runner-docker-cache.sh
#
# To run against multiple runners:
#   for host in runner1 runner2 runner3; do
#     ssh ubuntu@$host 'bash -s' < scripts/setup-runner-docker-cache.sh
#   done
#
# After setup, ALL docker pulls on this runner go through localhost:5001.
# Images are cached in /var/lib/registry (inside the container) on the
# runner's disk — zero Docker Hub calls for already-cached images.
# Rate limit: effectively eliminated for base images pulled more than once.

set -euo pipefail

REGISTRY_PORT=5001
REGISTRY_NAME=polyforge-docker-cache
REGISTRY_DATA=/opt/docker-registry-cache
BUILDCACHE_DIR=/opt/polyforge-buildcache
RUNNER_USER="${SUDO_USER:-$(whoami)}"

echo "==> Setting up Docker pull-through cache on $(hostname)"

# ── 1. Ensure the registry data dir exists ────────────────────────────────
sudo mkdir -p "$REGISTRY_DATA"
sudo mkdir -p "$BUILDCACHE_DIR"
sudo chown "$RUNNER_USER:$RUNNER_USER" "$BUILDCACHE_DIR"
echo "    Cache dirs: $REGISTRY_DATA, $BUILDCACHE_DIR"

# ── 2. Stop any existing registry container ───────────────────────────────
if docker inspect "$REGISTRY_NAME" &>/dev/null; then
  echo "==> Removing existing registry container..."
  docker rm -f "$REGISTRY_NAME"
fi

# ── 3. Start the pull-through registry ───────────────────────────────────
echo "==> Starting pull-through registry on port $REGISTRY_PORT..."
docker run -d \
  --name "$REGISTRY_NAME" \
  --restart always \
  -p "127.0.0.1:${REGISTRY_PORT}:5000" \
  -v "${REGISTRY_DATA}:/var/lib/registry" \
  -e REGISTRY_PROXY_REMOTEURL=https://registry-1.docker.io \
  -e REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=/var/lib/registry \
  registry:2

echo "    Registry running: http://localhost:${REGISTRY_PORT}"

# ── 4. Configure Docker daemon to mirror through local registry ───────────
echo "==> Configuring Docker daemon mirror..."

DAEMON_JSON=/etc/docker/daemon.json

# Merge with existing daemon.json if it exists
if [[ -f "$DAEMON_JSON" ]]; then
  echo "    Existing daemon.json found — merging registry-mirrors..."
  # Use python3 to merge JSON safely
  sudo python3 - <<PYEOF
import json, sys

with open('$DAEMON_JSON') as f:
    cfg = json.load(f)

mirrors = cfg.get('registry-mirrors', [])
new_mirror = 'http://localhost:$REGISTRY_PORT'
if new_mirror not in mirrors:
    mirrors.insert(0, new_mirror)
cfg['registry-mirrors'] = mirrors

with open('$DAEMON_JSON', 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print('Merged:', json.dumps(cfg, indent=2))
PYEOF
else
  echo "    Writing new daemon.json..."
  sudo tee "$DAEMON_JSON" > /dev/null <<JSON
{
  "registry-mirrors": ["http://localhost:${REGISTRY_PORT}"]
}
JSON
fi

echo "    daemon.json:"
sudo cat "$DAEMON_JSON"

# ── 5. Restart Docker to apply mirror config ──────────────────────────────
echo "==> Restarting Docker daemon..."
sudo systemctl restart docker

# Wait for Docker to come back
sleep 3
docker info | grep -A5 "Registry Mirrors" || echo "    (daemon.json applied — restart GitHub Actions runner service too)"

# ── 6. Warm up the cache with commonly used images ───────────────────────
echo "==> Warming cache with common base images..."
WARM_IMAGES=(
  "node:24-alpine"
  "nginx:1.27-alpine"
  "redis:7-alpine"
  "postgres:16-alpine"
)
for img in "${WARM_IMAGES[@]}"; do
  echo "    Pulling $img..."
  docker pull "$img" || echo "    Warning: could not pull $img"
done

# ── 7. Remind about runner service restart ───────────────────────────────
echo ""
echo "==> IMPORTANT: restart the GitHub Actions runner service so it picks"
echo "    up the new Docker daemon config:"
echo ""
echo "    sudo systemctl restart actions.runner.*.service"
echo "    # or for each runner:"
echo "    ls /etc/systemd/system/actions.runner.*.service"
echo ""
echo "==> Done. Pull-through cache is active:"
echo "    Cache data: $REGISTRY_DATA"
echo "    BuildKit layer cache: $BUILDCACHE_DIR"
echo "    Mirror: http://localhost:$REGISTRY_PORT → registry-1.docker.io"
