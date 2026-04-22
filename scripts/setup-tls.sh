#!/usr/bin/env bash
# Generate locally-trusted TLS certs for PolyForge dev via mkcert.
# Run once per machine. Certs survive git clean -fd (gitignored).
#
# Prerequisites: mkcert (apt install mkcert libnss3-tools)
#
# After running this script, start with the SSL overlay:
#   docker compose -f docker-compose.infra.yml -f docker-compose.ssl.yml up -d

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$REPO_DIR/certs"

if ! command -v mkcert &>/dev/null; then
  echo "mkcert not found. Install: sudo apt install mkcert libnss3-tools"
  exit 1
fi

mkcert -install

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

mkcert -cert-file server.crt -key-file server.key \
  localhost 127.0.0.1 ::1 polyforge-lab

echo ""
echo "Certs generated at $CERT_DIR"
echo "Start with: docker compose -f docker-compose.infra.yml -f docker-compose.ssl.yml up -d"
