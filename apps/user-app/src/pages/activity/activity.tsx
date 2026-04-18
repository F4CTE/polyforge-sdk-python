import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button, CardSkeleton } from '@polyforge/ui';
import {
  Activity, ArrowDownUp, Merge, Scissors, Gift, Coins,
  Users, RefreshCw, Filter, Loader2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type ActivityType =
  | 'TRADE'
  | 'SPLIT'
  | 'MERGE'
  | 'REDEEM'
  | 'REWARD'
  | 'CONVERSION'
  | 'MAKER_REBATE'
  | 'REFERRAL_REWARD';

interface ActivityItem {
  id: string;
  type: ActivityType;
  marketQuestion?: string;
  amount?: string;
  side?: string;
  outcome?: string;
  tokenId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface ActivityResponse {
  activities: ActivityItem[];
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const ACTIVITY_TYPES: { value: ActivityType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TRADE', label: 'Trades' },
  { value: 'SPLIT', label: 'Splits' },
  { value: 'MERGE', label: 'Merges' },
  { value: 'REDEEM', label: 'Redeems' },
  { value: 'REWARD', label: 'Rewards' },
  { value: 'MAKER_REBATE', label: 'Rebates' },
  { value: 'REFERRAL_REWARD', label: 'Referrals' },
];

const TYPE_CONFIG: Record<ActivityType, { icon: typeof Activity; color: string; label: string }> = {
  TRADE: { icon: ArrowDownUp, color: 'text-accent-text', label: 'Trade' },
  SPLIT: { icon: Scissors, color: 'text-info', label: 'Split' },
  MERGE: { icon: Merge, color: 'text-variable-text', label: 'Merge' },
  REDEEM: { icon: Gift, color: 'text-gain', label: 'Redeem' },
  REWARD: { icon: Gift, color: 'text-gold-500', label: 'Reward' },
  CONVERSION: { icon: ArrowDownUp, color: 'text-secondary', label: 'Conversion' },
  MAKER_REBATE: { icon: Coins, color: 'text-gain', label: 'Maker Rebate' },
  REFERRAL_REWARD: { icon: Users, color: 'text-accent-text', label: 'Referral' },
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

function formatAmount(val?: string): string {
  if (!val) return '';
  const n = parseFloat(val);
  return `$${Math.abs(n).toFixed(2)}`;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function Component() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<ActivityType | 'ALL'>('ALL');
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);

  const loadActivities = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      pageRef.current = 0;
    }

    try {
      const params = new URLSearchParams();
      if (filter !== 'ALL') params.set('type', filter);

      const res = await fetch(`/api/v1/portfolio/polymarket/activity?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to load');

      const data: ActivityResponse = await res.json();
      const items = data.activities ?? [];

      if (append) {
        setActivities(prev => [...prev, ...items]);
      } else {
        setActivities(items);
      }

      setHasMore(items.length >= 20);
      pageRef.current += 1;
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          loadActivities(true);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadActivities]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-accent-text" />
          <h1 className="text-heading-lg font-semibold text-primary">Activity</h1>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => loadActivities()} className="flex items-center gap-1.5">
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-3.5 text-tertiary" />
        {ACTIVITY_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
              filter === t.value
                ? 'bg-accent-subtle text-accent-text border border-accent-border'
                : 'bg-surface text-secondary border border-subtle hover:text-primary hover:border-default'
            }`}
            aria-pressed={filter === t.value}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <CardSkeleton key={i} className="h-16" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-elevated border border-default rounded-xl p-8 text-center">
          <Activity className="mx-auto mb-3 text-tertiary opacity-60" size={32} />
          <p className="text-body-md font-medium text-primary mb-1">No activity found</p>
          <p className="text-label text-tertiary">
            {filter !== 'ALL'
              ? `No ${filter.toLowerCase().replace('_', ' ')} activity yet.`
              : 'Connect your Polymarket account and start trading to see activity here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map(item => {
            const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.TRADE;
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className="bg-elevated border border-default rounded-lg p-4 flex items-center gap-4 hover:bg-subtle transition-colors"
              >
                {/* Icon */}
                <div className={`flex-shrink-0 size-9 rounded-lg bg-surface flex items-center justify-center ${config.color}`}>
                  <Icon className="size-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-caption font-medium uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                    {item.side && (
                      <span className={`text-caption font-mono ${item.side === 'BUY' ? 'text-gain' : 'text-loss'}`}>
                        {item.side}
                      </span>
                    )}
                    {item.outcome && (
                      <span className="text-caption text-secondary">{item.outcome}</span>
                    )}
                  </div>
                  {item.marketQuestion && (
                    <p className="text-body-sm text-primary truncate mt-0.5" title={item.marketQuestion}>
                      {item.marketQuestion}
                    </p>
                  )}
                </div>

                {/* Amount & Time */}
                <div className="flex-shrink-0 text-right">
                  {item.amount && (
                    <span className="block font-mono text-body-sm text-primary">
                      {formatAmount(item.amount)}
                    </span>
                  )}
                  <span className="text-caption text-tertiary">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && <Loader2 className="size-5 text-tertiary animate-spin" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
