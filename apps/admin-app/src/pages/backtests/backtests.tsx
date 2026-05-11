import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  RefreshCw,
  Ban,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Link } from 'react-router';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BacktestRow {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  strategyName: string;
  userId: string;
  username: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  totalTrades?: number;
  winRate?: string;
  totalPnl?: string;
  errorMessage?: string;
}

type StatusFilter = 'ALL' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const LIMIT = 25;
const AUTO_REFRESH_INTERVAL_MS = 10_000;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(bt: BacktestRow): string {
  if (bt.durationMs != null) {
    const totalSec = Math.floor(bt.durationMs / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  }
  if (bt.status === 'COMPLETED' || bt.status === 'FAILED' || bt.status === 'CANCELLED') {
    if (!bt.createdAt || !bt.completedAt) return '—';
    const diffMs = new Date(bt.completedAt).getTime() - new Date(bt.createdAt).getTime();
    const totalSec = Math.floor(diffMs / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  }
  return '—';
}

function statusBadgeClass(status: BacktestRow['status']): string {
  switch (status) {
    case 'PENDING':
      return 'text-secondary bg-elevated';
    case 'RUNNING':
      return 'text-accent-text bg-accent/10';
    case 'COMPLETED':
      return 'text-gain bg-gain/10';
    case 'FAILED':
      return 'text-loss bg-loss/10';
    case 'CANCELLED':
      return 'text-secondary bg-elevated';
    default:
      return 'text-secondary bg-elevated';
  }
}

function pnlClass(pnl: string): string {
  return parseFloat(pnl) >= 0 ? 'text-gain' : 'text-loss';
}

function pnlPrefix(pnl: string): string {
  return parseFloat(pnl) >= 0 ? '+' : '';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Component() {
  const [backtests, setBacktests] = useState<BacktestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});
  const [confirmCancel, setConfirmCancel] = useState<BacktestRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: LIMIT,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        userId: usernameFilter || undefined,
      };
      const res = await adminApi.backtests(params);
      const rows = ((res.data ?? []) as unknown[]).map((b: unknown) => {
        const bt = b as Record<string, unknown>;
        return {
          ...bt,
          username:
            (bt.user as Record<string, unknown> | undefined)?.username ??
            bt.username ??
            '',
          strategyName:
            (bt.strategy as Record<string, unknown> | undefined)?.name ??
            bt.strategyName ??
            '—',
        } as BacktestRow;
      });
      setBacktests(rows);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load backtests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, usernameFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Auto-refresh ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        load({ silent: true });
      }, AUTO_REFRESH_INTERVAL_MS);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefresh, load]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  function handleCancel(bt: BacktestRow) {
    setConfirmCancel(bt);
  }

  async function doCancel(bt: BacktestRow) {
    setCancelling((prev) => ({ ...prev, [bt.id]: true }));
    try {
      await adminApi.cancelBacktest(bt.id);
      toast.success('Backtest cancelled');
      load();
    } catch {
      toast.error('Failed to cancel backtest');
    } finally {
      setCancelling((prev) => ({ ...prev, [bt.id]: false }));
    }
  }

  function handleUsernameSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setUsernameFilter(usernameInput.trim());
  }

  function handleStatusTab(val: StatusFilter) {
    setStatusFilter(val);
    setPage(1);
  }

  // ─── Summary stats (computed from current page) ─────────────────────────────

  const runningCount = backtests.filter((b) => b.status === 'RUNNING').length;
  const today = new Date().toDateString();
  const completedToday = backtests.filter(
    (b) => b.status === 'COMPLETED' && new Date(b.createdAt).toDateString() === today
  ).length;
  const failedToday = backtests.filter(
    (b) => b.status === 'FAILED' && new Date(b.createdAt).toDateString() === today
  ).length;

  const colCount = 9;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          Backtests
          <span className="text-body-sm font-normal text-tertiary px-2 py-1 bg-elevated border border-default rounded-full">
            {total}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-label text-secondary cursor-pointer select-none">
            <span className="relative inline-block w-8 h-4">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                aria-label="Toggle auto-refresh"
              />
              <span className="block w-full h-full rounded-full bg-default peer-checked:bg-accent transition-colors" />
              <span className="absolute top-1 left-1 w-3 h-3 rounded-full bg-primary transition-transform peer-checked:translate-x-4" />
            </span>
            Auto-refresh
            {refreshing && (
              <Loader2 size={12} className="animate-spin text-accent-text" aria-hidden="true" />
            )}
          </label>

          {/* Manual refresh */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => load({ silent: true })}
            disabled={loading || refreshing}
            aria-label="Refresh backtests"
            className="flex items-center gap-2 px-3 py-2 text-label rounded-sm bg-elevated border border-default text-secondary hover:text-primary hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw
              size={12}
              className={refreshing ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Backtests', value: total },
          { label: 'Running Now', value: runningCount, highlight: runningCount > 0 },
          { label: 'Completed Today', value: completedToday },
          { label: 'Failed Today', value: failedToday, danger: failedToday > 0 },
        ].map(({ label, value, highlight, danger }) => (
          <div
            key={label}
            className="bg-elevated border border-default rounded-pf p-4"
          >
            <p className="text-label text-tertiary mb-1">{label}</p>
            <p
              className={`text-2xl font-semibold ${
                danger
                  ? 'text-loss'
                  : highlight
                  ? 'text-accent-text'
                  : 'text-primary'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-elevated border border-default rounded-sm p-1 flex-wrap">
          {STATUS_TABS.map(({ label, value }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              onClick={() => handleStatusTab(value)}
              className={`px-3 py-1 text-label rounded-pf transition-colors ${
                statusFilter === value
                  ? 'bg-accent/20 text-accent-text font-medium'
                  : 'text-tertiary hover:text-primary'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Username search */}
        <form onSubmit={handleUsernameSearch} className="flex items-center gap-2 ml-auto">
          <Input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Filter by username..."
            aria-label="Filter by username"
            className="h-8 px-3 rounded-sm bg-elevated border border-default text-label text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent transition-colors w-48"
          />
          <Button
            type="submit"
            variant="default"
            className="h-8 px-3 rounded-sm bg-accent/10 border border-accent/30 text-label text-accent-text hover:bg-accent/20 transition-colors"
          >
            Search
          </Button>
          {usernameFilter && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setUsernameFilter('');
                setUsernameInput('');
                setPage(1);
              }}
              className="h-8 px-3 rounded-sm bg-elevated border border-default text-label text-secondary hover:text-primary transition-colors"
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="overflow-x-auto" data-density="compact">
          <table className="w-full text-body-sm" aria-label="Backtest results">
            <caption className="sr-only">Backtest runs</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Started At
                </th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Strategy
                </th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Trades
                </th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Win Rate
                </th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  P&amp;L
                </th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-default last:border-0">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : backtests.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-16">
                    <FlaskConical
                      className="mx-auto mb-3 text-tertiary opacity-40"
                      size={40}
                      aria-hidden="true"
                    />
                    <p className="text-secondary font-medium">No backtests found</p>
                    <p className="text-tertiary text-label mt-1">
                      {statusFilter !== 'ALL' || usernameFilter
                        ? 'Try adjusting your filters'
                        : 'Backtest runs will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                backtests.map((bt) => {
                  const isRunning = bt.status === 'RUNNING';
                  const isCompleted = bt.status === 'COMPLETED';
                  const isFailed = bt.status === 'FAILED';
                  const canCancel = bt.status === 'PENDING' || bt.status === 'RUNNING';

                  return (
                    <tr
                      key={bt.id}
                      className={`border-b border-default last:border-0 transition-colors ${
                        isRunning
                          ? 'bg-accent/5 hover:bg-accent/10'
                          : 'hover:bg-app'
                      }`}
                    >
                      {/* Started At */}
                      <td className="px-4 py-3 text-tertiary text-caption whitespace-nowrap">
                        {bt.createdAt ? formatDateTime(bt.createdAt) : '—'}
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        {bt.userId ? (
                          <Link
                            to={`/users/${bt.userId}`}
                            className="text-accent-text hover:text-accent-text transition-colors text-label"
                          >
                            @{bt.username || bt.userId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-secondary text-label">
                            @{bt.username || '—'}
                          </span>
                        )}
                      </td>

                      {/* Strategy */}
                      <td className="px-4 py-3 text-secondary text-label max-w-col-sm truncate" title={bt.strategyName}>
                        {bt.strategyName || '—'}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-label font-medium ${statusBadgeClass(bt.status)}`}
                        >
                          {isRunning && (
                            <span
                              className="w-2 h-2 rounded-full bg-accent-text animate-pulse"
                              aria-hidden="true"
                            />
                          )}
                          {bt.status}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-secondary text-label whitespace-nowrap">
                        {formatDuration(bt)}
                      </td>

                      {/* Trades */}
                      <td className="px-4 py-3 text-right text-secondary text-label">
                        {isCompleted && bt.totalTrades != null ? bt.totalTrades : '—'}
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 py-3 text-right text-label">
                        {isCompleted && bt.winRate != null ? (
                          <span className="text-primary">{bt.winRate}%</span>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>

                      {/* P&L */}
                      <td className="px-4 py-3 text-right text-label">
                        {isCompleted && bt.totalPnl != null ? (
                          <span className={pnlClass(bt.totalPnl)}>
                            {pnlPrefix(bt.totalPnl)}{bt.totalPnl}
                          </span>
                        ) : isFailed && bt.errorMessage ? (
                          <span
                            className="text-loss truncate max-w-col-xs inline-block"
                            title={bt.errorMessage}
                          >
                            {bt.errorMessage.length > 30
                              ? bt.errorMessage.slice(0, 30) + '…'
                              : bt.errorMessage}
                          </span>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {canCancel && (
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => handleCancel(bt)}
                            disabled={cancelling[bt.id]}
                            aria-label={`Cancel backtest ${bt.id.slice(0, 8)}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-label rounded-sm border border-loss/40 text-loss hover:bg-loss/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {cancelling[bt.id] ? (
                              <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Ban size={11} aria-hidden="true" />
                            )}
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-2 rounded-sm hover:bg-app text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-2 rounded-sm hover:bg-app text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

    {confirmCancel && (
      <ConfirmDialog
        open={true}
        title="Cancel backtest?"
        description={`Cancel backtest ${confirmCancel.id.slice(0, 8)} for @${confirmCancel.username}? This cannot be undone.`}
        confirmationText="delete"
        destructiveLabel="Cancel backtest"
        onConfirm={() => { const bt = confirmCancel; setConfirmCancel(null); doCancel(bt); }}
        onCancel={() => setConfirmCancel(null)}
      />
    )}
    </>
  );
}
