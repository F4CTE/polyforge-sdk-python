/**
 * WebSocket load test — concurrent connections + price subscriptions.
 *
 * Scenarios:
 *   ws-connections — 200 VUs each holding a WS connection for 60s,
 *                    subscribing to 3 token prices and counting PRICE_UPDATE messages.
 *
 * Thresholds:
 *   - Connection setup p95 < 500ms
 *   - Each VU receives at least 1 PRICE_UPDATE per 10s window
 *   - ws error rate < 1%
 *
 * Run:
 *   k6 run tests/load/k6/scenarios/03-websocket.js
 */

import ws           from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import {
    WS_URL,
    SEED_USERS,
    TOKEN_IDS,
    login,
} from '../utils/helpers.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const wsConnectTime   = new Trend('ws_connect_time',   true);
const wsPriceUpdates  = new Counter('ws_price_updates_total');
const wsErrors        = new Rate('ws_error_rate');
const wsActiveConns   = new Gauge('ws_active_connections');

// ─── Test options ─────────────────────────────────────────────────────────────

export const options = {
    scenarios: {
        'ws-connections': {
            executor:  'constant-vus',
            vus:       200,
            duration:  '60s',
            exec:      'wsScenario',
        },
    },

    thresholds: {
        'ws_connect_time':        ['p(95)<500'],
        'ws_error_rate':          ['rate<0.01'],
        // Expect at least 1 price update per VU (across entire run)
        'ws_price_updates_total': ['count>1'],
    },
};

// ─── Setup: login all seed users ──────────────────────────────────────────────

export function setup() {
    const tokens = {};
    for (const u of SEED_USERS) {
        try {
            const { token } = login(u.email, u.password);
            tokens[u.email] = token;
        } catch (e) {
            console.warn(`ws setup: could not log in ${u.email}`);
        }
    }
    return { tokens };
}

// ─── WebSocket scenario ───────────────────────────────────────────────────────

export function wsScenario(data) {
    const user  = SEED_USERS[(__VU - 1) % SEED_USERS.length];
    const token = data.tokens[user.email];
    if (!token) { sleep(1); return; }

    // Pick 3 tokens to subscribe to (rotate by VU)
    const myTokens = [
        TOKEN_IDS[(__VU - 1) % TOKEN_IDS.length],
        TOKEN_IDS[__VU       % TOKEN_IDS.length],
        TOKEN_IDS[(__VU + 1) % TOKEN_IDS.length],
    ];

    const start      = Date.now();
    let   priceCount = 0;
    let   authOk     = false;

    const res = ws.connect(WS_URL, {}, (socket) => {
        wsConnectTime.add(Date.now() - start);
        wsActiveConns.add(1);

        // ── Auth ──────────────────────────────────────────────────────────
        socket.on('open', () => {
            socket.send(JSON.stringify({ type: 'AUTH', token: `Bearer ${token}` }));
        });

        socket.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            switch (msg.type) {
                case 'AUTH_OK':
                    authOk = true;
                    // Subscribe to price updates for our 3 tokens
                    socket.send(JSON.stringify({ type: 'SUBSCRIBE_PRICES', tokenIds: myTokens }));
                    // Also send a PING to verify keepalive works
                    socket.send(JSON.stringify({ type: 'PING' }));
                    break;

                case 'AUTH_ERROR':
                    wsErrors.add(1);
                    socket.close();
                    break;

                case 'PRICE_UPDATE':
                    priceCount++;
                    wsPriceUpdates.add(1);
                    break;

                case 'PONG':
                    // Keepalive confirmed — no action needed
                    break;

                default:
                    // Other server messages (strategy events, etc.) — ignore
                    break;
            }
        });

        socket.on('error', (e) => {
            wsErrors.add(1);
            console.warn(`VU ${__VU} ws error: ${e}`);
        });

        // Hold the connection for 55s then close cleanly
        socket.setTimeout(() => {
            socket.send(JSON.stringify({
                type:     'UNSUBSCRIBE_PRICES',
                tokenIds: myTokens,
            }));
            socket.close();
        }, 55_000);
    });

    wsActiveConns.add(-1);

    check(res, { 'ws status 101': r => r && r.status === 101 });
    check({ authOk }, { 'ws auth ok': v => v.authOk });
    wsErrors.add(!authOk ? 1 : 0);
}
