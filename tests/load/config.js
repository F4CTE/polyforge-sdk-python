import http from 'k6/http';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost';
export const AUTH_URL = `${BASE_URL}/auth/v1`;
export const API_URL = `${BASE_URL}/api/v1`;

export function login(email = 'alice@dev.local', password = 'password123') {
  const res = http.post(`${AUTH_URL}/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  const cookies = res.cookies;
  return { cookies, res };
}

export const thresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};
