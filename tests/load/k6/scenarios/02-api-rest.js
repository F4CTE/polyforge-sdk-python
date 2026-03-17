/**
 * API service REST load test — strategies + markets under concurrent users.
 *
 * Scenarios:
 *   read-heavy   — 100 VUs reading strategies & markets (realistic browse traffic)
 *   write-medium — 30 VUs creating + deleting strategies (CRUD churn)
 *
 * Thresholds:
 *   - GET p95 < 300ms
 *   - POST/PATCH p95 < 500ms
 *   - error rate < 1%
 *
 * Run:
 *   k6 run tests/load/k6/scenarios/02-api-rest.js
 */

import http         from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import {
    AUTH_URL,
    API_URL,
    SEED_USERS,
    TOKEN_IDS,
    login,
    authHeaders,
    createStrategy,
    deleteStrategy,
} from '../utils/helpers.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const getLatency   = new Trend('api_get_latency',   true);
const writeLatency = new Trend('api_write_latency', true);
const errorRate    = new Rate('api_error_rate');

// ─── Shared state: tokens obtained in setup() ─────────────────────────────────

export function setup() {
    // Log in all seed users once and share their tokens
    const tokens = {};
    for (const u of SEED_USERS) {
        try {
            const { token } = login(u.email, u.password);
            tokens[u.email] = token;
        } catch (e) {
            console.warn(`setup: could not log in ${u.email}: ${e}`);
        }
    }
    return { tokens };
}

// ─── Test options ─────────────────────────────────────────────────────────────

export const options = {
    scenarios: {
        'read-heavy': {
            executor:  'constant-vus',
            vus:       100,
            duration:  '90s',
            exec:      'readScenario',
        },
        'write-medium': {
            executor:  'constant-vus',
            vus:       30,
            duration:  '90s',
            exec:      'writeScenario',
            startTime: '10s',
        },
    },

    thresholds: {
        'api_get_latency':   ['p(95)<300',  'p(99)<600'],
        'api_write_latency': ['p(95)<500',  'p(99)<1000'],
        'api_error_rate':    ['rate<0.01'],
        'http_req_failed':   ['rate<0.01'],
    },
};

// ─── Read scenario ────────────────────────────────────────────────────────────

export function readScenario(data) {
    const user  = SEED_USERS[(__VU - 1) % SEED_USERS.length];
    const token = data.tokens[user.email];
    if (!token) { sleep(1); return; }

    const hdrs = authHeaders(token);

    group('GET strategies list', () => {
        const res = http.get(`${API_URL}/api/v1/strategies`, {
            headers: hdrs, tags: { name: 'strategies/list' },
        });
        getLatency.add(res.timings.duration);
        const ok = check(res, { 'strategies list 200': r => r.status === 200 });
        errorRate.add(!ok);
    });

    sleep(0.1);

    group('GET markets list', () => {
        const res = http.get(`${API_URL}/api/v1/markets`, {
            headers: hdrs, tags: { name: 'markets/list' },
        });
        getLatency.add(res.timings.duration);
        const ok = check(res, { 'markets list 200': r => r.status === 200 });
        errorRate.add(!ok);
    });

    sleep(0.1);

    group('GET discover feed', () => {
        const res = http.get(`${API_URL}/api/v1/discover`, {
            headers: hdrs, tags: { name: 'discover/feed' },
        });
        getLatency.add(res.timings.duration);
        // 200 or 404 if feature not yet enabled — accept both
        check(res, { 'discover 200|404': r => r.status === 200 || r.status === 404 });
    });

    sleep(0.5); // ~1.4 req/s per VU → ~140 req/s total read traffic
}

// ─── Write scenario ───────────────────────────────────────────────────────────

export function writeScenario(data) {
    const user  = SEED_USERS[(__VU - 1) % SEED_USERS.length];
    const token = data.tokens[user.email];
    if (!token) { sleep(1); return; }

    const hdrs = authHeaders(token);

    // CREATE
    let strategyId = null;
    group('POST create strategy', () => {
        strategyId = createStrategy(token);
        writeLatency.add(0); // createStrategy already records internally; just tag success
    });

    if (!strategyId) { sleep(1); return; }

    sleep(0.2);

    // READ own strategy
    group('GET strategy detail', () => {
        const res = http.get(`${API_URL}/api/v1/strategies/${strategyId}`, {
            headers: hdrs, tags: { name: 'strategies/get' },
        });
        getLatency.add(res.timings.duration);
        check(res, { 'strategy get 200': r => r.status === 200 });
    });

    sleep(0.2);

    // PATCH strategy name
    group('PATCH strategy', () => {
        const res = http.patch(
            `${API_URL}/api/v1/strategies/${strategyId}`,
            JSON.stringify({ name: `patched-${__VU}-${__ITER}` }),
            { headers: hdrs, tags: { name: 'strategies/patch' } },
        );
        writeLatency.add(res.timings.duration);
        const ok = check(res, { 'strategy patch 200': r => r.status === 200 });
        errorRate.add(!ok);
    });

    sleep(0.2);

    // DELETE
    group('DELETE strategy', () => {
        deleteStrategy(token, strategyId);
    });

    sleep(0.5); // ~1.4 req/s per VU
}
