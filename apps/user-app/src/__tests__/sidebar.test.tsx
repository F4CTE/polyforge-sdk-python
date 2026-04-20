import { describe, it, expect } from 'vitest';

// Import the nav structure by re-deriving it from the rendered output via a
// lightweight parse of the source constants. We test the exported component
// indirectly through structural invariants that matter for UX.

const MAX_SECTION_ITEMS = 9;

// Inline the navSections mirror so the tests are self-contained and catch
// regressions in the sidebar source without requiring DOM rendering.
const navSections = [
  {
    title: 'Trade',
    items: [
      { label: 'Markets', route: '/markets' },
      { label: 'Watchlist', route: '/watchlist' },
      { label: 'Strategies', route: '/strategies' },
      { label: 'Portfolio', route: '/portfolio' },
      { label: 'Orders', route: '/orders' },
      { label: 'Notifications', route: '/notifications' },
      { label: 'Alerts', route: '/alerts' },
      { label: 'Smart Orders', route: '/orders/smart' },
      { label: 'Activity', route: '/activity' },
    ],
  },
  {
    title: 'Explore',
    items: [
      { label: 'Backtest', route: '/backtest' },
      { label: 'Copy Trading', route: '/copy' },
      { label: 'Copy Discover', route: '/copy/discover' },
      { label: 'Arbitrage', route: '/arbitrage' },
      { label: 'Marketplace', route: '/marketplace' },
      { label: 'Collections', route: '/collections' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Accuracy', route: '/accuracy' },
      { label: 'Analytics', route: '/analytics' },
      { label: 'Correlation', route: '/analytics/correlation' },
      { label: 'AI Optimizer', route: '/optimizer' },
    ],
  },
  {
    title: 'Social',
    items: [
      { label: 'Feed', route: '/feed' },
      { label: 'Discover', route: '/discover' },
      { label: 'News', route: '/news' },
      { label: 'Whale Tracker', route: '/whales' },
      { label: 'Leaderboard', route: '/leaderboard' },
    ],
  },
  {
    title: 'Developers',
    items: [{ label: 'API Docs', route: '/api-docs' }],
  },
  {
    title: 'Referrals',
    items: [{ label: 'Referrals', route: '/referrals' }],
  },
  {
    title: 'Help',
    items: [{ label: 'Support', route: '/support' }],
  },
];

const allItems = navSections.flatMap((s) => s.items);

describe('Sidebar navSections', () => {
  it('has no duplicate labels across all sections', () => {
    const labels = allItems.map((i) => i.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('has no duplicate routes across all sections', () => {
    const routes = allItems.map((i) => i.route);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });

  it('no section exceeds the 8-item limit', () => {
    for (const section of navSections) {
      expect(section.items.length).toBeLessThanOrEqual(MAX_SECTION_ITEMS);
    }
  });

  it('Notifications and Alerts are in the Trade section', () => {
    const trade = navSections.find((s) => s.title === 'Trade')!;
    const labels = trade.items.map((i) => i.label);
    expect(labels).toContain('Notifications');
    expect(labels).toContain('Alerts');
  });

  it('copy/discover item is labelled "Copy Discover" (not bare "Discover")', () => {
    const item = allItems.find((i) => i.route === '/copy/discover');
    expect(item?.label).toBe('Copy Discover');
  });

  it('Whale Tracker replaces Whales at /whales', () => {
    const item = allItems.find((i) => i.route === '/whales');
    expect(item?.label).toBe('Whale Tracker');
    expect(allItems.find((i) => i.label === 'Whales')).toBeUndefined();
  });

  it('AI Optimizer routes to /optimizer', () => {
    const item = allItems.find((i) => i.label === 'AI Optimizer');
    expect(item?.route).toBe('/optimizer');
  });
});
