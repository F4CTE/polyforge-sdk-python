# Polyforge Load Tests

k6-based load tests covering auth throughput, REST API, WebSocket connections,
the 100-strategy tick pipeline, and resilience under degraded conditions.

## Prerequisites

```bash
# Install k6 (Windows)
winget install k6 --source winget
# or: choco install k6

# Install k6 (macOS/Linux)
brew install k6
```

The full dev stack must be running before executing any test:

```bash
docker compose up -d          # Postgres, Redis, MailHog, mock-polymarket, all services
```

The Angular app is **not** required — tests hit the backends directly.

---

## Running tests

### Smoke check (1 VU × 10s per scenario — ~2 minutes total)

```bash
bash tests/load/k6/run-all.sh --smoke
```

### Full suite

```bash
bash tests/load/k6/run-all.sh
```

Results are written as JSON summaries to `tests/load/results/`.

### Individual scenarios

```bash
k6 run tests/load/k6/scenarios/01-auth.js
k6 run tests/load/k6/scenarios/02-api-rest.js
k6 run tests/load/k6/scenarios/03-websocket.js
k6 run tests/load/k6/scenarios/04-strategy-pipeline.js
k6 run tests/load/k6/scenarios/05-resilience.js
```

### Override endpoints

```bash
AUTH_URL=http://staging:3001 API_URL=http://staging:3002 \
  k6 run tests/load/k6/scenarios/01-auth.js
```

---

## Scenarios

| # | File | VUs | Duration | What it tests |
|---|------|-----|----------|---------------|
| 01 | `01-auth.js` | 50 login + 20 register | 60s | Login throughput, register burst |
| 02 | `02-api-rest.js` | 100 read + 30 write | 90s | Strategy CRUD, markets list, discover feed |
| 03 | `03-websocket.js` | 200 | 60s | Concurrent WS connections, price subscriptions |
| 04 | `04-strategy-pipeline.js` | setup: 100 strats | 75s | 100 strategies × tickMs=100ms (~1000 ticks/sec), API under tick load |
| 05 | `05-resilience.js` | 50 ws + 20 api | 45s | Rapid WS reconnect, API behaviour under `api_down` scenario |

---

## Thresholds (pass/fail)

| Metric | Threshold |
|--------|-----------|
| Login p95 | < 300ms |
| Login p99 | < 600ms |
| Register p95 | < 500ms |
| REST GET p95 | < 300ms |
| REST write p95 | < 500ms |
| Strategy start p95 | < 500ms |
| WS connect p95 | < 500ms |
| HTTP error rate | < 1% |
| WS error rate | < 1% |
| Resilience error rate | < 5% |

---

## Strategy pipeline test detail

Scenario `04-strategy-pipeline.js` uses k6's `setup()` / `teardown()` hooks to:

1. **Setup** — Log in 5 seed users, each creates 20 strategies (100 total) with
   `tickMs: 100` and a `price_crosses_up` trigger. Then starts all 100 in **paper
   mode** (no real Polymarket credentials needed).
2. **Load** — 10 monitor VUs poll `GET /api/v1/strategies` and `GET /api/v1/orders`
   for 75s while the engine is processing ~1000 ticks/sec.
3. **Teardown** — Stops and soft-deletes all 100 test strategies.

The test measures API latency under tick load and verifies the system doesn't
accumulate errors as the engine fires ticks concurrently.

---

## Resilience test: api_down scenario

To test degraded behaviour when mock-polymarket goes down:

```bash
# 1. Switch mock-polymarket to api_down
curl -X POST http://localhost:3099/scenario \
     -H 'Content-Type: application/json' \
     -d '{"scenario":"api_down"}'

# 2. Run resilience scenario
k6 run tests/load/k6/scenarios/05-resilience.js

# 3. Restore normal scenario
curl -X POST http://localhost:3099/scenario \
     -H 'Content-Type: application/json' \
     -d '{"scenario":"normal"}'
```

Expected outcomes:
- Auth service: unaffected (no Polymarket dependency) — p95 < 500ms
- Markets list: served from DB — still 200
- Live price feed: stale (Redis TTL expired) — WS emits last-known or pauses
- Running strategies: auto-pause on stale data (>5s threshold)

---

## Interpreting results

k6 prints a summary table at the end of each run. Key columns:

- `avg` / `p(95)` / `p(99)` — latency distribution
- `rate` — requests per second
- `fails` — threshold violations (non-zero = test failed)

JSON summaries in `tests/load/results/` can be imported into Grafana or
diffed between runs to track regressions.
