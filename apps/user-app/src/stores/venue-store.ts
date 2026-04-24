import { create } from 'zustand';
import { authedFetch } from './auth-store';

type Venue = 'polymarket' | 'kalshi';
type ActiveFilter = Venue | 'all';

interface VenuePreferences {
  defaultVenue: Venue;
  enabledVenues: Venue[];
  singlePlatformMode: boolean;
}

interface VenueState extends VenuePreferences {
  activeFilter: ActiveFilter;
  loading: boolean;
  init: () => Promise<void>;
  setActiveFilter: (filter: ActiveFilter) => void;
  updatePreferences: (patch: Partial<VenuePreferences>) => Promise<void>;
  isVenueEnabled: (venue: Venue) => boolean;
}

const STORAGE_KEY = 'polyforge:venue-prefs';

const DEFAULTS: VenuePreferences = {
  defaultVenue: 'polymarket',
  enabledVenues: ['polymarket', 'kalshi'],
  singlePlatformMode: false,
};

function loadLocal(): VenuePreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveLocal(prefs: VenuePreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export const useVenueStore = create<VenueState>((set, get) => {
  const local = loadLocal();
  return {
    ...local,
    activeFilter: local.singlePlatformMode ? local.defaultVenue : 'all',
    loading: false,

    async init() {
      set({ loading: true });
      try {
        const res = await authedFetch('/api/v1/users/me/venue-preferences');
        if (res.ok) {
          const prefs: VenuePreferences = await res.json();
          saveLocal(prefs);
          set({
            ...prefs,
            activeFilter: prefs.singlePlatformMode ? prefs.defaultVenue : get().activeFilter,
            loading: false,
          });
          return;
        }
      } catch {
        // fall through to local defaults
      }
      set({ loading: false });
    },

    setActiveFilter(filter: ActiveFilter) {
      const { singlePlatformMode } = get();
      if (singlePlatformMode) return;
      set({ activeFilter: filter });
    },

    async updatePreferences(patch: Partial<VenuePreferences>) {
      const current = get();
      const next: VenuePreferences = {
        defaultVenue: patch.defaultVenue ?? current.defaultVenue,
        enabledVenues: patch.enabledVenues ?? current.enabledVenues,
        singlePlatformMode: patch.singlePlatformMode ?? current.singlePlatformMode,
      };
      if (next.enabledVenues.length === 0) return;
      if (!next.enabledVenues.includes(next.defaultVenue)) {
        next.defaultVenue = next.enabledVenues[0];
      }
      const activeFilter: ActiveFilter = next.singlePlatformMode
        ? next.defaultVenue
        : current.activeFilter === 'all' ? 'all' : current.activeFilter;
      set({ ...next, activeFilter });
      saveLocal(next);
      try {
        await authedFetch('/api/v1/users/me/venue-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
      } catch {
        // optimistic — already saved locally
      }
    },

    isVenueEnabled(venue: Venue) {
      return get().enabledVenues.includes(venue);
    },
  };
});
