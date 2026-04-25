import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ComboMarketCard } from '../components/builder/combo/combo-market-card';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCollections = [
  {
    collection_ticker: 'COLL-NBA-WEST',
    title: 'NBA Western Conference Winner',
    category: 'Sports',
    status: 'active',
    markets_count: 15,
    series_ticker: 'KXNBA-25',
  },
  {
    collection_ticker: 'COLL-NBA-EAST',
    title: 'NBA Eastern Conference Winner',
    category: 'Sports',
    status: 'settled',
    markets_count: 8,
  },
];

const mockLookupResult = {
  event_ticker: 'KXNBA-25-WEST-BOS',
  market_ticker: 'KXNBA-25-WEST-BOS-YES-EAST-MIA-NO',
};

function makeFetch(
  collectionsResponse = { collections: mockCollections },
  lookupResponse = mockLookupResult,
  collectionsOk = true,
  lookupOk = true,
) {
  return vi.fn((url: string, opts?: RequestInit) => {
    if ((url as string).includes('/combo/collections') && !opts?.method) {
      return Promise.resolve({
        ok: collectionsOk,
        status: collectionsOk ? 200 : 500,
        json: () => Promise.resolve(collectionsResponse),
      });
    }
    if ((url as string).includes('/combo/lookup')) {
      return Promise.resolve({
        ok: lookupOk,
        status: lookupOk ? 200 : 404,
        json: () => Promise.resolve(lookupResponse),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ComboMarketCard', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', makeFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Browse phase ─────────────────────────────────────────────────────────

  it('renders in browse phase when value is empty', () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Combo Collections')).toBeTruthy();
  });

  it('shows loading state while fetching collections', () => {
    // Never resolves — stays loading
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/Loading collections/i)).toBeTruthy();
  });

  it('displays collections after successful fetch', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByText('NBA Western Conference Winner')).toBeTruthy();
      expect(screen.getByText('NBA Eastern Conference Winner')).toBeTruthy();
    });
  });

  it('shows error when collections fetch fails', async () => {
    vi.stubGlobal('fetch', makeFetch(undefined, undefined, false));
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('shows empty state when no collections returned', async () => {
    vi.stubGlobal('fetch', makeFetch({ collections: [] }));
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByText(/No combo collections available/i)).toBeTruthy();
    });
  });

  it('displays status badges correctly', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Status: active')).toBeTruthy();
      expect(screen.getByLabelText('Status: settled')).toBeTruthy();
    });
  });

  // ── Detail phase ─────────────────────────────────────────────────────────

  it('transitions to detail phase on collection select', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));

    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));
    expect(screen.getByText('NBA Western Conference Winner', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText(/Leg selections/i)).toBeTruthy();
  });

  it('shows leg adder in detail phase', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    expect(screen.getByLabelText('Leg market ticker')).toBeTruthy();
    expect(screen.getByLabelText('Leg outcome')).toBeTruthy();
  });

  it('can add a leg and see it in the leg list', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    // Add a leg
    fireEvent.change(screen.getByLabelText('Leg market ticker'), {
      target: { value: 'KXNBA-25-BOS' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Expand leg list
    fireEvent.click(screen.getByText(/Leg selections \(1\)/i));
    await waitFor(() => {
      expect(screen.getByText('KXNBA-25-BOS')).toBeTruthy();
    });
  });

  it('prevents adding a duplicate leg ticker', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    const tickerInput = screen.getByLabelText('Leg market ticker');
    fireEvent.change(tickerInput, { target: { value: 'KXNBA-25-BOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Try to add the same ticker again
    fireEvent.change(tickerInput, { target: { value: 'KXNBA-25-BOS' } });
    expect(screen.getByText(/already added/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('disables Resolve Ticker button when no legs added', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    expect(screen.getByRole('button', { name: /Resolve Ticker/i })).toBeDisabled();
  });

  it('can remove a leg from the list', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    fireEvent.change(screen.getByLabelText('Leg market ticker'), { target: { value: 'KXNBA-25-BOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getByText(/Leg selections \(1\)/i));
    await waitFor(() => screen.getByText('KXNBA-25-BOS'));

    fireEvent.click(screen.getByLabelText('Remove leg KXNBA-25-BOS'));
    await waitFor(() => {
      expect(screen.queryByText('KXNBA-25-BOS')).toBeNull();
    });
  });

  // ── Lookup / confirm phase ────────────────────────────────────────────────

  it('calls lookup and transitions to confirm phase on success', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    // Add a leg
    fireEvent.change(screen.getByLabelText('Leg market ticker'), { target: { value: 'KXNBA-25-BOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Resolve
    fireEvent.click(screen.getByRole('button', { name: /Resolve Ticker/i }));

    await waitFor(() => {
      expect(screen.getByText('Resolved ticker')).toBeTruthy();
      expect(screen.getByText(mockLookupResult.market_ticker)).toBeTruthy();
    });
  });

  it('shows lookup error when 404 is returned', async () => {
    vi.stubGlobal('fetch', makeFetch(undefined, undefined, true, false));
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    fireEvent.change(screen.getByLabelText('Leg market ticker'), { target: { value: 'KXNBA-25-BOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Resolve Ticker/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('calls onConfirm with resolved ticker on confirm', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    fireEvent.change(screen.getByLabelText('Leg market ticker'), { target: { value: 'KXNBA-25-BOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Resolve Ticker/i }));

    await waitFor(() => screen.getByText('Use this market'));
    fireEvent.click(screen.getByRole('button', { name: 'Use this market' }));

    expect(onConfirm).toHaveBeenCalledWith(mockLookupResult.market_ticker);
  });

  // ── Confirm phase (pre-populated value) ──────────────────────────────────

  it('renders directly in confirm phase when a value is provided', () => {
    render(
      <ComboMarketCard
        value="KXNBA-25-WEST-BOS-YES"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Resolved ticker')).toBeTruthy();
    expect(screen.getByText('KXNBA-25-WEST-BOS-YES')).toBeTruthy();
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  it('calls onCancel when cancel button is pressed', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('Combo Collections'));
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('navigates back from detail to browse', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    fireEvent.click(screen.getByLabelText('Select NBA Western Conference Winner'));

    // Back button present in detail phase
    fireEvent.click(screen.getByLabelText('Go back'));
    expect(screen.getByText('Combo Collections')).toBeTruthy();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it('has aria-label on the component region', () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('region', { name: 'Combo market selector' })).toBeTruthy();
  });

  it('collection buttons have aria-pressed', async () => {
    render(<ComboMarketCard value="" onConfirm={onConfirm} onCancel={onCancel} />);
    await waitFor(() => screen.getByText('NBA Western Conference Winner'));
    const btn = screen.getByLabelText('Select NBA Western Conference Winner');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});
