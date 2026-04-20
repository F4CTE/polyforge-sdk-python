#!/usr/bin/env bash
# ─── Polyforge k6 Load Test Suite ────────────────────────────────────────────
#
# Runs all load test scenarios in order.  Each scenario writes a JSON summary
# to tests/load/results/ so you can compare runs.
#
# Prerequisites:
#   - k6 installed (https://k6.io/docs/get-started/installation/)
#   - Full dev stack running: docker compose up -d
#   - Angular app NOT required (tests hit backend only)
#
# Usage:
#   bash tests/load/k6/run-all.sh [--smoke]
#
#   --smoke  Run each scenario with 1 VU for 10s (quick sanity check)
#
# Environment overrides:
#   AUTH_URL=http://localhost:3001
#   API_URL=http://localhost:3002
#   WS_URL=ws://localhost:3002/ws

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "$RESULTS_DIR"

SMOKE=${1:-""}
TIMESTAMP=$(date +%Y%m%dT%H%M%S)

run_scenario() {
  local name="$1"
  local file="$2"
  shift 2
  local extra_args=("$@")

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local out_file="${RESULTS_DIR}/${TIMESTAMP}-${name}.json"

  if [[ "$SMOKE" == "--smoke" ]]; then
    k6 run \
      --vus 1 \
      --duration 10s \
      --summary-export "$out_file" \
      "${extra_args[@]}" \
      "$file" && echo "  ✓ PASSED" || echo "  ✗ FAILED (check output above)"
  else
    k6 run \
      --summary-export "$out_file" \
      "${extra_args[@]}" \
      "$file" && echo "  ✓ PASSED" || echo "  ✗ FAILED (check output above)"
  fi
}

echo ""
echo "Polyforge Load Test Suite — $(date)"
echo "Results directory: $RESULTS_DIR"
[[ "$SMOKE" == "--smoke" ]] && echo "MODE: smoke (1 VU × 10s per scenario)"

# ── 01: Auth throughput ───────────────────────────────────────────────────────
run_scenario "01-auth" "${SCRIPT_DIR}/scenarios/01-auth.js"

# ── 02: REST API ──────────────────────────────────────────────────────────────
run_scenario "02-api-rest" "${SCRIPT_DIR}/scenarios/02-api-rest.js"

# ── 03: WebSocket ─────────────────────────────────────────────────────────────
run_scenario "03-websocket" "${SCRIPT_DIR}/scenarios/03-websocket.js"

# ── 04: Strategy pipeline (100 strategies × 1000 ticks/sec) ──────────────────
run_scenario "04-strategy-pipeline" "${SCRIPT_DIR}/scenarios/04-strategy-pipeline.js"

# ── 05: Resilience ────────────────────────────────────────────────────────────
echo ""
echo "NOTE: scenario 05 (resilience) tests degraded conditions."
echo "To run the api_down sub-scenario, first switch the CLOB API scenario:"
echo "  curl -X POST http://localhost:3099/scenario -d '{\"scenario\":\"api_down\"}'"
echo "Then re-run: k6 run tests/load/k6/scenarios/05-resilience.js"
run_scenario "05-resilience" "${SCRIPT_DIR}/scenarios/05-resilience.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All scenarios complete. JSON summaries in: $RESULTS_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
