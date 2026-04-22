import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Button } from '@polyforge/ui';
import {
  Zap,
  Copy,
  ShoppingBag,
  Blocks,
  Moon,
  UserPlus,
  Crown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  Download,
  PieChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CohortStats {
  cohortId: string;
  userCount: number;
  pctOfTotal: number;
  avgTradesPerMonth: number;
  avgPnl: string;
  retentionRate: number;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
}

interface CohortUser {
  id: string;
  username: string;
  email: string;
  joinedAt: string;
  lastActiveAt: string;
  tradeCount: number;
  totalVolume: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COHORT_DEFINITIONS = [
  {
    id: 'power-traders',
    label: 'Power Traders',
    icon: Zap,
    borderColor: 'border-accent-text',
    iconColor: 'text-accent-text',
    description: '20+ trades/month, active in last 7d',
  },
  {
    id: 'copy-only',
    label: 'Copy-Only',
    icon: Copy,
    borderColor: 'border-warning',
    iconColor: 'text-warning',
    description: 'No own strategies, 1+ copy traders followed',
  },
  {
    id: 'marketplace-buyers',
    label: 'Marketplace Buyers',
    icon: ShoppingBag,
    borderColor: 'border-accent',
    iconColor: 'text-accent',
    description: 'Purchased 1+ strategies from marketplace',
  },
  {
    id: 'strategy-builders',
    label: 'Strategy Builders',
    icon: Blocks,
    borderColor: 'border-gain',
    iconColor: 'text-gain',
    description: 'Created 1+ strategies, ran 1+ backtests',
  },
  {
    id: 'dormant',
    label: 'Dormant',
    icon: Moon,
    borderColor: 'border-tertiary',
    iconColor: 'text-tertiary',
    description: 'No activity in 30+ days',
  },
  {
    id: 'new-users',
    label: 'New Users',
    icon: UserPlus,
    borderColor: 'border-info',
    iconColor: 'text-info',
    description: 'Registered in last 14 days',
  },
  {
    id: 'high-value',
    label: 'High Value',
    icon: Crown,
    borderColor: 'border-warning',
    iconColor: 'text-warning',
    description: 'Top 10% by total volume traded',
  },
  {
    id: 'at-risk',
    label: 'At Risk',
    icon: AlertTriangle,
    borderColor: 'border-loss',
    iconColor: 'text-loss',
    description: 'Active 30d ago, no activity in last 14d',
  },
] as const;

// ─── Skeleton Components ───────────────────────────────────────────────────────

function CohortCardSkeleton() {
  return (
    <div className="rounded-pf bg-elevated border border-default border-l-4 border-l-subtle p-4 space-y-3 animate-shimmer">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-sm bg-overlay" />
        <div className="h-4 w-28 rounded-sm bg-overlay" />
      </div>
      <div className="h-3 w-full rounded-sm bg-overlay" />
      <div className="h-8 w-20 rounded-sm bg-overlay" />
      <div className="h-2 w-full rounded-full bg-overlay" />
      <div className="flex gap-2">
        <div className="h-7 flex-1 rounded-pf bg-overlay" />
        <div className="h-7 flex-1 rounded-pf bg-overlay" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded-sm bg-overlay animate-shimmer" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Broadcast Dialog ─────────────────────────────────────────────────────────

interface BroadcastDialogProps {
  cohortId: string;
  cohortLabel: string;
  userCount: number;
  onClose: () => void;
}

function BroadcastDialog({ cohortId, cohortLabel, userCount, onClose }: BroadcastDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await adminApi.broadcastToSegment(cohortId, { messageId: 'segment-broadcast' });
      toast.success(`Broadcast sent to ${userCount.toLocaleString()} ${cohortLabel} users`);
      onClose();
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }, [cohortId, cohortLabel, userCount, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-pf bg-elevated border border-default p-6 space-y-4 animate-fade-in">
        <h2 id="broadcast-dialog-title" className="text-base font-semibold text-primary">
          Send Broadcast
        </h2>
        <p className="text-body-sm text-secondary">
          Send broadcast to{' '}
          <span className="font-semibold text-primary">{userCount.toLocaleString()}</span>{' '}
          <span className="text-accent-text">{cohortLabel}</span> users?
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-4 py-2 rounded-pf text-body-sm text-secondary hover:bg-overlay border border-default transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-pf text-body-sm font-medium bg-accent text-inverse hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Cohort Card ──────────────────────────────────────────────────────────────

interface CohortCardProps {
  definition: (typeof COHORT_DEFINITIONS)[number];
  stats: CohortStats;
  onViewUsers: (cohortId: string) => void;
  onBroadcast: (cohortId: string) => void;
}

function CohortCard({ definition, stats, onViewUsers, onBroadcast }: CohortCardProps) {
  const Icon = definition.icon;
  const TrendIcon =
    stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    stats.trend === 'up'
      ? 'text-gain'
      : stats.trend === 'down'
        ? 'text-loss'
        : 'text-tertiary';

  return (
    <article
      className={`rounded-pf bg-elevated border border-default border-l-4 ${definition.borderColor} p-4 flex flex-col gap-3 animate-fade-in`}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon size={18} className={`${definition.iconColor} shrink-0 mt-1`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-heading font-semibold text-primary">{definition.label}</h3>
          <p className="text-caption text-tertiary mt-1 leading-snug">{definition.description}</p>
        </div>
      </div>

      {/* User Count */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold font-mono tabular-nums text-primary">
          {stats.userCount.toLocaleString()}
        </span>
        <span className="text-caption text-tertiary">
          {stats.pctOfTotal.toFixed(1)}% of total
        </span>
        <span className={`ml-auto flex items-center gap-1 text-label font-medium ${trendColor}`}>
          <TrendIcon size={13} aria-hidden="true" />
          {stats.trendPct > 0 ? '+' : ''}{stats.trendPct.toFixed(1)}%
        </span>
      </div>

      {/* Retention Bar */}
      <div>
        <div className="flex justify-between text-label text-tertiary mb-1">
          <span>Retention</span>
          <span>{stats.retentionRate}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-overlay overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-text transition-all"
            style={{ width: `${stats.retentionRate}%` }}
            role="meter"
            aria-valuenow={stats.retentionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Retention rate ${stats.retentionRate}%`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onViewUsers(definition.id)}
          className="flex-1 px-3 py-2 rounded-pf text-label font-medium bg-accent/10 text-accent-text hover:bg-accent/20 border border-accent-text/20 transition-colors"
        >
          View Users
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onBroadcast(definition.id)}
          className="flex-1 px-3 py-2 rounded-pf text-label font-medium bg-overlay text-secondary hover:text-primary hover:bg-default border border-default transition-colors"
        >
          Send Broadcast
        </Button>
      </div>
    </article>
  );
}

// ─── Drill-Down Section ───────────────────────────────────────────────────────

interface DrillDownProps {
  cohortId: string;
  onBack: () => void;
}

function DrillDown({ cohortId, onBack }: DrillDownProps) {
  const [users, setUsers] = useState<CohortUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CohortStats | null>(null);

  const definition = COHORT_DEFINITIONS.find((d) => d.id === cohortId);
  const totalPages = Math.ceil(total / 20);

  const fetchUsers = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const [usersRes, statsRes] = await Promise.all([
          adminApi.segmentUsers(cohortId, { page: p, limit: 20 }),
          adminApi.segments().then((r) => r.data.find((s) => s.cohortId === cohortId) ?? null),
        ]);
        setUsers(usersRes.data);
        setTotal(usersRes.total);
        setStats(statsRes);
      } catch {
        toast.error('Failed to load segment users');
      } finally {
        setLoading(false);
      }
    },
    [cohortId],
  );

  useState(() => {
    fetchUsers(1);
  });

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchUsers(p);
  };

  const handleExportCsv = () => {
    const header = 'username,email,joined,last_active,trades,volume';
    const rows = users.map(
      (u) =>
        `${u.username},${u.email},${u.joinedAt},${u.lastActiveAt},${u.tradeCount},${u.totalVolume}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment-${cohortId}-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <section className="space-y-5 animate-fade-in" aria-label={`${definition?.label ?? cohortId} drill-down`}>
      {/* Back */}
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-body-sm text-secondary hover:text-primary transition-colors rounded-sm"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        All Cohorts
      </Button>

      {/* Cohort header */}
      {definition && (
        <div className="flex items-center gap-3">
          <definition.icon
            size={22}
            className={definition.iconColor}
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold text-primary">{definition.label}</h2>
        </div>
      )}

      {/* Stats row */}
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Users', value: stats.userCount.toLocaleString() },
            { label: 'Avg Trades / mo', value: stats.avgTradesPerMonth.toFixed(1) },
            { label: 'Avg P&L', value: stats.avgPnl },
            { label: 'Retention', value: `${stats.retentionRate}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-pf bg-elevated border border-default px-4 py-3">
              <div className="text-label text-tertiary uppercase tracking-wider">{item.label}</div>
              <div className="text-lg font-semibold font-mono tabular-nums text-primary mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-pf bg-elevated border border-default px-4 py-3 animate-shimmer">
              <div className="h-3 w-16 rounded-sm bg-overlay mb-2" />
              <div className="h-6 w-20 rounded-sm bg-overlay" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-pf bg-elevated border border-default overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-default">
          <span className="text-body-sm font-medium text-primary">
            {total > 0 ? `${total.toLocaleString()} users` : 'Users'}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={handleExportCsv}
            disabled={users.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-pf text-label font-medium text-secondary hover:text-primary bg-overlay hover:bg-default border border-default transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} aria-hidden="true" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-body-sm" aria-label="User segmentation data">
            <thead>
              <tr className="border-b border-default bg-surface">
                <th className="px-4 py-3 text-left text-label font-semibold text-tertiary uppercase tracking-wider">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-label font-semibold text-tertiary uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-label font-semibold text-tertiary uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-label font-semibold text-tertiary uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-4 py-3 text-right text-label font-semibold text-tertiary uppercase tracking-wider">
                  Trades
                </th>
                <th className="px-4 py-3 text-right text-label font-semibold text-tertiary uppercase tracking-wider">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-body-sm text-tertiary">
                    No users match this segment yet
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/users/${user.id}`}
                        className="font-medium text-accent-text hover:text-accent transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm"
                      >
                        {user.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-secondary">{user.email}</td>
                    <td className="px-4 py-3 text-secondary tabular-nums">
                      {formatDate(user.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-secondary tabular-nums">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-primary tabular-nums">
                      {user.tradeCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-primary tabular-nums">
                      {user.totalVolume}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-caption text-tertiary">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-2 rounded-sm text-label text-secondary hover:text-primary hover:bg-overlay border border-default disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-2 rounded-sm text-label text-secondary hover:text-primary hover:bg-overlay border border-default disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Overview Grid ────────────────────────────────────────────────────────────

interface OverviewGridProps {
  statsMap: Map<string, CohortStats>;
  loading: boolean;
  onViewUsers: (cohortId: string) => void;
  onBroadcast: (cohortId: string) => void;
}

function OverviewGrid({ statsMap, loading, onViewUsers, onBroadcast }: OverviewGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CohortCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
      {COHORT_DEFINITIONS.map((definition) => {
        const stats = statsMap.get(definition.id);
        if (!stats) {
          return (
            <article
              key={definition.id}
              className={`rounded-pf bg-elevated border border-default border-l-4 ${definition.borderColor} p-4 flex flex-col gap-3`}
            >
              <div className="flex items-center gap-2">
                <definition.icon size={18} className={`${definition.iconColor} shrink-0`} aria-hidden="true" />
                <span className="text-heading font-semibold text-primary">{definition.label}</span>
              </div>
              <p className="text-caption text-tertiary">{definition.description}</p>
              <p className="text-body-sm text-tertiary py-4 text-center">No users match this segment yet</p>
            </article>
          );
        }
        return (
          <CohortCard
            key={definition.id}
            definition={definition}
            stats={stats}
            onViewUsers={onViewUsers}
            onBroadcast={onBroadcast}
          />
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Component() {
  const [statsMap, setStatsMap] = useState<Map<string, CohortStats>>(new Map());
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [broadcastTarget, setBroadcastTarget] = useState<string | null>(null);

  // Fetch cohort stats on mount
  useState(() => {
    adminApi
      .segments()
      .then((res) => {
        const map = new Map<string, CohortStats>();
        for (const s of res.data) map.set(s.cohortId, s);
        setStatsMap(map);
      })
      .catch(() => toast.error('Failed to load segment stats'))
      .finally(() => setLoadingStats(false));
  });

  const handleViewUsers = (cohortId: string) => setSelectedCohort(cohortId);
  const handleBack = () => setSelectedCohort(null);

  const handleBroadcast = (cohortId: string) => setBroadcastTarget(cohortId);
  const handleBroadcastClose = () => setBroadcastTarget(null);

  const broadcastStats = broadcastTarget ? statsMap.get(broadcastTarget) : null;
  const broadcastDefinition = broadcastTarget
    ? COHORT_DEFINITIONS.find((d) => d.id === broadcastTarget)
    : null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <PieChart size={24} className="text-accent-text shrink-0 mt-1" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold text-primary">User Segmentation</h1>
          <p className="text-body-sm text-secondary mt-1">
            Understand and act on user cohorts
          </p>
        </div>
      </div>

      {/* Content */}
      {selectedCohort ? (
        <DrillDown cohortId={selectedCohort} onBack={handleBack} />
      ) : (
        <OverviewGrid
          statsMap={statsMap}
          loading={loadingStats}
          onViewUsers={handleViewUsers}
          onBroadcast={handleBroadcast}
        />
      )}

      {/* Broadcast Dialog */}
      {broadcastTarget && broadcastStats && broadcastDefinition && (
        <BroadcastDialog
          cohortId={broadcastTarget}
          cohortLabel={broadcastDefinition.label}
          userCount={broadcastStats.userCount}
          onClose={handleBroadcastClose}
        />
      )}
    </div>
  );
}
