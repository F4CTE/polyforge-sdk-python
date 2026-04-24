import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Helpers mirrored from venue-store.ts ──────────────────────────────────

type Venue = 'polymarket' | 'kalshi';
type ActiveFilter = Venue | 'all';

interface VenuePreferences {
  defaultVenue: Venue;
  enabledVenues: Venue[];
  singlePlatformMode: boolean;
}

const DEFAULTS: VenuePreferences = {
  defaultVenue: 'polymarket',
  enabledVenues: ['polymarket', 'kalshi'],
  singlePlatformMode: false,
};

const STORAGE_KEY = 'polyforge:venue-prefs';

function loadLocal(storage: Record<string, string>): VenuePreferences {
  try {
    const raw = storage[STORAGE_KEY];
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function applyPatch(
  current: VenuePreferences,
  patch: Partial<VenuePreferences>,
): VenuePreferences | null {
  const next: VenuePreferences = {
    defaultVenue: patch.defaultVenue ?? current.defaultVenue,
    enabledVenues: patch.enabledVenues ?? current.enabledVenues,
    singlePlatformMode: patch.singlePlatformMode ?? current.singlePlatformMode,
  };
  if (next.enabledVenues.length === 0) return null;
  if (!next.enabledVenues.includes(next.defaultVenue)) {
    next.defaultVenue = next.enabledVenues[0];
  }
  return next;
}

function computeActiveFilter(
  prefs: VenuePreferences,
  currentFilter: ActiveFilter,
): ActiveFilter {
  if (prefs.singlePlatformMode) return prefs.defaultVenue;
  return currentFilter;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('venue-store — loadLocal', () => {
  it('returns DEFAULTS when storage is empty', () => {
    const result = loadLocal({});
    expect(result).toEqual(DEFAULTS);
  });

  it('merges stored values over defaults', () => {
    const stored = { defaultVenue: 'kalshi', singlePlatformMode: true };
    const result = loadLocal({ [STORAGE_KEY]: JSON.stringify(stored) });
    expect(result.defaultVenue).toBe('kalshi');
    expect(result.singlePlatformMode).toBe(true);
    expect(result.enabledVenues).toEqual(['polymarket', 'kalshi']);
  });

  it('returns DEFAULTS when JSON is malformed', () => {
    const result = loadLocal({ [STORAGE_KEY]: '{bad json' });
    expect(result).toEqual(DEFAULTS);
  });
});

describe('venue-store — applyPatch', () => {
  it('applies defaultVenue patch', () => {
    const result = applyPatch(DEFAULTS, { defaultVenue: 'kalshi' });
    expect(result?.defaultVenue).toBe('kalshi');
  });

  it('falls back defaultVenue to first enabled venue when current default is removed', () => {
    const result = applyPatch(
      { ...DEFAULTS, defaultVenue: 'polymarket' },
      { enabledVenues: ['kalshi'] },
    );
    expect(result?.defaultVenue).toBe('kalshi');
  });

  it('returns null when enabledVenues is empty', () => {
    const result = applyPatch(DEFAULTS, { enabledVenues: [] });
    expect(result).toBeNull();
  });

  it('preserves existing values for unpatched fields', () => {
    const result = applyPatch(DEFAULTS, { singlePlatformMode: true });
    expect(result?.defaultVenue).toBe('polymarket');
    expect(result?.enabledVenues).toEqual(['polymarket', 'kalshi']);
  });
});

describe('venue-store — computeActiveFilter', () => {
  it('locks to defaultVenue in singlePlatformMode', () => {
    const prefs: VenuePreferences = { ...DEFAULTS, singlePlatformMode: true, defaultVenue: 'kalshi' };
    expect(computeActiveFilter(prefs, 'all')).toBe('kalshi');
  });

  it('preserves current filter in multi-platform mode', () => {
    expect(computeActiveFilter(DEFAULTS, 'polymarket')).toBe('polymarket');
    expect(computeActiveFilter(DEFAULTS, 'all')).toBe('all');
  });
});

describe('venue-store — VenuePreferences contract', () => {
  it('DEFAULTS uses polymarket as defaultVenue', () => {
    expect(DEFAULTS.defaultVenue).toBe('polymarket');
  });

  it('DEFAULTS enables both venues', () => {
    expect(DEFAULTS.enabledVenues).toContain('polymarket');
    expect(DEFAULTS.enabledVenues).toContain('kalshi');
  });

  it('DEFAULTS disables singlePlatformMode', () => {
    expect(DEFAULTS.singlePlatformMode).toBe(false);
  });
});
