import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { AUTH_URL, login, thresholds } from './config.js';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '4m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds,
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  group('Login with valid credentials', () => {
    const { res } = login();
    check(res, {
      'login returns 200': (r) => r.status === 200,
      'login response has cookies': (r) => Object.keys(r.cookies).length > 0,
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Register new user', () => {
    const uniqueEmail = `user_${__VU}_${__ITER}_${Date.now()}@load.test`;
    const res = http.post(
      `${AUTH_URL}/register`,
      JSON.stringify({
        email: uniqueEmail,
        password: 'TestPass123!',
        name: `Load Test User ${__VU}`,
      }),
      { headers },
    );
    check(res, {
      'register returns 201': (r) => r.status === 201,
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Login with wrong password', () => {
    const res = http.post(
      `${AUTH_URL}/login`,
      JSON.stringify({ email: 'alice@dev.local', password: 'wrong_password' }),
      { headers },
    );
    check(res, {
      'wrong password returns 401': (r) => r.status === 401,
    });
  });

  sleep(Math.random() * 2 + 1);

  group('Rate limiting verification', () => {
    const responses = [];
    for (let i = 0; i < 20; i++) {
      const res = http.post(
        `${AUTH_URL}/login`,
        JSON.stringify({ email: 'alice@dev.local', password: 'wrong_password' }),
        { headers },
      );
      responses.push(res);
    }
    const rateLimited = responses.some((r) => r.status === 429);
    check(null, {
      'rate limiting kicks in': () => rateLimited,
    });
  });

  sleep(Math.random() * 2 + 1);
}
