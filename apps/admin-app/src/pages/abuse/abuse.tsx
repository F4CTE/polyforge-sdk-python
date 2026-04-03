import { useState, useEffect, useCallback } from 'react';
import { Button, Textarea } from '@polyforge/ui';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Copy,
  RefreshCw,
  Zap,
  BarChart2,
  AlertTriangle,
  Ban,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AbuseType =
  | 'unrealistic_winrate'
  | 'copy_farming'
  | 'wash_trading'
  | 'performance_spike'
  | 'suspicious_volume';

export interface FlaggedStrategy {
  id: string;
  strategyName: string;
  authorUsername: string;
  authorId: string;
  abuseType: AbuseType;
  severity: 'critical' | 'high' | 'medium';
  flaggedAt: string;
  details: string;
  evidence: {
    metric: string;
    value: string;
    threshold: string;
    deviation: string;
  }[];
  status: 'pending' | 'reviewing' | 'cleared' | 'actioned';
  reviewNote?: string;
}

type ReviewAction = 'clear' | 'warn' | 'delist' | 'ban_author';
type StatusTab = 'pending' | 'reviewing' | 'cleared' | 'actioned';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ABUSE_META: Record<AbuseType, { icon: React.ReactNode; label: string }> = {
  unrealistic_winrate: {
    icon: <TrendingUp size={14} aria-hidden="true" />,
    label: 'Unrealistic Win Rate',
  },
  copy_farming: {
    icon: <Copy size={14} aria-hidden="true" />,
    label: 'Copy Farming',
  },
  wash_trading: {
    icon: <RefreshCw size={14} aria-hidden="true" />,
    label: 'Wash Trading',
  },
  performance_spike: {
    icon: <Zap size={14} aria-hidden="true" />,
    label: 'Performance Spike',
  },
  suspicious_volume: {
    icon: <BarChart2 size={14} aria-hidden="true" />,
    label: 'Suspicious Volume',
  },
};

const SEVERITY_STYLES: Record<FlaggedStrategy['severity'], string> = {
  critical: 'bg-pf-danger/10 text-pf-danger border border-pf-danger/20',
  high: 'bg-pf-warning/10 text-pf-warning border border-pf-warning/20',
  medium: 'bg-pf-text-secondary/10 text-pf-text-secondary border border-pf-border',
};

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'cleared', label: 'Cleared' },
  { key: 'actioned', label: 'Actioned' },
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-pf-md border border-pf-border bg-pf-surface p-5 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 rounded-pf-sm bg-pf-elevated" />
        <div className="h-5 w-40 rounded-pf-sm bg-pf-elevated" />
        <div className="ml-auto h-5 w-24 rounded-pf-sm bg-pf-elevated" />
      </div>
      <div className="h-4 w-48 rounded-pf-sm bg-pf-elevated" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded-pf-sm bg-pf-elevated" />
        <div className="h-4 w-3/4 rounded-pf-sm bg-pf-elevated" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-8 w-24 rounded-pf-sm bg-pf-elevated" />
        <div className="h-8 w-24 rounded-pf-sm bg-pf-elevated" />
        <div className="h-8 w-28 rounded-pf-sm bg-pf-elevated" />
        <div className="h-8 w-24 rounded-pf-sm bg-pf-elevated" />
      </div>
    </div>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}

function SummaryCard({ label, value, icon, accent }: SummaryCardProps) {
  return (
    <div className="rounded-pf-md border border-pf-border bg-pf-surface p-4 flex items-center gap-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-pf-md ${accent ?? 'bg-pf-elevated text-pf-text-secondary'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-xl font-bold ${accent ? 'text-pf-danger' : 'text-pf-text'}`}>{value}</div>
        <div className="text-xs text-pf-text-tertiary">{label}</div>
      </div>
    </div>
  );
}

// ─── Flagged Strategy Card ─────────────────────────────────────────────────────

interface FlaggedCardProps {
  strategy: FlaggedStrategy;
  onAction: (id: string, action: ReviewAction, note: string) => Promise<void>;
}

