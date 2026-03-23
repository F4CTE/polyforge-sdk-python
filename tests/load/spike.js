import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { API_URL, AUTH_URL, login, thresholds } from './config.js';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ...thresholds,
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Mix of market browsing and auth requests
  if (__ITER % 2 === 0) {
    group('Market browsing (spike)', () => {
      const { cookies } = login();
      const params = { cookies };

      const listRes = http.get(`${API_URL}/markets`, params);
      check(listRes, {
        'spike: list markets returns 200': (r) => r.status === 200,
      });

      sleep(Math.random() + 0.5);

      const markets = (() => {
        try {
          const body = listRes.json();
          return body.data || body;
        } catch {
          return [];
        }
      })();

      if (Array.isArray(markets) && markets.length > 0) {
        const market = markets[Math.floor(Math.random() * markets.length)];
        const detailRes = http.get(`${API_URL}/markets/${market.id}`, params);
        check(detailRes, {
          'spike: market detail returns 200': (r) => r.status === 200,
        });
      }

      const queries = ['bitcoin', 'election', 'sports', 'crypto', 'ai'];
      const query = queries[Math.floor(Math.random() * queries.length)];
      const searchRes = http.get(`${API_URL}/markets?search=${query}`, params);
      check(searchRes, {
        'spike: search returns 200': (r) => r.status === 200,
      });
    });
  } else {
    group('Auth requests (spike)', () => {
      const loginRes = http.post(
        `${AUTH_URL}/login`,
        JSON.stringify({ email: 'alice@dev.local', password: 'password123' }),
        { headers },
      );
      check(loginRes, {
        'spike: login returns 200': (r) => r.status === 200,
      });

      sleep(Math.random() + 0.5);

      const failRes = http.post(
        `${AUTH_URL}/login`,
        JSON.stringify({ email: 'alice@dev.local', password: 'wrong' }),
        { headers },
      );
      check(failRes, {
        'spike: bad login returns 401': (r) => r.status === 401,
      });
    });
  }

  sleep(Math.random() * 2 + 1);
}
