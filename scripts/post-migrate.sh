#!/usr/bin/env bash
set -euo pipefail

# Run after Prisma migrations to set up TimescaleDB hypertables.
# Usage: bash scripts/post-migrate.sh
#
# Requires DATABASE_URL to be set (or defaults to Prisma's datasource).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HYPERTABLE_SQL="$SCRIPT_DIR/../prisma/migrations/hypertables.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Applying TimescaleDB hypertables..."
psql "$DATABASE_URL" -f "$HYPERTABLE_SQL"

echo "Post-migration complete."
