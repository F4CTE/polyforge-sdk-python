import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketRewardsCard } from '../components/rewards/market-rewards-card';

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock('@polyforge/ui', () => ({
  CardSkeleton: () => <div data-testid="skeleton" />,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} type="button">
      {children}
    </button>
  ),
}));

describe('MarketRewardsCard sponsor URL safety', () => {
  let originalOpen: typeof window.open;
  let openMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastErrorMock.mockReset();
    openMock = vi.fn();
    originalOpen = window.open;
    window.open = openMock as unknown as typeof window.open;

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.unstubAllGlobals();
  });

  function mockNoRewards() {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/rewards/market/')) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
  }

  it('opens a safe https sponsor URL via window.open', async () => {
    mockNoRewards();
    fetchMock.mockImplementationOnce((url: string) => {
      if (url.includes('/rewards/market/')) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    render(<MarketRewardsCard marketId="m1" />);

    // Expand the collapsed CTA panel
    await waitFor(() => screen.getByText(/Liquidity Rewards/i));
    fireEvent.click(screen.getByText(/Liquidity Rewards/i));
    const sponsorBtn = await screen.findByText(/Sponsor this Market/i);

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ url: 'https://sponsor.example.com/x' }), { status: 200 })),
    );

    fireEvent.click(sponsorBtn);
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(openMock).toHaveBeenCalledWith('https://sponsor.example.com/x', '_blank', 'noopener,noreferrer');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('rejects javascript: sponsor URL and does not call window.open', async () => {
    mockNoRewards();

    render(<MarketRewardsCard marketId="m1" />);

    await waitFor(() => screen.getByText(/Liquidity Rewards/i));
    fireEvent.click(screen.getByText(/Liquidity Rewards/i));
    const sponsorBtn = await screen.findByText(/Sponsor this Market/i);

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ url: 'javascript:alert(1)' }), { status: 200 })),
    );

    fireEvent.click(sponsorBtn);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(openMock).not.toHaveBeenCalled();
  });

  it('rejects data: sponsor URL', async () => {
    mockNoRewards();

    render(<MarketRewardsCard marketId="m1" />);

    await waitFor(() => screen.getByText(/Liquidity Rewards/i));
    fireEvent.click(screen.getByText(/Liquidity Rewards/i));
    const sponsorBtn = await screen.findByText(/Sponsor this Market/i);

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ url: 'data:text/html,<script>alert(1)</script>' }), { status: 200 })),
    );

    fireEvent.click(sponsorBtn);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(openMock).not.toHaveBeenCalled();
  });
});
