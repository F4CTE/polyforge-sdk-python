#!/usr/bin/env bash
# setup-runner-docker-cache.sh
#
# One-time setup: configure Docker caching on a self-hosted GitHub Actions runner.
# Run this directly on the runner machine (not in CI).
#
# What this does:
#   1. Starts a pull-through registry on port 5001 that proxies Docker Hub.
#      First pull goes to Docker Hub; subsequent pulls are served locally.
#   2. Starts a plain OCI registry on port 5002 used exclusively for BuildKit
#      layer cache (buildx bake --cache-to/from type=registry,ref=localhost:5002/…).
#      Kept separate because a proxy registry rejects pushes.
#   3. Writes /etc/docker/daemon.json to use localhost:5001 as a registry mirror.
#   4. Restarts Docker daemon.
#
# Usage (on the runner machine, as a user with sudo):
#   bash scripts/setup-runner-docker-cache.sh
#
# To run against multiple runners:
#   for host in runner1 runner2 runner3; do
#     ssh ubuntu@$host 'bash -s' < scripts/setup-runner-docker-cache.sh
#   done
#
# After setup:
#   - All docker pulls go through localhost:5001 (Docker Hub mirror)
#   - BuildKit build layers are cached in localhost:5002 (atomic OCI, no race conditions)

set -euo pipefail

REGISTRY_PORT=5001
REGISTRY_NAME=polyforge-docker-cache
REGISTRY_DATA=/opt/docker-registry-cache
BUILDCACHE_REGISTRY_PORT=5002
BUILDCACHE_REGISTRY_NAME=polyforge-buildcache-registry
BUILDCACHE_REGISTRY_DATA=/opt/polyforge-buildcache-registry
RUNNER_USER="${SUDO_USER:-$(whoami)}"

echo "==> Setting up Docker pull-through cache on $(hostname)"

# ── 1. Ensure the registry data dirs exist ───────────────────────────────
sudo mkdir -p "$REGISTRY_DATA"
sudo mkdir -p "$BUILDCACHE_REGISTRY_DATA"
sudo chown "$RUNNER_USER:$RUNNER_USER" "$BUILDCACHE_REGISTRY_DATA"
echo "    Cache dirs: $REGISTRY_DATA, $BUILDCACHE_REGISTRY_DATA"

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

echo "    Pull-through registry running: http://localhost:${REGISTRY_PORT}"

# ── 3b. Start the dedicated BuildKit layer-cache registry (port 5002) ────
# This is a plain OCI registry — no REGISTRY_PROXY_REMOTEURL.
# BuildKit uses type=registry cache which pushes blobs here; a proxy registry
# rejects pushes, so we need a separate container.
if docker inspect "$BUILDCACHE_REGISTRY_NAME" &>/dev/null; then
  echo "==> Removing existing build-cache registry container..."
  docker rm -f "$BUILDCACHE_REGISTRY_NAME"
fi

echo "==> Starting BuildKit layer-cache registry on port $BUILDCACHE_REGISTRY_PORT..."
docker run -d \
  --name "$BUILDCACHE_REGISTRY_NAME" \
  --restart always \
  -p "127.0.0.1:${BUILDCACHE_REGISTRY_PORT}:5000" \
  -v "${BUILDCACHE_REGISTRY_DATA}:/var/lib/registry" \
  -e REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=/var/lib/registry \
  registry:2

echo "    Build-cache registry running: http://localhost:${BUILDCACHE_REGISTRY_PORT}"

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
  "node:26-alpine"
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
echo "==> Done. Docker caching is active:"
echo "    Pull-through cache data: $REGISTRY_DATA"
echo "    Pull-through mirror:     http://localhost:$REGISTRY_PORT → registry-1.docker.io"
echo "    BuildKit layer cache:    http://localhost:$BUILDCACHE_REGISTRY_PORT (OCI registry)"
