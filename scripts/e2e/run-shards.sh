#!/usr/bin/env bash
set -uo pipefail

shard_count="${E2E_SHARD_COUNT:-6}"
shard_timeout_seconds="${E2E_SHARD_TIMEOUT_SECONDS:-1800}"
global_timeout_ms="${PLAYWRIGHT_GLOBAL_TIMEOUT_MS:-1800000}"
max_failures="${E2E_MAX_FAILURES:-8}"
project="${PLAYWRIGHT_PROJECT:-chromium}"
run_mobile="${PLAYWRIGHT_RUN_MOBILE:-false}"
mobile_timeout_seconds="${E2E_MOBILE_TIMEOUT_SECONDS:-600}"
output_dir="${PLAYWRIGHT_OUTPUT_DIR:-test-results}"

pids=()

mkdir -p "$output_dir"

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
  local shard_log="${output_dir}/shard-${shard}.log"
  echo "=== Starting E2E shard ${shard}/${shard_count} ==="
  BASE_URL="${BASE_URL:-https://localhost}" \
    CI="${CI:-true}" \
    PLAYWRIGHT_SKIP_GLOBAL_SETUP=true \
    E2E_SHARED_MAILBOX=true \
    timeout --kill-after=10s "$shard_timeout_seconds" npx playwright test \
      --project="$project" \
      --reporter=list \
      --shard="${shard}/${shard_count}" \
      --output="${output_dir}/shard-${shard}" \
      --max-failures="$max_failures" \
      --global-timeout="$global_timeout_ms" \
      --pass-with-no-tests \
      2>&1 | tee "$shard_log"
  local exit_code="${PIPESTATUS[0]}"
  if grep -qE '[0-9]+ (passed|failed)' "$shard_log" 2>/dev/null; then
    touch "${output_dir}/.shard-${shard}-had-tests"
  fi
  return "$exit_code"
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

# Verify at least one shard executed tests. With sparse tag coverage
# (e.g. @mobile excluded via grepInvert), individual shards may legitimately
# have zero matching tests via --pass-with-no-tests. But if ALL shards are
# empty the project/filter configuration is probably broken.
had_tests=$(find "${output_dir}" -maxdepth 1 -name '.shard-*-had-tests' 2>/dev/null | wc -l)
if [ "$had_tests" -eq 0 ]; then
  echo "=== ERROR: No tests executed across any of the ${shard_count} shards ==="
  echo "=== This likely indicates a misconfigured project, tag filter, or testMatch pattern ==="
  exit 1
fi

# Run @mobile tests with the mobile-chromium project after desktop shards finish.
# Mobile tests use device emulation (iPhone SE, 375×812) and touch events.
# They are tagged @mobile and excluded from the desktop chromium project via
# grepInvert, so they must be executed as a separate project pass.
# Skip when the shard loop already ran with mobile-chromium to avoid running
# the same suite twice (once sharded, then again unsharded).
if [ "${run_mobile}" = "true" ] && [ "${project}" != "mobile-chromium" ]; then
  echo "=== Starting E2E mobile tests (project: mobile-chromium) ==="
  BASE_URL="${BASE_URL:-https://localhost}" \
    CI="${CI:-true}" \
    PLAYWRIGHT_SKIP_GLOBAL_SETUP=true \
    E2E_SHARED_MAILBOX=true \
    timeout --kill-after=10s "$mobile_timeout_seconds" npx playwright test \
      --project=mobile-chromium \
      --reporter=list \
      --output="${output_dir}/mobile" \
      --max-failures="$max_failures" \
      --global-timeout="$global_timeout_ms"
  mobile_exit=$?
  if [ "$mobile_exit" -ne 0 ]; then
    echo "=== E2E mobile tests failed (exit: $mobile_exit) ==="
    exit "$mobile_exit"
  fi
  echo "=== E2E mobile tests complete (exit: 0) ==="
fi
