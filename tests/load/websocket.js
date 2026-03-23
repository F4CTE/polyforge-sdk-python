import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL } from './config.js';

const wsErrors = new Counter('ws_errors');
const wsMessageLatency = new Trend('ws_message_latency');
const wsConnectionDuration = new Trend('ws_connection_duration');

const WS_URL = BASE_URL.replace('http', 'ws') + '/ws';

export const options = {
  stages: [
    { duration: '1m', target: 250 },
    { duration: '1m', target: 500 },
    { duration: '6m', target: 500 },
    { duration: '1m', target: 250 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    ws_errors: ['count<50'],
    ws_message_latency: ['p(95)<200'],
    ws_connection_duration: ['p(95)<600000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const connectionStart = Date.now();

  const res = ws.connect(WS_URL, {}, function (socket) {
    let pongReceived = false;
    let priceUpdateReceived = false;
    let messageCount = 0;

    socket.on('open', () => {
      // Send AUTH message
      socket.send(
        JSON.stringify({
          type: 'AUTH',
          payload: {
            email: 'alice@dev.local',
            password: 'password123',
          },
        }),
      );

      // Subscribe to price updates
      socket.send(
        JSON.stringify({
          type: 'SUBSCRIBE',
          channel: 'prices',
        }),
      );

      // Send periodic PINGs to verify connection health
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }, 5000);
    });

    socket.on('message', (data) => {
      messageCount++;
      const messageReceived = Date.now();

      try {
        const msg = JSON.parse(data);

        if (msg.type === 'PONG') {
          pongReceived = true;
          if (msg.timestamp) {
            wsMessageLatency.add(messageReceived - msg.timestamp);
          }
        }

        if (msg.type === 'PRICE_UPDATE' || msg.channel === 'prices') {
          priceUpdateReceived = true;
        }
      } catch (e) {
        wsErrors.add(1);
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
    });

    socket.on('close', () => {
      wsConnectionDuration.add(Date.now() - connectionStart);
    });

    // Keep connection open for the duration of the test iteration
    socket.setTimeout(() => {
      check(null, {
        'received PONG responses': () => pongReceived,
        'received price updates': () => priceUpdateReceived,
        'received multiple messages': () => messageCount > 0,
      });
      socket.close();
    }, 30000);
  });

  check(res, {
    'websocket connection established': (r) => r && r.status === 101,
  });

  sleep(Math.random() * 2 + 1);
}
