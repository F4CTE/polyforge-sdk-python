import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, CardSkeleton } from '@polyforge/ui';
import {
  Trophy, Gift, TrendingUp, RefreshCw, ChevronDown, ChevronUp,
  Coins, Award,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface RewardEntry {
  marketId: string;
  conditionId: string;
  marketQuestion: string;
  dailyReward: string;
  totalReward: string;
  rewardPercentage: number;
}

interface RewardsTotal {
  totalEarned: string;
  dailyEarned: string;
  pendingRewards: string;
}

interface RewardsPercentage {
  conditionId: string;
  marketQuestion: string;
  rewardPercentage: number;
  tier: string;
}

interface RebateEntry {
  id: string;
  amount: string;
  feeOriginal: string;
  marketQuestion: string;
  createdAt: string;
}

interface RebateSummary {
  totalRebates: string;
  rebateCount: number;
  entries: RebateEntry[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatUsd(val: string): string {
  const n = parseFloat(val);
  return `$${Math.abs(n).toFixed(2)}`;
}

function pnlColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'text-gain';
  if (n < 0) return 'text-loss';
  return 'text-tertiary';
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function RewardsDashboard() {
  const [totals, setTotals] = useState<RewardsTotal | null>(null);
  const [perMarket, setPerMarket] = useState<RewardEntry[]>([]);
  const [percentages, setPercentages] = useState<RewardsPercentage[]>([]);
  const [rebates, setRebates] = useState<RebateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showRebates, setShowRebates] = useState(false);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      const [totalsRes, marketsRes, pctRes, rebatesRes] = await Promise.all([
        fetch('/api/v1/rewards/user/total', { credentials: 'include' }),
        fetch('/api/v1/rewards/user/markets', { credentials: 'include' }),
        fetch('/api/v1/rewards/user/percentages', { credentials: 'include' }),
        fetch('/api/v1/rewards/rebates', { credentials: 'include' }),
      ]);

      if (totalsRes.ok) setTotals(await totalsRes.json());
      if (marketsRes.ok) setPerMarket(await marketsRes.json());
      if (pctRes.ok) setPercentages(await pctRes.json());
      if (rebatesRes.ok) setRebates(await rebatesRes.json());
    } catch {
      toast.error('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton className="h-32" />
        <CardSkeleton className="h-24" />
      </div>
    );
  }

  const hasRewards = totals && parseFloat(totals.totalEarned) > 0;
  const hasRebates = rebates && parseFloat(rebates.totalRebates) > 0;

  if (!hasRewards && !hasRebates) {
    return (
      <div className="bg-elevated border border-default rounded-xl p-6 text-center">
        <Trophy className="mx-auto mb-3 text-tertiary opacity-60" size={32} />
        <p className="text-body-md font-medium text-primary mb-1">No rewards yet</p>
        <p className="text-label text-tertiary">
          Trade on markets with active rewards programs to start earning.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {totals && (
          <>
            <div className="bg-elevated border border-default rounded-xl p-4 border-l-4 border-l-gain">
              <span className="text-label text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="size-3" />
                Total Earned
              </span>
              <span className="block mt-1 text-xl font-mono font-semibold text-gain">
                {formatUsd(totals.totalEarned)}
              </span>
            </div>
            <div className="bg-elevated border border-default rounded-xl p-4 border-l-4 border-l-accent">
              <span className="text-label text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="size-3" />
                Daily Earned
              </span>
              <span className="block mt-1 text-xl font-mono font-semibold text-accent-text">
                {formatUsd(totals.dailyEarned)}
              </span>
            </div>
            <div className="bg-elevated border border-default rounded-xl p-4 border-l-4 border-l-info">
              <span className="text-label text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Gift className="size-3" />
                Pending
              </span>
              <span className="block mt-1 text-xl font-mono font-semibold text-info">
                {formatUsd(totals.pendingRewards)}
              </span>
            </div>
          </>
        )}
        {rebates && (
          <div className="bg-elevated border border-default rounded-xl p-4 border-l-4 border-l-variable">
            <span className="text-label text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="size-3" />
              Maker Rebates
            </span>
            <span className="block mt-1 text-xl font-mono font-semibold text-variable-text">
              {formatUsd(rebates.totalRebates)}
            </span>
            <span className="text-caption text-tertiary">{rebates.rebateCount} rebates</span>
          </div>
        )}
      </div>

      {/* ─── Per-Market Rewards ─────────────────────────────────────── */}
      {perMarket.length > 0 && (
        <div className="bg-elevated border border-default rounded-xl p-4">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Award className="size-4 text-accent-text" />
              <span className="text-body-md font-semibold text-primary">
                Rewards by Market ({perMarket.length})
              </span>
            </span>
            {expanded ? <ChevronUp className="size-4 text-tertiary" /> : <ChevronDown className="size-4 text-tertiary" />}
          </button>

          {expanded && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-body-sm" aria-label="Rewards by market">
                <thead>
                  <tr className="text-left text-secondary text-caption uppercase tracking-wider border-b border-subtle">
                    <th className="px-3 py-2">Market</th>
                    <th className="px-3 py-2 text-right">Daily</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {perMarket.map(r => (
                    <tr key={r.conditionId} className="border-b border-subtle hover:bg-subtle transition-colors">
                      <td className="px-3 py-2.5 text-primary max-w-[240px] truncate" title={r.marketQuestion}>
                        {r.marketQuestion}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gain">
                        {formatUsd(r.dailyReward)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-primary">
                        {formatUsd(r.totalReward)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-accent-text">
                        {(r.rewardPercentage * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Rebates Detail ────────────────────────────────────────── */}
      {hasRebates && rebates.entries.length > 0 && (
        <div className="bg-elevated border border-default rounded-xl p-4">
          <button
            type="button"
            onClick={() => setShowRebates(!showRebates)}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Coins className="size-4 text-variable-text" />
              <span className="text-body-md font-semibold text-primary">
                Maker Rebates History ({rebates.entries.length})
              </span>
            </span>
            {showRebates ? <ChevronUp className="size-4 text-tertiary" /> : <ChevronDown className="size-4 text-tertiary" />}
          </button>

          {showRebates && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-body-sm" aria-label="Maker rebates history">
                <thead>
                  <tr className="text-left text-secondary text-caption uppercase tracking-wider border-b border-subtle">
                    <th className="px-3 py-2">Market</th>
                    <th className="px-3 py-2 text-right">Original Fee</th>
                    <th className="px-3 py-2 text-right">Rebate</th>
                    <th className="px-3 py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rebates.entries.slice(0, 20).map(entry => (
                    <tr key={entry.id} className="border-b border-subtle hover:bg-subtle transition-colors">
                      <td className="px-3 py-2.5 text-primary max-w-[240px] truncate" title={entry.marketQuestion}>
                        {entry.marketQuestion}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-tertiary">
                        {formatUsd(entry.feeOriginal)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gain">
                        +{formatUsd(entry.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Refresh ───────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={loadRewards} className="flex items-center gap-1.5">
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
