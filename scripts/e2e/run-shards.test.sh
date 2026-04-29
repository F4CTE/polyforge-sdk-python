#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat >"$tmp_dir/npx" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

log_file="${E2E_FAKE_NPX_LOG:?}"
shard="unknown"
for arg in "$@"; do
  case "$arg" in
    --shard=*) shard="${arg#--shard=}"; shard="${shard%%/*}" ;;
  esac
done

echo "start-${shard}" >>"$log_file"
case "$shard" in
  2)
    sleep 0.2
    echo "fail-${shard}" >>"$log_file"
    exit 42
    ;;
  *)
    trap 'echo "terminated-'"$shard"'" >>"'"$log_file"'"; exit 143' TERM INT
    sleep 10
    echo "complete-${shard}" >>"$log_file"
    ;;
esac
SH
chmod +x "$tmp_dir/npx"

export PATH="$tmp_dir:$PATH"
export E2E_FAKE_NPX_LOG="$tmp_dir/npx.log"

start_epoch="$(date +%s)"
set +e
E2E_SHARD_COUNT=3 \
E2E_SHARD_TIMEOUT_SECONDS=30 \
PLAYWRIGHT_GLOBAL_TIMEOUT_MS=30000 \
PLAYWRIGHT_OUTPUT_DIR="$tmp_dir/results" \
  "$repo_root/scripts/e2e/run-shards.sh" >"$tmp_dir/runner.log" 2>&1
status=$?
set -e
elapsed=$(( "$(date +%s)" - start_epoch ))

if [ "$status" -ne 42 ]; then
  echo "Expected exit status 42, got $status"
  cat "$tmp_dir/runner.log"
  exit 1
fi

if [ "$elapsed" -ge 5 ]; then
  echo "Expected fail-fast exit in less than 5s, took ${elapsed}s"
  cat "$tmp_dir/runner.log"
  cat "$E2E_FAKE_NPX_LOG"
  exit 1
fi

if ! grep -Eq 'terminated-(1|3)' "$E2E_FAKE_NPX_LOG"; then
  echo "Expected at least one sibling shard to be terminated"
  cat "$E2E_FAKE_NPX_LOG"
  exit 1
fi

echo "run-shards fail-fast test passed"