function FlaggedCard({ strategy, onAction }: FlaggedCardProps) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);

  const meta = ABUSE_META[strategy.abuseType];

  const noteRequired = (action: ReviewAction) => action !== 'clear';

  const handleAction = async (action: ReviewAction) => {
    if (noteRequired(action) && !note.trim()) {
      toast.error('A review note is required for this action.');
      return;
    }
    if (action === 'ban_author' && !confirmBan) {
      setConfirmBan(true);
      return;
    }
    setPending(action);
    setConfirmBan(false);
    try {
      await onAction(strategy.id, action, note.trim());
    } finally {
      setPending(null);
    }
  };

  const isActioning = pending !== null;

  return (
    <div className="rounded-pf-md border border-pf-border bg-pf-surface p-5 space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-pf-sm text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES[strategy.severity]}`}>
          {strategy.severity === 'critical' && <AlertTriangle size={11} aria-hidden="true" />}
          {strategy.severity}
        </span>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-pf-text">{strategy.strategyName}</span>
          <span className="ml-2 text-xs text-pf-text-secondary">@{strategy.authorUsername}</span>
        </div>

        <a
          href={`/strategies/${strategy.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-pf-text-secondary hover:text-pf-cyan-500 transition-colors"
          aria-label={`View strategy ${strategy.strategyName}`}
        >
          <ExternalLink size={13} aria-hidden="true" />
          View
        </a>
      </div>

      {/* Abuse type + flagged time */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-pf-text-secondary">
          {meta.icon}
          {meta.label}
        </span>
        <span className="text-xs text-pf-text-tertiary">
          Flagged: {formatRelativeTime(strategy.flaggedAt)}
        </span>
      </div>

      {/* Evidence table */}
      {strategy.evidence.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-pf-text-secondary uppercase tracking-wide">Evidence</div>
          <div className="rounded-pf-sm border border-pf-border divide-y divide-pf-border overflow-hidden">
            {strategy.evidence.map((ev, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs bg-pf-elevated/40">
                <span className="text-pf-text-secondary font-medium">{ev.metric}</span>
                <span className="text-pf-text font-semibold">{ev.value}</span>
                <span className="text-pf-text-tertiary">threshold: {ev.threshold}</span>
                <span className="text-pf-danger font-medium">{ev.deviation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <p className="text-xs text-pf-text-secondary leading-relaxed">
        {strategy.details}
      </p>

      {/* Review note */}
      <div>
        <label htmlFor={`note-${strategy.id}`} className="block text-xs font-medium text-pf-text-secondary mb-1">
          Review note <span className="text-pf-text-tertiary">(required for Warn, Delist, Ban)</span>
        </label>
        <Textarea
          id={`note-${strategy.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a review note..."
          disabled={isActioning}
          className="w-full rounded-pf-sm border border-pf-border bg-pf-elevated px-3 py-2 text-xs text-pf-text placeholder:text-pf-text-tertiary resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 disabled:opacity-50"
        />
      </div>

      {/* Ban confirmation */}
      {confirmBan && (
        <div className="rounded-pf-sm border border-pf-danger/30 bg-pf-danger/5 px-4 py-3 flex flex-wrap items-center gap-3">
          <AlertTriangle size={15} className="text-pf-danger shrink-0" aria-hidden="true" />
          <span className="text-xs text-pf-danger flex-1">
            Ban <strong>@{strategy.authorUsername}</strong>? This will permanently disable their account and remove all their listings.
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmBan(false)}
              className="px-3 py-2 rounded-pf-sm border border-pf-border text-xs text-pf-text-secondary hover:bg-pf-elevated transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => handleAction('ban_author')}
              disabled={isActioning}
              className="px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {pending === 'ban_author' ? 'Banning…' : 'Confirm Ban'}
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!confirmBan && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="success"
            onClick={() => handleAction('clear')}
            disabled={isActioning}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-pf-sm border border-pf-success/40 text-xs font-medium text-pf-success hover:bg-pf-success/10 transition-colors disabled:opacity-50"
          >
            <ShieldCheck size={13} aria-hidden="true" />
            {pending === 'clear' ? 'Clearing…' : 'Clear — No Abuse'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleAction('warn')}
            disabled={isActioning}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-pf-sm border border-pf-warning/40 text-xs font-medium text-pf-warning hover:bg-pf-warning/10 transition-colors disabled:opacity-50"
          >
            <AlertTriangle size={13} aria-hidden="true" />
            {pending === 'warn' ? 'Warning…' : 'Warn Author'}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={() => handleAction('delist')}
            disabled={isActioning}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-pf-sm border border-pf-danger/40 text-xs font-medium text-pf-danger hover:bg-pf-danger/10 transition-colors disabled:opacity-50"
          >
            <Eye size={13} aria-hidden="true" />
            {pending === 'delist' ? 'Delisting…' : 'Delist Strategy'}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={() => handleAction('ban_author')}
            disabled={isActioning}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Ban size={13} aria-hidden="true" />
            {pending === 'ban_author' ? 'Banning…' : 'Ban Author'}
          </Button>
        </div>
      )}

      {/* Existing review note (cleared/actioned) */}
      {strategy.reviewNote && (
        <div className="rounded-pf-sm bg-pf-elevated px-3 py-2 text-xs text-pf-text-secondary">
          <span className="font-medium text-pf-text-tertiary">Admin note: </span>
          {strategy.reviewNote}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function Component() {
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [strategies, setStrategies] = useState<FlaggedStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Summary card counts — derived from loaded data + tracked separately for pending badge
  const criticalCount = strategies.filter((s) => s.severity === 'critical' && s.status === activeTab).length;

  const fetchStrategies = useCallback(async (status: StatusTab) => {
    setLoading(true);
    try {
      const res = await adminApi.abuseFlaggedStrategies({ status, page: 1 });
      setStrategies(res.data);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load flagged strategies.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep pending count fresh for the header badge
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await adminApi.abuseFlaggedStrategies({ status: 'pending', page: 1 });
      setPendingCount(res.total);
    } catch {
      // non-critical, suppress
    }
  }, []);

  useEffect(() => {
    fetchStrategies(activeTab);
  }, [activeTab, fetchStrategies]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  const handleAction = async (id: string, action: ReviewAction, note: string) => {
    try {
      await adminApi.abuseReview(id, action, note);

      const actionLabels: Record<ReviewAction, string> = {
        clear: 'Strategy cleared — no abuse found.',
        warn: 'Warning sent to author.',
        delist: 'Strategy delisted from marketplace.',
        ban_author: 'Author account has been banned.',
      };

      toast.success(actionLabels[action]);

      // Remove the card from the current list (it moves to Actioned)
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => Math.max(0, t - 1));

      // Refresh pending count
      fetchPendingCount();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed. Please try again.';
      toast.error(msg);
      throw err;
    }
  };

  const visibleStrategies = strategies.filter((s) => s.status === activeTab);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={22} className="text-pf-danger" aria-hidden="true" />
          <h1 className="text-xl font-bold text-pf-text">Abuse Detection</h1>
        </div>
        {pendingCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[22px] h-5 px-2 rounded-pf-full bg-pf-danger text-pf-caption font-bold text-white"
            aria-label={`${pendingCount} pending flagged strategies`}
          >
            {pendingCount}
          </span>
        )}
        <p className="text-sm text-pf-text-secondary ml-auto">
          Automated detection of strategy marketplace abuse patterns.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Flagged (Pending)"
          value={pendingCount}
          icon={<ShieldAlert size={18} aria-hidden="true" />}
          accent={pendingCount > 0 ? 'bg-pf-danger/10 text-pf-danger' : undefined}
        />
        <SummaryCard
          label="Critical Severity"
          value={criticalCount}
          icon={<AlertTriangle size={18} aria-hidden="true" />}
          accent={criticalCount > 0 ? 'bg-pf-danger/10 text-pf-danger' : undefined}
        />
        <SummaryCard
          label="Auto-cleared (Last 7d)"
          value="—"
          icon={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <SummaryCard
          label="Actions Taken (Last 7d)"
          value="—"
          icon={<Ban size={18} aria-hidden="true" />}
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-pf-border">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant="ghost"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-pf-sm ${
              activeTab === tab.key
                ? 'border-pf-cyan-500 text-pf-cyan-500'
                : 'border-transparent text-pf-text-secondary hover:text-pf-text'
            }`}
            aria-current={activeTab === tab.key ? 'page' : undefined}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-pf-full bg-pf-danger text-pf-micro font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading flagged strategies">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleStrategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <ShieldCheck size={48} className="text-pf-success opacity-60" aria-hidden="true" />
          <p className="text-base font-semibold text-pf-text">No flagged strategies</p>
          <p className="text-sm text-pf-text-secondary max-w-xs">
            {activeTab === 'pending'
              ? 'Everything looks clean — no strategies are currently flagged for review.'
              : `No strategies in the "${activeTab}" state.`}
          </p>
        </div>
      ) : (
        <>
          <div className="text-xs text-pf-text-tertiary">
            {total} {total === 1 ? 'strategy' : 'strategies'} — showing {visibleStrategies.length}
          </div>
          <div className="space-y-4">
            {visibleStrategies.map((strategy) => (
              <FlaggedCard
                key={strategy.id}
                strategy={strategy}
                onAction={handleAction}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
