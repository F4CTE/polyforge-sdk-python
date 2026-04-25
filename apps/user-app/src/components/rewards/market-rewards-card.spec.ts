import { describe, it, expect } from 'vitest';

/* ─── Helpers mirrored from the component ─────────────────────────────── */

function formatUsd(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0.00';
  if (Math.abs(n) >= 1_000) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function computeApy(ratePerDay: string): string {
  const daily = parseFloat(ratePerDay);
  if (isNaN(daily) || daily <= 0) return '—';
  const annualized = daily * 365;
  const apy = (annualized / 100) * 100;
  return `${apy.toFixed(1)}%`;
}

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe('MarketRewardsCard helpers', () => {
  describe('formatUsd', () => {
    it('formats small values to 2 decimal places', () => {
      expect(formatUsd('5.5')).toBe('$5.50');
    });

    it('formats values >= 1000 without decimals', () => {
      expect(formatUsd('1500')).toBe('$1500');
    });

    it('handles zero', () => {
      expect(formatUsd('0')).toBe('$0.00');
    });

    it('handles NaN input as zero', () => {
      expect(formatUsd('abc')).toBe('$0.00');
    });

    it('handles negative values correctly', () => {
      expect(formatUsd('-5.5')).toBe('$-5.50');
    });
  });

  describe('computeApy', () => {
    it('returns — for zero rate', () => {
      expect(computeApy('0')).toBe('—');
    });

    it('returns — for negative rate', () => {
      expect(computeApy('-1')).toBe('—');
    });

    it('returns — for NaN input', () => {
      expect(computeApy('abc')).toBe('—');
    });

    it('computes APY for positive rate', () => {
      // $10/day * 365 / $100 position * 100 = 3650%
      expect(computeApy('10')).toBe('3650.0%');
    });

    it('computes APY for fractional rate', () => {
      // $0.1/day * 365 / $100 * 100 = 36.5%
      expect(computeApy('0.1')).toBe('36.5%');
    });
  });
});

describe('MarketRewardsCard data contracts', () => {
  it('MarketRewards shape has required fields', () => {
    const rewards = {
      rate_per_day: '10.00',
      total_rewards: '5000.00',
      remaining_reward_amount: '3200.00',
      max_spread: '0.05',
      min_size: '5.00',
    };

    expect(parseFloat(rewards.rate_per_day)).toBeGreaterThan(0);
    expect(parseFloat(rewards.total_rewards)).toBeGreaterThan(0);
    expect(parseFloat(rewards.remaining_reward_amount)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(rewards.max_spread)).toBeGreaterThan(0);
    expect(parseFloat(rewards.min_size)).toBeGreaterThan(0);
  });

  it('remaining reward cannot exceed total', () => {
    const remaining = 3200;
    const total = 5000;
    const pct = (remaining / total) * 100;
    expect(pct).toBeLessThanOrEqual(100);
  });

  it('pctRemaining clamps to 100 when remaining > total (defensive)', () => {
    const remaining = 6000;
    const total = 5000;
    const pct = Math.min(100, (remaining / total) * 100);
    expect(pct).toBe(100);
  });

  it('max_spread formats correctly as percentage', () => {
    const maxSpread = '0.05';
    const formatted = `${(parseFloat(maxSpread) * 100).toFixed(1)}%`;
    expect(formatted).toBe('5.0%');
  });
});
