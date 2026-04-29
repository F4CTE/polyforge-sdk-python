import { afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  const module = await import('../../vite.config');
  return module.default;
}

describe('admin app Vite proxy', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('routes API requests to the admin services by default', async () => {
    delete process.env.ADMIN_API_URL;
    delete process.env.ADMIN_AUTH_API_URL;
    delete process.env.API_URL;
    delete process.env.AUTH_API_URL;

    const config = await loadConfig();

    expect(config.server?.proxy?.['/api']).toBe('http://localhost:3004');
    expect(config.server?.proxy?.['/auth']).toBe('http://localhost:3003');
  });

  it('does not route admin requests to generic user service env vars', async () => {
    delete process.env.ADMIN_API_URL;
    delete process.env.ADMIN_AUTH_API_URL;
    process.env.API_URL = 'http://localhost:3002';
    process.env.AUTH_API_URL = 'http://localhost:3001';

    const config = await loadConfig();

    expect(config.server?.proxy?.['/api']).toBe('http://localhost:3004');
    expect(config.server?.proxy?.['/auth']).toBe('http://localhost:3003');
  });

  it('allows admin-specific proxy overrides', async () => {
    process.env.ADMIN_API_URL = 'http://admin-api.test:3004';
    process.env.ADMIN_AUTH_API_URL = 'http://admin-auth.test:3003';

    const config = await loadConfig();

    expect(config.server?.proxy?.['/api']).toBe('http://admin-api.test:3004');
    expect(config.server?.proxy?.['/auth']).toBe('http://admin-auth.test:3003');
  });
});
