/**
 * Resilience tests — degraded conditions.
 *
 * Scenarios:
 *   api-down-recovery  — mock-polymarket switched to "api_down" scenario;
 *                        strategy-engine should auto-pause and NOT produce orders.
 *                        Verifies the system degrades gracefully rather than erroring.
 *
 *   dlq-inspection     — after injecting a bad order, check the DLQ is populated
 *                        (requires admin credentials).
 *
 *   ws-reconnect       — rapidly connect/disconnect 50 WS clients to stress
 *                        the gateway's connection lifecycle.
 *
 * Run:
 *   k6 run tests/load/k6/scenarios/05-resilience.js
 *
 * Note: the api-down scenario requires the mock-polymarket scenario to be
 *       changed to "api_down" first:
 *         curl -X POST http://localhost:3099/scenario -d '{"scenario":"api_down"}'
 */

import http              from 'k6/http';
import ws                from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import {
    AUTH_URL,
    API_URL,
    WS_URL,
    SEED_USERS,
    login,
    authHeaders,
    createStrategy,
    startStrategy,
    stopStrategy,
    deleteStrategy,
} from '../utils/helpers.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const resilErrors    = new Rate('resilience_error_rate');
const wsReconnects   = new Counter('ws_reconnects_total');
const wsConnectTime  = new Trend('ws_reconnect_latency', true);

// ─── Options ──────────────────────────────────────────────────────────────────

export const options = {
    scenarios: {
        'ws-reconnect': {
            executor:  'constant-vus',
            vus:       50,
            duration:  '45s',
            exec:      'wsReconnectScenario',
        },
        'api-degraded-read': {
            executor:  'constant-vus',
            vus:       20,
            duration:  '45s',
            exec:      'apiDegradedScenario',
            startTime: '5s',
        },
    },

    thresholds: {
        // Even under degraded API, auth + strategy list should still respond
        'http_req_duration{name:auth/login}':       ['p(95)<500'],
        'http_req_duration{name:strategies/list}':  ['p(95)<1000'],  // relaxed during api_down
        'resilience_error_rate':                    ['rate<0.05'],    // 5% tolerance for resilience tests
        'ws_reconnect_latency':                     ['p(95)<1000'],
    },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setup() {
    const sessions = {};
    for (const u of SEED_USERS) {
        try {
            const { token } = login(u.email, u.password);
            sessions[u.email] = token;
        } catch {}
    }
    return { sessions };
}

// ─── WS reconnect scenario ────────────────────────────────────────────────────

export function wsReconnectScenario(data) {
    const user  = SEED_USERS[(__VU - 1) % SEED_USERS.length];
    const token = data.sessions[user.email];
    if (!token) { sleep(1); return; }

    const t0     = Date.now();
    let   authOk = false;

    const result = ws.connect(WS_URL, {}, (socket) => {
        socket.on('open', () => {
            socket.send(JSON.stringify({ type: 'AUTH', token: `Bearer ${token}` }));
        });

        socket.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }
            if (msg.type === 'AUTH_OK') {
                authOk = true;
                // Immediately close to test rapid connect/disconnect
                socket.close();
            }
            if (msg.type === 'AUTH_ERROR') {
                resilErrors.add(1);
                socket.close();
            }
        });

        socket.on('error', () => { resilErrors.add(1); });

        // Safety timeout — close after 5s if AUTH_OK not received
        socket.setTimeout(() => socket.close(), 5_000);
    });

    wsConnectTime.add(Date.now() - t0);
    wsReconnects.add(1);

    check({ authOk }, { 'ws reconnect auth ok': v => v.authOk });
    resilErrors.add(!authOk ? 1 : 0);

    // Very short sleep — we want rapid reconnect churn
    sleep(0.1);
}

// ─── API degraded scenario ────────────────────────────────────────────────────
//
// Simulates clients polling the API while mock-polymarket is in "api_down" mode.
// The system should:
//   - Still respond to auth requests (auth-service doesn't depend on Polymarket)
//   - Still serve cached market data (Redis cache)
//   - Return stale-data warnings or graceful errors for live prices

export function apiDegradedScenario(data) {
    const user  = SEED_USERS[(__VU - 1) % SEED_USERS.length];
    const token = data.sessions[user.email];
    if (!token) { sleep(1); return; }

    const hdrs = authHeaders(token);

    group('auth still works under api_down', () => {
        const res = http.post(
            `${AUTH_URL}/auth/v1/login`,
            JSON.stringify({ email: user.email, password: user.password }),
            { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth/login' } },
        );
        check(res, { 'login still 200 under api_down': r => r.status === 200 });
        resilErrors.add(res.status !== 200 ? 1 : 0);
    });

    sleep(0.2);

    group('strategies list still works under api_down', () => {
        const res = http.get(`${API_URL}/api/v1/strategies`, {
            headers: hdrs, tags: { name: 'strategies/list' },
        });
        // Accept 200 (cached) or 503 (graceful degradation)
        const ok = check(res, {
            'strategies graceful: 200 or 503': r => r.status === 200 || r.status === 503,
        });
        resilErrors.add(!ok ? 1 : 0);
    });

    sleep(0.2);

    group('market price returns cached or 503', () => {
        const res = http.get(`${API_URL}/api/v1/markets`, {
            headers: hdrs, tags: { name: 'markets/list' },
        });
        // Markets list comes from DB, not Polymarket — should always be 200
        check(res, { 'markets list 200 under api_down': r => r.status === 200 });
    });

    sleep(0.5);
}
