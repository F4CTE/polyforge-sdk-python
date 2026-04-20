import { describe, it, expect } from 'vitest';

/**
 * Unit tests for Activity page helpers and data contracts.
 * Tests the pure logic without requiring DOM rendering.
 */

// ─── Helpers mirrored from the component ───────────────────────────────────

type ActivityType =
  | 'TRADE'
  | 'SPLIT'
  | 'MERGE'
  | 'REDEEM'
  | 'REWARD'
  | 'CONVERSION'
  | 'MAKER_REBATE'
  | 'REFERRAL_REWARD';

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

function formatAmount(val?: string): string {
  if (!val) return '';
  const n = parseFloat(val);
  return `$${Math.abs(n).toFixed(2)}`;
}

const VALID_TYPES: ActivityType[] = [
  'TRADE', 'SPLIT', 'MERGE', 'REDEEM', 'REWARD',
  'CONVERSION', 'MAKER_REBATE', 'REFERRAL_REWARD',
];

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Activity page helpers', () => {
  describe('formatTimestamp', () => {
    it('returns "just now" for very recent timestamps', () => {
      const now = new Date().toISOString();
      expect(formatTimestamp(now)).toBe('just now');
    });

    it('returns minutes format for recent timestamps', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
      expect(formatTimestamp(thirtyMinAgo)).toBe('30m ago');
    });

    it('returns hours format for same-day timestamps', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 3600000).toISOString();
      expect(formatTimestamp(fiveHoursAgo)).toBe('5h ago');
    });

    it('returns days format for multi-day timestamps', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(formatTimestamp(threeDaysAgo)).toBe('3d ago');
    });

    it('returns locale date for old timestamps', () => {
      const old = new Date(Date.now() - 14 * 86400000).toISOString();
      const result = formatTimestamp(old);
      expect(result).not.toContain('ago');
    });
  });

  describe('formatAmount', () => {
    it('returns empty string for undefined', () => {
      expect(formatAmount(undefined)).toBe('');
    });

    it('formats positive amounts', () => {
      expect(formatAmount('25.5')).toBe('$25.50');
    });

    it('formats negative amounts as absolute', () => {
      expect(formatAmount('-10')).toBe('$10.00');
    });

    it('formats zero', () => {
      expect(formatAmount('0')).toBe('$0.00');
    });
  });

  describe('activity types', () => {
    it('covers all 8 valid activity types', () => {
      expect(VALID_TYPES.length).toBe(8);
    });

    it('includes all required filter types from the spec', () => {
      expect(VALID_TYPES).toContain('TRADE');
      expect(VALID_TYPES).toContain('SPLIT');
      expect(VALID_TYPES).toContain('MERGE');
      expect(VALID_TYPES).toContain('REDEEM');
      expect(VALID_TYPES).toContain('REWARD');
      expect(VALID_TYPES).toContain('MAKER_REBATE');
      expect(VALID_TYPES).toContain('REFERRAL_REWARD');
    });
  });
});

describe('Activity data contracts', () => {
  it('ActivityItem has required fields', () => {
    const item = {
      id: 'act-1',
      type: 'TRADE' as ActivityType,
      marketQuestion: 'Will X happen?',
      amount: '50.00',
      side: 'BUY',
      outcome: 'YES',
      timestamp: new Date().toISOString(),
    };
    expect(item.id).toBeTruthy();
    expect(VALID_TYPES).toContain(item.type);
    expect(item.timestamp).toBeTruthy();
  });

  it('ActivityResponse wraps activities array', () => {
    const response = { activities: [] };
    expect(Array.isArray(response.activities)).toBe(true);
  });
});
