#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Generate self-signed TLS certificates for local development.
# Creates services/gateway/certs/dev.crt and dev.key valid for 365 days.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERT_DIR="$PROJECT_ROOT/services/gateway/certs"

mkdir -p "$CERT_DIR"

# Skip if certs already exist
if [[ -f "$CERT_DIR/dev.crt" && -f "$CERT_DIR/dev.key" ]]; then
  echo "✅ Dev certificates already exist at $CERT_DIR"
  echo "   Delete them and re-run this script to regenerate."
  exit 0
fi

echo "🔐 Generating self-signed TLS certificate for localhost..."

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/dev.key" \
  -out "$CERT_DIR/dev.crt" \
  -subj "//CN=localhost\O=Polyforge Dev" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

echo ""
echo "✅ Certificates generated:"
echo "   Certificate: $CERT_DIR/dev.crt"
echo "   Private key: $CERT_DIR/dev.key"
echo ""
echo "To enable HTTPS locally:"
echo "   1. Set HTTPS_ENABLED=true in .env"
echo "   2. docker compose -f docker-compose.infra.yml up -d --build gateway"
echo "   3. Open https://localhost (accept the self-signed cert warning)"
