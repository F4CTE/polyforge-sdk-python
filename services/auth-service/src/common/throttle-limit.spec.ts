import { describe, it, expect, afterEach } from 'vitest';
import { throttleLimit } from './throttle-limit';

describe('throttleLimit', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 10_000 in test environment', () => {
    process.env.NODE_ENV = 'test';
    expect(throttleLimit(5)).toBe(10_000);
  });

  it('returns 10_000 in development environment', () => {
    process.env.NODE_ENV = 'development';
    expect(throttleLimit(5)).toBe(10_000);
  });

  it('returns the production limit in production', () => {
    process.env.NODE_ENV = 'production';
    expect(throttleLimit(5)).toBe(5);
    expect(throttleLimit(60)).toBe(60);
  });
});
