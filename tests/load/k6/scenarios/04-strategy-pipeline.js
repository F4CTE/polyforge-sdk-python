/**
 * Strategy engine pipeline load test.
 *
 * Goal: 100 strategies running concurrently at tickMs=100ms
 *       → 10 ticks/strategy/sec × 100 strategies = ~1000 ticks/sec aggregate.
 *
 * Phases:
 *   setup()   — log in 5 seed users, each creates 20 strategies (100 total)
 *   default() — start all 100 strategies in paper mode, let them tick for 60s,
 *               then poll the API for strategy status and order counts
 *   teardown()— stop + delete all test strategies
 *
 * What we measure:
 *   - Time to start all 100 strategies (ramp-up throughput)
 *   - API latency under tick load (GET /api/v1/strategies, GET /api/v1/orders)
 *   - Error rate during sustained tick load
 *
 * Thresholds:
 *   - Strategy start p95 < 500ms
 *   - Status poll p95 < 300ms
 *   - Error rate < 1%
 *
 * Run:
 *   k6 run tests/load/k6/scenarios/04-strategy-pipeline.js
 */

import http         from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
    API_URL,
    SEED_USERS,
    TOKEN_IDS,
    login,
    authHeaders,
    createStrategy,
    startStrategy,
    stopStrategy,
    deleteStrategy,
} from '../utils/helpers.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const startLatency  = new Trend('pipeline_start_latency',  true);
const pollLatency   = new Trend('pipeline_poll_latency',   true);
const pipelineErrors = new Rate('pipeline_error_rate');
const strategiesRunning = new Counter('pipeline_strategies_started');

// ─── Options ──────────────────────────────────────────────────────────────────

export const options = {
    // Single VU — setup creates & starts all strategies, then polls under load
    scenarios: {
        'pipeline-monitor': {
            executor:  'constant-vus',
            vus:       10,
            duration:  '75s',
            exec:      'monitorScenario',
            startTime: '30s', // Give setup() 30s to start all strategies
        },
    },

    thresholds: {
        'pipeline_start_latency':    ['p(95)<500', 'p(99)<1000'],
        'pipeline_poll_latency':     ['p(95)<300', 'p(99)<500'],
        'pipeline_error_rate':       ['rate<0.01'],
        'http_req_failed':           ['rate<0.01'],
    },
};

// ─── Setup: create + start 100 strategies ─────────────────────────────────────

export function setup() {
    console.log('setup: logging in seed users…');
    const sessions = SEED_USERS.map(u => {
        try {
            const { token, userId } = login(u.email, u.password);
            return { token, userId, email: u.email, strategyIds: [] };
        } catch (e) {
            console.warn(`setup: login failed for ${u.email}: ${e}`);
            return null;
        }
    }).filter(Boolean);

    if (sessions.length === 0) {
        console.error('setup: no sessions established — aborting');
        return { sessions: [] };
    }

    // Each of the 5 users creates 20 strategies = 100 total
    const STRATEGIES_PER_USER = 20;
    console.log(`setup: creating ${sessions.length * STRATEGIES_PER_USER} strategies…`);

    for (const session of sessions) {
        for (let i = 0; i < STRATEGIES_PER_USER; i++) {
            const id = createStrategy(session.token, `-pipeline-${i}`);
            if (id) session.strategyIds.push(id);
        }
        console.log(`setup: ${session.email} created ${session.strategyIds.length} strategies`);
    }

    // Start all strategies in paper mode
    console.log('setup: starting all strategies in paper mode…');
    let started = 0;
    for (const session of sessions) {
        for (const id of session.strategyIds) {
            const t0 = Date.now();
            const ok = startStrategy(session.token, id);
            startLatency.add(Date.now() - t0);
            if (ok) { started++; strategiesRunning.add(1); }
        }
    }
    console.log(`setup: ${started} strategies now RUNNING`);

    return { sessions };
}

// ─── Monitor scenario: poll API while engine ticks ───────────────────────────

export function monitorScenario(data) {
    if (!data.sessions || data.sessions.length === 0) {
        sleep(1);
        return;
    }

    const session = data.sessions[(__VU - 1) % data.sessions.length];
    const hdrs    = authHeaders(session.token);

    group('GET strategies while ticking', () => {
        const res = http.get(`${API_URL}/api/v1/strategies`, {
            headers: hdrs, tags: { name: 'pipeline/strategies-list' },
        });
        pollLatency.add(res.timings.duration);
        const ok = check(res, { 'strategies list 200': r => r.status === 200 });
        pipelineErrors.add(!ok);
    });

    sleep(0.1);

    group('GET orders while ticking', () => {
        const res = http.get(`${API_URL}/api/v1/orders`, {
            headers: hdrs, tags: { name: 'pipeline/orders-list' },
        });
        pollLatency.add(res.timings.duration);
        const ok = check(res, { 'orders list 200': r => r.status === 200 });
        pipelineErrors.add(!ok);
    });

    sleep(0.1);

    // Spot-check a specific strategy detail (if we have one)
    if (session.strategyIds && session.strategyIds.length > 0) {
        const id = session.strategyIds[__ITER % session.strategyIds.length];
        group('GET strategy detail while ticking', () => {
            const res = http.get(`${API_URL}/api/v1/strategies/${id}`, {
                headers: hdrs, tags: { name: 'pipeline/strategy-detail' },
            });
            pollLatency.add(res.timings.duration);
            check(res, { 'strategy detail 200': r => r.status === 200 });
        });
    }

    sleep(0.5);
}

// ─── Teardown: stop + delete all test strategies ──────────────────────────────

export function teardown(data) {
    if (!data.sessions) return;

    console.log('teardown: stopping + deleting test strategies…');
    let deleted = 0;

    for (const session of data.sessions) {
        for (const id of session.strategyIds) {
            stopStrategy(session.token, id);
            sleep(0.05); // brief pause to avoid hammering the stop endpoint
            deleteStrategy(session.token, id);
            deleted++;
        }
    }

    console.log(`teardown: cleaned up ${deleted} strategies`);
}
