import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Note: this test exercises the request() function via a public adminApi method.
// We can't import refreshSession directly (module-private). Instead, we drive
// many concurrent 401-then-success flows through fetch and assert /auth/v1/refresh
// is called exactly once across the whole storm.

describe('admin api refresh mutex', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('coalesces concurrent 401s into a single refresh call', async () => {
    const calls: string[] = [];
    let refreshCount = 0;
    let healthCallsAfterRefresh = 0;

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/auth/v1/refresh')) {
        refreshCount += 1;
        // Simulate refresh latency so all parallel callers hit the mutex
        return new Promise((resolve) =>
          setTimeout(() => resolve(new Response('{}', { status: 200 })), 20),
        );
      }
      // First call to /api/v1/dashboard returns 401, subsequent calls (after refresh) return 200
      if (url.includes('/api/v1/dashboard')) {
        if (refreshCount === 0) {
          return Promise.resolve(new Response(JSON.stringify({ message: 'expired' }), { status: 401 }));
        }
        healthCallsAfterRefresh += 1;
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const { adminApi } = await import('../lib/api');

    // Fire 5 concurrent requests — all will get 401 and trigger a refresh attempt.
    // Only one refresh should actually fire across the herd.
    const results = await Promise.all([
      adminApi.health(),
      adminApi.health(),
      adminApi.health(),
      adminApi.health(),
      adminApi.health(),
    ]);

    expect(results).toHaveLength(5);
    expect(refreshCount).toBe(1);
    // All 5 retried successfully after the single refresh
    expect(healthCallsAfterRefresh).toBe(5);
  });
});
