import { describe, it, expect, afterEach } from 'vitest';
import { throttleLimit } from './throttle-limit';

describe('throttleLimit', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalCI = process.env.CI;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it('returns 10_000 in test environment', () => {
    process.env.NODE_ENV = 'test';
    expect(throttleLimit(5)).toBe(10_000);
  });

  it('returns 10_000 in development environment', () => {
    process.env.NODE_ENV = 'development';
    expect(throttleLimit(5)).toBe(10_000);
  });

  it('returns the production limit in production without CI flag', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CI;
    expect(throttleLimit(5)).toBe(5);
    expect(throttleLimit(60)).toBe(60);
  });

  it('returns 10_000 when CI=true regardless of NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    process.env.CI = 'true';
    expect(throttleLimit(60)).toBe(10_000);
  });
});
