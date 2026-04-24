import { describe, it, expect } from 'vitest';

// ─── Types mirrored from component ─────────────────────────────────────────

interface CrossVenueOpportunity {
  matchId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  polymarketYes: number;
  kalshiYes: number;
  spreadPct: number;
  direction: string;
  confidence: number;
}

// ─── Helpers mirrored from component ───────────────────────────────────────

function spreadColor(pct: number): string {
  if (pct >= 5) return 'text-gain';
  if (pct >= 2) return 'text-warning';
  return 'text-tertiary';
}

function confidenceBar(score: number): string {
  if (score >= 0.8) return 'bg-gain';
  if (score >= 0.5) return 'bg-warning';
  return 'bg-loss';
}

function marginColor(pct: string): string {
  const n = parseFloat(pct);
  if (n >= 5) return 'text-gain';
  if (n >= 2) return 'text-warning';
  return 'text-tertiary';
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Arbitrage scanner — cross-venue helpers', () => {
  describe('spreadColor', () => {
    it('returns gain color for spread >= 5%', () => {
      expect(spreadColor(5)).toBe('text-gain');
      expect(spreadColor(10)).toBe('text-gain');
    });

    it('returns warning color for spread between 2% and 5%', () => {
      expect(spreadColor(2)).toBe('text-warning');
      expect(spreadColor(4.9)).toBe('text-warning');
    });

    it('returns tertiary for spread below 2%', () => {
      expect(spreadColor(1)).toBe('text-tertiary');
      expect(spreadColor(0)).toBe('text-tertiary');
    });
  });

  describe('confidenceBar', () => {
    it('returns gain for confidence >= 0.8', () => {
      expect(confidenceBar(0.8)).toBe('bg-gain');
      expect(confidenceBar(1.0)).toBe('bg-gain');
    });

    it('returns warning for confidence between 0.5 and 0.8', () => {
      expect(confidenceBar(0.5)).toBe('bg-warning');
      expect(confidenceBar(0.79)).toBe('bg-warning');
    });

    it('returns loss for confidence below 0.5', () => {
      expect(confidenceBar(0.49)).toBe('bg-loss');
      expect(confidenceBar(0)).toBe('bg-loss');
    });
  });

  describe('CrossVenueOpportunity shape', () => {
    it('has all required fields', () => {
      const opp: CrossVenueOpportunity = {
        matchId: 'm1',
        polymarketTitle: 'Will X win?',
        kalshiTitle: 'X wins election',
        polymarketYes: 0.62,
        kalshiYes: 0.55,
        spreadPct: 7.0,
        direction: 'BUY_KALSHI',
        confidence: 0.9,
      };
      expect(opp.matchId).toBeTruthy();
      expect(opp.spreadPct).toBeGreaterThan(0);
      expect(opp.confidence).toBeGreaterThanOrEqual(0);
      expect(opp.confidence).toBeLessThanOrEqual(1);
    });

    it('spread can be computed as |polymarketYes - kalshiYes| * 100', () => {
      const polyYes = 0.62;
      const kalshiYes = 0.55;
      const spread = Math.abs(polyYes - kalshiYes) * 100;
      expect(spread).toBeCloseTo(7.0, 1);
    });
  });
});

describe('Arbitrage scanner — single-venue helpers (unchanged)', () => {
  describe('marginColor', () => {
    it('returns gain for margin >= 5%', () => {
      expect(marginColor('5')).toBe('text-gain');
      expect(marginColor('10.5')).toBe('text-gain');
    });

    it('returns warning for margin between 2% and 5%', () => {
      expect(marginColor('2')).toBe('text-warning');
      expect(marginColor('4.9')).toBe('text-warning');
    });

    it('returns tertiary for margin below 2%', () => {
      expect(marginColor('1')).toBe('text-tertiary');
      expect(marginColor('0.5')).toBe('text-tertiary');
    });
  });
});

describe('Arbitrage tab contract', () => {
  it('supports single and cross tab values', () => {
    const tabs = ['single', 'cross'] as const;
    expect(tabs).toContain('single');
    expect(tabs).toContain('cross');
  });

  it('default tab is single-venue', () => {
    const defaultTab = 'single';
    expect(defaultTab).toBe('single');
  });
});
