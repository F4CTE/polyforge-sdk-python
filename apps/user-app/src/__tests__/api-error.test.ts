import { describe, expect, it, vi } from 'vitest';
import {
  createApiErrorNotifier,
  formatApiError,
  parseApiErrorResponse,
} from '../lib/api-error';

describe('API error feedback', () => {
  it('uses backend message, suggestion, and request id when available', async () => {
    const response = new Response(JSON.stringify({
      message: 'Insufficient balance',
      suggestion: 'Deposit funds or lower the order size.',
      requestId: 'req-123',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    const formatted = await parseApiErrorResponse(response, 'Order failed');

    expect(formatted.message).toBe('Insufficient balance');
    expect(formatted.description).toBe('Deposit funds or lower the order size. Request ID: req-123');
    expect(formatted.dedupeKey).toBe('400:Insufficient balance:Deposit funds or lower the order size.');
  });

  it('falls back instead of exposing internal error details', () => {
    const formatted = formatApiError({
      status: 500,
      fallbackMessage: 'Order failed',
      body: {
        message: 'PrismaClientKnownRequestError: Unique constraint failed at /srv/app/order.service.ts:42',
        requestId: 'req-500',
      },
    });

    expect(formatted.message).toBe('Order failed');
    expect(formatted.description).toBe('Request ID: req-500');
  });

  it('dedupes repeated equivalent toast errors inside the dedupe window', () => {
    const toastError = vi.fn();
    const notify = createApiErrorNotifier({
      toastError,
      now: () => 1_000,
      dedupeMs: 5_000,
    });
    const formatted = formatApiError({
      status: 400,
      fallbackMessage: 'Order failed',
      body: { message: 'Insufficient balance' },
    });

    notify(formatted);
    notify(formatted);

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('Insufficient balance', expect.objectContaining({
      id: formatted.dedupeKey,
    }));
  });
});
