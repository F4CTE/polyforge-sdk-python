/**
 * Auth service load test — login & register throughput.
 *
 * Scenarios:
 *   login-throughput  — 50 VUs hammering POST /auth/v1/login for 60s
 *   register-burst    — 20 VUs each registering one new account (one-shot)
 *
 * Thresholds (pass/fail criteria):
 *   - login p95 < 300ms
 *   - register p95 < 500ms
 *   - error rate < 1%
 *
 * Run:
 *   k6 run tests/load/k6/scenarios/01-auth.js
 */

import http         from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
    AUTH_URL,
    SEED_USERS,
    JSON_HEADERS,
    uniqueEmail,
    uniqueUsername,
} from '../utils/helpers.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const loginLatency    = new Trend('login_latency',    true);
const registerLatency = new Trend('register_latency', true);
const loginErrors     = new Rate('login_error_rate');
const registerErrors  = new Rate('register_error_rate');
const loginCount      = new Counter('logins_total');
const registerCount   = new Counter('registrations_total');

// ─── Test options ─────────────────────────────────────────────────────────────

export const options = {
    scenarios: {
        'login-throughput': {
            executor:           'constant-vus',
            vus:                50,
            duration:           '60s',
            exec:               'loginScenario',
        },
        'register-burst': {
            executor:           'per-vu-iterations',
            vus:                20,
            iterations:         1,
            maxDuration:        '30s',
            exec:               'registerScenario',
            startTime:          '5s',   // start 5s into the test
        },
    },

    thresholds: {
        'login_latency':       ['p(95)<300', 'p(99)<600'],
        'register_latency':    ['p(95)<500', 'p(99)<1000'],
        'login_error_rate':    ['rate<0.01'],
        'register_error_rate': ['rate<0.01'],
        // Ensure overall HTTP errors stay below 1%
        'http_req_failed':     ['rate<0.01'],
    },
};

// ─── Login scenario ───────────────────────────────────────────────────────────

const JSON_HDR = { 'Content-Type': 'application/json' };

export function loginScenario() {
    const user = SEED_USERS[(__VU - 1) % SEED_USERS.length];

    const res = http.post(
        `${AUTH_URL}/auth/v1/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        { headers: JSON_HDR, tags: { name: 'auth/login' } },
    );

    loginLatency.add(res.timings.duration);
    loginCount.add(1);

    const ok = check(res, {
        'login status 200':  r => r.status === 200,
        'login has token':   r => {
            try { return !!JSON.parse(r.body).token; } catch { return false; }
        },
    });
    loginErrors.add(!ok);

    sleep(0.2); // 200ms think time → ~5 req/s per VU → 250 req/s total at 50 VUs
}

// ─── Register scenario ────────────────────────────────────────────────────────

export function registerScenario() {
    const email    = uniqueEmail('reg');
    const username = uniqueUsername('reguser');

    const res = http.post(
        `${AUTH_URL}/auth/v1/register`,
        JSON.stringify({
            email,
            username,
            password:    'LoadTest1!',
            tosAccepted: true,
        }),
        { headers: JSON_HDR, tags: { name: 'auth/register' } },
    );

    registerLatency.add(res.timings.duration);
    registerCount.add(1);

    const ok = check(res, {
        'register status 201': r => r.status === 201,
        'register has token':  r => {
            try { return !!JSON.parse(r.body).token; } catch { return false; }
        },
    });
    registerErrors.add(!ok);
}
