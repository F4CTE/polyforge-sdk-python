import { describe, expect, it } from 'vitest';
import { formatOrderEventToast } from '../lib/order-events';

describe('order event feedback', () => {
  it('formats ORDER_FAILED with top-level reason and short order id', () => {
    expect(formatOrderEventToast({
      type: 'ORDER_FAILED',
      orderId: 'ord_1234567890abcdef',
      reason: 'Insufficient balance',
    })).toEqual({
      kind: 'error',
      message: 'Order failed: Insufficient balance · ord_1234...',
    });
  });

  it('formats ORDER_FAILED with nested data.reason when top-level reason is absent', () => {
    expect(formatOrderEventToast({
      type: 'ORDER_FAILED',
      data: {
        orderId: 'ord_nested_abcdef',
        reason: 'Price moved beyond limit',
      },
    })).toEqual({
      kind: 'error',
      message: 'Order failed: Price moved beyond limit · ord_nest...',
    });
  });

  it('keeps generic copy when ORDER_FAILED has no useful reason', () => {
    expect(formatOrderEventToast({ type: 'ORDER_FAILED' })).toEqual({
      kind: 'error',
      message: 'Order failed',
    });
  });
});
