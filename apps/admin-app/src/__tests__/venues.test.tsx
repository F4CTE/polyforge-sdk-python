import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { VenueHealth } from '@/lib/api';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockVenueHealth = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    venueHealth: (...args: unknown[]) => mockVenueHealth(...args),
  },
}));

vi.mock('@/lib/utils', () => ({
  formatDateTime: (v: string) => v,
}));

vi.mock('react-router', () => ({
  NavLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('@polyforge/ui', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const polymarketVenue: VenueHealth = {
  id: 'polymarket',
  displayName: 'Polymarket',
  wsStatus: 'connected',
  lastEventAt: '2026-04-24T10:00:00Z',
  latencyMs: 42,
  config: {
    restBaseUrl: 'https://clob.polymarket.com',
    authType: 'private-key',
    enabled: true,
    capabilities: {
      webSocket: true,
      candlestick: true,
      noSideTrading: true,
    },
  },
};

const kalshiVenue: VenueHealth = {
  id: 'kalshi',
  displayName: 'Kalshi',
  wsStatus: 'disconnected',
  lastEventAt: null,
  latencyMs: null,
  config: {
    restBaseUrl: 'https://trading-api.kalshi.com',
    authType: 'api-key',
    enabled: true,
    capabilities: {
      rfq: true,
      batchOrders: true,
      webSocket: false,
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renderVenues() {
  const { Component } = await import('@/pages/venues/venues');
  return render(<Component />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Venues page', () => {
  beforeEach(() => {
    mockVenueHealth.mockResolvedValue([polymarketVenue, kalshiVenue]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading', async () => {
    await renderVenues();
    expect(screen.getByRole('heading', { name: /venues/i })).toBeTruthy();
  });

  it('shows loading skeletons initially', async () => {
    // Don't await resolution — capture initial state
    mockVenueHealth.mockReturnValue(new Promise(() => {}));
    const { container } = await renderVenues();
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders a card per venue after load', async () => {
    await renderVenues();
    await waitFor(() => {
      expect(screen.getByText('Polymarket')).toBeTruthy();
      expect(screen.getByText('Kalshi')).toBeTruthy();
    });
  });

  it('shows connected status for polymarket', async () => {
    await renderVenues();
    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy());
  });

  it('shows disconnected status for kalshi', async () => {
    await renderVenues();
    await waitFor(() => expect(screen.getByText('Disconnected')).toBeTruthy());
  });

  it('displays latency when available', async () => {
    await renderVenues();
    await waitFor(() => expect(screen.getByText('42ms')).toBeTruthy());
  });

  it('shows capability badges', async () => {
    await renderVenues();
    await waitFor(() => {
      expect(screen.getByText('WebSocket')).toBeTruthy();
      expect(screen.getByText('RFQ')).toBeTruthy();
    });
  });

  it('shows "all venues connected" banner when all connected', async () => {
    mockVenueHealth.mockResolvedValue([polymarketVenue]);
    await renderVenues();
    await waitFor(() => expect(screen.getByText(/all venues connected/i)).toBeTruthy());
  });

  it('shows connectivity issue banner when a venue is disconnected', async () => {
    await renderVenues();
    await waitFor(() => expect(screen.getByText(/connectivity issues/i)).toBeTruthy());
  });

  it('shows error state on fetch failure', async () => {
    mockVenueHealth.mockRejectedValue(new Error('Network error'));
    await renderVenues();
    await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());
  });

  it('polls every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await renderVenues();
      await waitFor(() => expect(mockVenueHealth).toHaveBeenCalledTimes(1));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
        // flush microtasks
        await Promise.resolve();
      });

      await waitFor(() => expect(mockVenueHealth).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows refresh button that triggers re-fetch', async () => {
    await renderVenues();
    await waitFor(() => screen.getByText('Polymarket'));

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    expect(refreshBtn).toBeTruthy();
    refreshBtn.click();

    await waitFor(() => expect(mockVenueHealth).toHaveBeenCalledTimes(2));
  });

  it('shows empty state when no venues returned', async () => {
    mockVenueHealth.mockResolvedValue([]);
    await renderVenues();
    await waitFor(() => expect(screen.getByText(/no venues configured/i)).toBeTruthy());
  });

  it('shows disabled warning for disabled venue', async () => {
    const disabledVenue: VenueHealth = {
      ...polymarketVenue,
      config: { ...polymarketVenue.config, enabled: false },
    };
    mockVenueHealth.mockResolvedValue([disabledVenue]);
    await renderVenues();
    await waitFor(() => expect(screen.getByText(/venue disabled in config/i)).toBeTruthy());
  });
});
