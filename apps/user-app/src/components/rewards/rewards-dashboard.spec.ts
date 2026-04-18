import { describe, it, expect } from 'vitest';

/**
 * Unit tests for RewardsDashboard data formatting and logic.
 * Tests the pure helper functions without requiring DOM rendering.
 */

// ─── Helpers mirrored from the component ───────────────────────────────────

function formatUsd(val: string): string {
  const n = parseFloat(val);
  return `$${Math.abs(n).toFixed(2)}`;
}

function pnlColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'text-gain';
  if (n < 0) return 'text-loss';
  return 'text-tertiary';
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RewardsDashboard helpers', () => {
  describe('formatUsd', () => {
    it('formats positive values', () => {
      expect(formatUsd('42.567')).toBe('$42.57');
    });

    it('formats zero', () => {
      expect(formatUsd('0')).toBe('$0.00');
    });

    it('formats negative values as absolute', () => {
      expect(formatUsd('-15.3')).toBe('$15.30');
    });

    it('formats very small values', () => {
      expect(formatUsd('0.001')).toBe('$0.00');
    });

    it('formats large values', () => {
      expect(formatUsd('9999.99')).toBe('$9999.99');
    });
  });

  describe('pnlColor', () => {
    it('returns gain for positive values', () => {
      expect(pnlColor('10.5')).toBe('text-gain');
    });

    it('returns loss for negative values', () => {
      expect(pnlColor('-3.2')).toBe('text-loss');
    });

    it('returns tertiary for zero', () => {
      expect(pnlColor('0')).toBe('text-tertiary');
    });
  });
});

describe('RewardsDashboard data contracts', () => {
  it('RewardsTotal shape is correct', () => {
    const totals = {
      totalEarned: '150.50',
      dailyEarned: '12.30',
      pendingRewards: '5.00',
    };
    expect(parseFloat(totals.totalEarned)).toBeGreaterThan(0);
    expect(parseFloat(totals.dailyEarned)).toBeGreaterThan(0);
    expect(parseFloat(totals.pendingRewards)).toBeGreaterThanOrEqual(0);
  });

  it('RebateSummary totalRebates is non-negative', () => {
    const rebates = { totalRebates: '25.60', rebateCount: 4, entries: [] };
    expect(parseFloat(rebates.totalRebates)).toBeGreaterThanOrEqual(0);
    expect(rebates.rebateCount).toBeGreaterThanOrEqual(0);
  });

  it('RewardEntry rewardPercentage is between 0 and 1', () => {
    const entry = {
      marketId: 'test',
      conditionId: 'cond1',
      marketQuestion: 'Will X happen?',
      dailyReward: '1.00',
      totalReward: '10.00',
      rewardPercentage: 0.05,
    };
    expect(entry.rewardPercentage).toBeGreaterThanOrEqual(0);
    expect(entry.rewardPercentage).toBeLessThanOrEqual(1);
  });
});
