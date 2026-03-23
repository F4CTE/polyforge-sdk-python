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
  const jsonParams = {
    cookies,
    headers: { 'Content-Type': 'application/json' },
  };

  let strategyId;

  group('List strategies', () => {
    const res = http.get(`${API_URL}/strategies`, params);
    check(res, {
      'list strategies returns 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Create strategy', () => {
    const payload = JSON.stringify({
      name: `Load Test Strategy ${__VU}_${__ITER}`,
      description: 'Strategy created during load testing',
      type: 'paper',
      config: {
        maxPositionSize: 100,
        stopLoss: 0.05,
        takeProfit: 0.1,
      },
    });
    const res = http.post(`${API_URL}/strategies`, payload, jsonParams);
    check(res, {
      'create strategy returns 201': (r) => r.status === 201 || r.status === 200,
      'create strategy returns id': (r) => {
        const body = r.json();
        if (body && body.id) {
          strategyId = body.id;
          return true;
        }
        return false;
      },
    });
  });

  sleep(Math.random() * 2 + 1);

  if (strategyId) {
    group('Get strategy detail', () => {
      const res = http.get(`${API_URL}/strategies/${strategyId}`, params);
      check(res, {
        'strategy detail returns 200': (r) => r.status === 200,
        'strategy detail has correct id': (r) => r.json().id === strategyId,
      });
    });

    sleep(Math.random() * 2 + 1);

    group('Start strategy (paper)', () => {
      const res = http.post(`${API_URL}/strategies/${strategyId}/start`, null, jsonParams);
      check(res, {
        'start strategy returns 200': (r) => r.status === 200,
      });
    });

    sleep(Math.random() * 2 + 1);

    group('Stop strategy', () => {
      const res = http.post(`${API_URL}/strategies/${strategyId}/stop`, null, jsonParams);
      check(res, {
        'stop strategy returns 200': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 2 + 1);
}
