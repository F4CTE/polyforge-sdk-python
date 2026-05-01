import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CardSkeleton, Button } from '@polyforge/ui';
import { Coins, ExternalLink, TrendingUp, Shield, ChevronDown } from 'lucide-react';
import { isSafeExternalUrl } from '@/lib/url';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketRewards {
  rate_per_day: string;
  total_rewards: string;
  remaining_reward_amount: string;
  max_spread: string;
  min_size: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatUsd(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0.00';
  if (Math.abs(n) >= 1_000) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

// Approximate APY from rate_per_day assuming average position ~$100
function computeApy(ratePerDay: string): string {
  const daily = parseFloat(ratePerDay);
  if (isNaN(daily) || daily <= 0) return '—';
  const annualized = daily * 365;
  const apy = (annualized / 100) * 100;
  return `${apy.toFixed(1)}%`;
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MarketRewardsCardProps {
  marketId: string;
}

export function MarketRewardsCard({ marketId }: MarketRewardsCardProps) {
  const [rewards, setRewards] = useState<MarketRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [sponsoring, setSponsoring] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/rewards/market/${marketId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        setRewards(await res.json());
      } else if (res.status === 404) {
        setRewards(null);
      }
    } catch {
      toast.error('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleSponsor = async () => {
    setSponsoring(true);
    try {
      const res = await fetch(`/api/v1/rewards/sponsor-url/${marketId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not get sponsor URL');
      const { url } = await res.json() as { url: string };
      if (!isSafeExternalUrl(url)) {
        toast.error('Sponsor link is invalid');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to get sponsor link');
    } finally {
      setSponsoring(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-elevated border border-default rounded-pf overflow-hidden p-4">
        <CardSkeleton className="h-20" />
      </div>
    );
  }

  // No rewards program for this market — render a collapsed placeholder CTA
  if (!rewards) {
    return (
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-body-md font-medium text-primary hover:bg-surface/50 transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:rounded-pf"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-tertiary" aria-hidden="true" />
            Liquidity Rewards
          </div>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`text-tertiary transition-transform duration-panel ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t border-subtle pt-3 space-y-3">
            <p className="text-label text-secondary">
              No active rewards program for this market. Sponsor one to attract liquidity providers.
            </p>
            <Button
              type="button"
              onClick={handleSponsor}
              disabled={sponsoring}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-pf bg-accent-subtle border border-accent/30 text-accent-text text-body-sm font-medium hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              {sponsoring ? 'Opening...' : 'Sponsor this Market'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const remaining = parseFloat(rewards.remaining_reward_amount);
  const total = parseFloat(rewards.total_rewards);
  const pctRemaining = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;

  return (
    <div className="bg-elevated border border-default rounded-pf overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-default">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-accent-text" aria-hidden="true" />
          <span className="text-body-md font-medium text-primary">Liquidity Rewards</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-gain/10 border border-gain/20 text-caption font-medium text-gain">
          Active
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-subtle">
        {/* Daily pool */}
        <div className="bg-elevated px-4 py-3">
          <div className="flex items-center gap-1 text-caption text-secondary uppercase tracking-wider mb-1">
            <TrendingUp className="size-3" aria-hidden="true" />
            Daily Pool
          </div>
          <span className="block font-mono font-semibold text-body-md text-gain">
            {formatUsd(rewards.rate_per_day)}
          </span>
          <span className="text-caption text-tertiary">~{computeApy(rewards.rate_per_day)} APY</span>
        </div>

        {/* Remaining */}
        <div className="bg-elevated px-4 py-3">
          <div className="text-caption text-secondary uppercase tracking-wider mb-1">Remaining</div>
          <span className="block font-mono font-semibold text-body-md text-primary">
            {formatUsd(rewards.remaining_reward_amount)}
          </span>
          <div className="mt-1 h-1 bg-subtle rounded-full overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${pctRemaining}%` }}
            />
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-elevated px-4 py-3 col-span-2">
          <div className="flex items-center gap-1 text-caption text-secondary uppercase tracking-wider mb-2">
            <Shield className="size-3" aria-hidden="true" />
            LP Requirements
          </div>
          <div className="flex gap-4 text-label">
            <span className="text-secondary">
              Max spread{' '}
              <span className="font-mono text-primary">
                {(parseFloat(rewards.max_spread) * 100).toFixed(1)}%
              </span>
            </span>
            <span className="text-secondary">
              Min size{' '}
              <span className="font-mono text-primary">
                {formatUsd(rewards.min_size)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-3 border-t border-subtle">
        <Button
          type="button"
          onClick={handleSponsor}
          disabled={sponsoring}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-pf bg-accent-subtle border border-accent/30 text-accent-text text-body-sm font-medium hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          {sponsoring ? 'Opening...' : 'Sponsor this Market'}
        </Button>
      </div>
    </div>
  );
}
