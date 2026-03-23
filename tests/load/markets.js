import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { API_URL, login, thresholds } from './config.js';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '4m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds,
};

export default function () {
  const { cookies } = login();
  const params = { cookies };

  group('List markets', () => {
    const res = http.get(`${API_URL}/markets`, params);
    check(res, {
      'list markets returns 200': (r) => r.status === 200,
      'list markets returns array': (r) => {
        const body = r.json();
        return Array.isArray(body) || Array.isArray(body.data);
      },
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Get market detail', () => {
    const listRes = http.get(`${API_URL}/markets`, params);
    const markets = listRes.json().data || listRes.json();
    if (markets && markets.length > 0) {
      const marketId = markets[0].id;
      const res = http.get(`${API_URL}/markets/${marketId}`, params);
      check(res, {
        'market detail returns 200': (r) => r.status === 200,
        'market detail has id': (r) => r.json().id !== undefined,
      });
    }
  });

  sleep(Math.random() * 2 + 1);

  group('Get price history', () => {
    const listRes = http.get(`${API_URL}/markets`, params);
    const markets = listRes.json().data || listRes.json();
    if (markets && markets.length > 0) {
      const tokenId = markets[0].tokenId || markets[0].id;
      const res = http.get(`${API_URL}/markets/${tokenId}/price-history`, params);
      check(res, {
        'price history returns 200': (r) => r.status === 200,
      });
    }
  });

  sleep(Math.random() * 2 + 1);

  group('Search markets', () => {
    const queries = ['bitcoin', 'election', 'sports', 'crypto'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${API_URL}/markets?search=${query}`, params);
    check(res, {
      'search returns 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Filter by category', () => {
    const categories = ['crypto', 'sports', 'politics', 'entertainment'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const res = http.get(`${API_URL}/markets?category=${category}`, params);
    check(res, {
      'category filter returns 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);
}
