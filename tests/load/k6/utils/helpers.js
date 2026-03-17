/**
 * Shared k6 helpers for Polyforge load tests.
 *
 * Import in each scenario:
 *   import { login, createStrategy, BASE_URL, API_URL, AUTH_URL } from '../utils/helpers.js';
 */

import http  from 'k6/http';
import { check, fail } from 'k6';

export const AUTH_URL = __ENV.AUTH_URL || 'http://localhost:3001';
export const API_URL  = __ENV.API_URL  || 'http://localhost:3002';
export const WS_URL   = __ENV.WS_URL   || 'ws://localhost:3002/ws';

// Pre-seeded users (verified + active)
export const SEED_USERS = [
    { email: 'alice@dev.local',   password: 'password123' },
    { email: 'bob@dev.local',     password: 'password123' },
    { email: 'charlie@dev.local', password: 'password123' },
    { email: 'carol@dev.local',   password: 'password123' },
    { email: 'dave@dev.local',    password: 'password123' },
];

// Sample token IDs from mock-polymarket fixture markets
export const TOKEN_IDS = [
    'tok-yes-1', 'tok-yes-2', 'tok-yes-3',
    'tok-yes-4', 'tok-yes-5', 'tok-yes-6',
    'tok-yes-7', 'tok-yes-8', 'tok-yes-9', 'tok-yes-10',
];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Login and return { token, userId }.
 * Fails the VU if login is unsuccessful.
 */
export function login(email, password) {
    const res = http.post(
        `${AUTH_URL}/auth/v1/login`,
        JSON.stringify({ email, password }),
        { headers: JSON_HEADERS, tags: { name: 'auth/login' } },
    );

    const ok = check(res, {
        'login 200': r => r.status === 200,
        'login has token': r => {
            try { return !!JSON.parse(r.body).token; } catch { return false; }
        },
    });

    if (!ok) fail(`login failed for ${email}: ${res.status} ${res.body}`);

    const body = JSON.parse(res.body);
    return { token: body.token, userId: body.user.id };
}

/**
 * Rotate through seed users by VU index so each VU gets its own user.
 */
export function seedUser() {
    const idx = (__VU - 1) % SEED_USERS.length;
    return SEED_USERS[idx];
}

/**
 * Authenticated JSON headers.
 */
export function authHeaders(token) {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

/**
 * Create a minimal strategy and return its id.
 * Uses paper mode so no credentials are needed.
 */
export function createStrategy(token, nameSuffix = '') {
    const tokenId = TOKEN_IDS[Math.floor(Math.random() * TOKEN_IDS.length)];
    const body = {
        name:       `load-test-${__VU}-${__ITER}${nameSuffix}`,
        visibility: 'PRIVATE',
        execMode:   'TICK',
        tickMs:     100,
        triggers:   [{ type: 'price_crosses_up', config: { tokenId, threshold: '0.50' } }],
        conditions: [],
        actions:    [{ type: 'buy_yes', config: { tokenId, size: '1' } }],
        safety:     [{ type: 'stop_if_daily_loss', config: { maxLossUsdc: '10' } }],
        tags:       ['load-test'],
    };

    const res = http.post(
        `${API_URL}/api/v1/strategies`,
        JSON.stringify(body),
        { headers: authHeaders(token), tags: { name: 'strategies/create' } },
    );

    check(res, { 'strategy created 201': r => r.status === 201 });

    if (res.status !== 201) return null;
    return JSON.parse(res.body).id;
}

/**
 * Delete a strategy (soft-delete / archive).
 */
export function deleteStrategy(token, strategyId) {
    http.del(
        `${API_URL}/api/v1/strategies/${strategyId}`,
        null,
        { headers: authHeaders(token), tags: { name: 'strategies/delete' } },
    );
}

/**
 * Start a strategy in paper mode.
 */
export function startStrategy(token, strategyId) {
    const res = http.post(
        `${API_URL}/api/v1/strategies/${strategyId}/start`,
        JSON.stringify({ mode: 'paper' }),
        { headers: authHeaders(token), tags: { name: 'strategies/start' } },
    );
    check(res, { 'strategy started 200': r => r.status === 200 });
    return res.status === 200;
}

/**
 * Stop a strategy.
 */
export function stopStrategy(token, strategyId) {
    http.post(
        `${API_URL}/api/v1/strategies/${strategyId}/stop`,
        null,
        { headers: authHeaders(token), tags: { name: 'strategies/stop' } },
    );
}

/**
 * Generate a unique email for dynamic user registration.
 * k6 doesn't have Date.now() — use VU + iteration instead.
 */
export function uniqueEmail(prefix = 'load') {
    return `${prefix}+vu${__VU}-it${__ITER}@load.test.local`;
}

export function uniqueUsername(prefix = 'loaduser') {
    return `${prefix}${__VU}x${__ITER}`.slice(0, 20);
}
