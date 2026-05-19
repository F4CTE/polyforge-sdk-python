/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearPendingIdempotencyKey,
  clearPendingIdempotencyKeyForId,
  createIdempotencyKey,
  getOrCreatePendingIdempotencyKey,
  getOrCreatePendingIdempotencyKeyForId,
  IDEMPOTENCY_KEY_HEADER,
  idempotencyHeaders,
} from '../lib/idempotency.ts';

function source(path: string): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  return readFileSync(join(repoRoot, path), 'utf8');
}

function expectFetchHeader(file: string, endpoint: string): void {
  const src = source(file);
  const escapedEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `fetch\\(['"\`]${escapedEndpoint}['"\`][\\s\\S]*?headers:\\s*{[\\s\\S]*?(?:${IDEMPOTENCY_KEY_HEADER}|idempotencyHeaders)`,
  );
  expect(src, `${file} should send ${IDEMPOTENCY_KEY_HEADER} for ${endpoint}`).toMatch(pattern);
}

describe('idempotency keys', () => {
  it('creates bounded keys with a normalized trading prefix', () => {
    const key = createIdempotencyKey('Close Position / YES');

    expect(key).toMatch(/^polyforge-trade-close-position-yes-/);
    expect(key.length).toBeLessThanOrEqual(128);
  });

  it('reuses a pending key while overlapping submits are still in flight', () => {
    const ref = { current: null as string | null };

    const first = getOrCreatePendingIdempotencyKey(ref, 'place-order');
    const duplicate = getOrCreatePendingIdempotencyKey(ref, 'place-order');
    clearPendingIdempotencyKey(ref);
    expect(ref.current).toBe(first);
    const retryWhileDuplicateIsPending = getOrCreatePendingIdempotencyKey(ref, 'place-order');
    clearPendingIdempotencyKey(ref);
    clearPendingIdempotencyKey(ref);
    const next = getOrCreatePendingIdempotencyKey(ref, 'place-order');

    expect(duplicate).toBe(first);
    expect(retryWhileDuplicateIsPending).toBe(first);
    expect(next).not.toBe(first);
  });

  it('keeps independent pending keys by logical id until all overlapping submits finish', () => {
    const ref = { current: {} as Record<string, string | undefined> };

    const closeA = getOrCreatePendingIdempotencyKeyForId(ref, 'pos-a', 'close-position');
    const closeADuplicate = getOrCreatePendingIdempotencyKeyForId(ref, 'pos-a', 'close-position');
    const closeB = getOrCreatePendingIdempotencyKeyForId(ref, 'pos-b', 'close-position');
    clearPendingIdempotencyKeyForId(ref, 'pos-a');
    expect(ref.current['pos-a']).toBe(closeA);
    const closeARetryWhileDuplicateIsPending = getOrCreatePendingIdempotencyKeyForId(ref, 'pos-a', 'close-position');
    clearPendingIdempotencyKeyForId(ref, 'pos-a');
    clearPendingIdempotencyKeyForId(ref, 'pos-a');
    const closeANext = getOrCreatePendingIdempotencyKeyForId(ref, 'pos-a', 'close-position');

    expect(closeADuplicate).toBe(closeA);
    expect(closeB).not.toBe(closeA);
    expect(closeARetryWhileDuplicateIsPending).toBe(closeA);
    expect(closeANext).not.toBe(closeA);
  });

  it('builds the API header object', () => {
    expect(idempotencyHeaders('idem-key')).toEqual({ [IDEMPOTENCY_KEY_HEADER]: 'idem-key' });
  });
});

describe('trading POST idempotency callsites', () => {
  it('sends Idempotency-Key from market trading submits', () => {
    const file = 'apps/user-app/src/pages/markets/market-detail.tsx';

    expectFetchHeader(file, '/api/v1/orders/conditional');
    expectFetchHeader(file, '/api/v1/lp/provide');
    expectFetchHeader(file, '/api/v1/orders/place');
  });

  it('sends Idempotency-Key from orders, portfolio, and arbitrage submits', () => {
    expectFetchHeader('apps/user-app/src/pages/orders/orders.tsx', '/api/v1/orders/conditional');
    expectFetchHeader('apps/user-app/src/pages/portfolio/portfolio.tsx', '/api/v1/orders/close-position');
    expectFetchHeader('apps/user-app/src/pages/portfolio/portfolio.tsx', '/api/v1/orders/redeem');
    expectFetchHeader('apps/user-app/src/pages/arbitrage/arbitrage.tsx', '/api/v1/orders/place');
  });

  it('documents Idempotency-Key in trading API examples', () => {
    const docs = source('apps/user-app/src/pages/api-docs/api-docs-endpoints.ts');

    expect(docs).toContain('-H "Idempotency-Key: place-order-uuid"');
    expect(docs).toContain('-H "Idempotency-Key: close-position-uuid"');
    expect(docs).toContain('-H "Idempotency-Key: conditional-order-uuid"');
  });
});
