#!/usr/bin/env bash
set -uo pipefail

shard_count="${E2E_SHARD_COUNT:-5}"
shard_timeout_seconds="${E2E_SHARD_TIMEOUT_SECONDS:-2100}"
global_timeout_ms="${PLAYWRIGHT_GLOBAL_TIMEOUT_MS:-2100000}"
project="${PLAYWRIGHT_PROJECT:-chromium}"
output_dir="${PLAYWRIGHT_OUTPUT_DIR:-test-results}"

pids=()

terminate_shards() {
  local pid
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap 'terminate_shards; exit 130' INT
trap 'terminate_shards; exit 143' TERM

run_shard() {
  local shard="$1"
  echo "=== Starting E2E shard ${shard}/${shard_count} ==="
  BASE_URL="${BASE_URL:-https://localhost}" \
    CI="${CI:-true}" \
    PLAYWRIGHT_SKIP_GLOBAL_SETUP=true \
    E2E_SHARED_MAILBOX=true \
    exec timeout --kill-after=10s "$shard_timeout_seconds" npx playwright test \
      --project="$project" \
      --reporter=list \
      --shard="${shard}/${shard_count}" \
      --output="${output_dir}/shard-${shard}" \
      --global-timeout="$global_timeout_ms"
}

for shard in $(seq 1 "$shard_count"); do
  run_shard "$shard" &
  pids+=("$!")
done

remaining="$shard_count"
while [ "$remaining" -gt 0 ]; do
  wait -n
  status="$?"
  if [ "$status" -ne 0 ]; then
    echo "=== E2E shard failed (exit: ${status}); terminating remaining shards ==="
    terminate_shards
    exit "$status"
  fi
  remaining="$((remaining - 1))"
done

echo "=== All E2E shards complete (exit: 0) ==="
