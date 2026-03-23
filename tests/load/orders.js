import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { API_URL, login, thresholds } from './config.js';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '4m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds,
};

export default function () {
  const { cookies } = login();
  const params = { cookies };

  group('List orders with pagination', () => {
    const pages = [1, 2, 3];
    for (const page of pages) {
      const res = http.get(`${API_URL}/orders?page=${page}&limit=20`, params);
      check(res, {
        [`orders page ${page} returns 200`]: (r) => r.status === 200,
      });
      sleep(0.5);
    }
  });

  sleep(Math.random() * 2 + 1);

  group('Get portfolio', () => {
    const res = http.get(`${API_URL}/portfolio`, params);
    check(res, {
      'portfolio returns 200': (r) => r.status === 200,
      'portfolio has data': (r) => {
        const body = r.json();
        return body !== null && body !== undefined;
      },
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Get portfolio PnL', () => {
    const res = http.get(`${API_URL}/portfolio/pnl`, params);
    check(res, {
      'portfolio pnl returns 200': (r) => r.status === 200,
      'portfolio pnl has data': (r) => {
        const body = r.json();
        return body !== null && body !== undefined;
      },
    });
  });

  sleep(Math.random() * 2 + 1);
}
