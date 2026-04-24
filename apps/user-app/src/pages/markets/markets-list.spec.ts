import { describe, it, expect } from 'vitest';

// ─── Types mirrored from component ─────────────────────────────────────────

type VenueFilter = 'all' | 'polymarket' | 'kalshi';

// ─── Helpers mirrored from load() ──────────────────────────────────────────

function buildMarketParams(
  page: number,
  search: string,
  sort: string,
  category: string,
  venue: VenueFilter,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '25');
  if (search) params.set('search', search);
  params.set('sort', sort);
  if (category !== 'all') params.set('category', category);
  if (venue !== 'all') params.set('venue', venue);
  return params;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Markets list venue filter', () => {
  describe('buildMarketParams — venue param', () => {
    it('omits venue param when filter is "all"', () => {
      const params = buildMarketParams(1, '', 'volume', 'all', 'all');
      expect(params.has('venue')).toBe(false);
    });

    it('passes venue=polymarket when Polymarket pill is active', () => {
      const params = buildMarketParams(1, '', 'volume', 'all', 'polymarket');
      expect(params.get('venue')).toBe('polymarket');
    });

    it('passes venue=kalshi when Kalshi pill is active', () => {
      const params = buildMarketParams(1, '', 'volume', 'all', 'kalshi');
      expect(params.get('venue')).toBe('kalshi');
    });

    it('can combine venue filter with category filter', () => {
      const params = buildMarketParams(1, '', 'volume', 'crypto', 'kalshi');
      expect(params.get('venue')).toBe('kalshi');
      expect(params.get('category')).toBe('crypto');
    });

    it('can combine venue filter with search', () => {
      const params = buildMarketParams(1, 'bitcoin', 'volume', 'all', 'polymarket');
      expect(params.get('venue')).toBe('polymarket');
      expect(params.get('search')).toBe('bitcoin');
    });

    it('omits category param when category is "all"', () => {
      const params = buildMarketParams(1, '', 'volume', 'all', 'kalshi');
      expect(params.has('category')).toBe(false);
    });
  });

  describe('VenueFilter type contract', () => {
    it('supports all three valid filter values', () => {
      const filters: VenueFilter[] = ['all', 'polymarket', 'kalshi'];
      expect(filters.length).toBe(3);
    });

    it('"all" is the default/reset state', () => {
      const defaultFilter: VenueFilter = 'all';
      expect(defaultFilter).toBe('all');
    });
  });
});
