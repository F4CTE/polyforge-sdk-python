import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, FlaskConical, XCircle, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

export function Component() {
  const [backtests, setBacktests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});

  const limit = 20;

  async function cancelBacktest(id: string) {
    setCancelling(prev => ({ ...prev, [id]: true }));
    try {
      await adminApi.cancelBacktest(id);
      toast.success('Backtest cancelled');
      load();
    } catch {
      toast.error('Failed to cancel backtest');
    }
    setCancelling(prev => ({ ...prev, [id]: false }));
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.backtests({ page, limit });
      setBacktests(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load backtests');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function getDuration(bt: any): string {
    if (!bt.createdAt) return '-';
    const start = new Date(bt.createdAt).getTime();
    const end = bt.completedAt ? new Date(bt.completedAt).getTime() : Date.now();
    const diffSec = Math.floor((end - start) / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
        Backtests <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
      </h2>

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Strategy</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Duration</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">P&L</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Win Rate</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : backtests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <FlaskConical className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No backtests found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Backtest runs will appear here</p>
                  </td>
                </tr>
              ) : (
                backtests.map((bt) => (
                  <tr key={bt.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-pf-text-secondary)]">{bt.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text)]">{bt.username}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{bt.strategyName ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bt.status ?? 'UNKNOWN')}`}>
                        {bt.status ?? 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{getDuration(bt)}</td>
                    <td className="px-4 py-3 text-right">
                      {bt.totalPnl != null ? (
                        <span className={parseFloat(bt.totalPnl) >= 0 ? 'text-pf-success' : 'text-pf-danger'}>
                          {parseFloat(bt.totalPnl) >= 0 ? '+' : ''}{bt.totalPnl}
                        </span>
                      ) : (
                        <span className="text-[var(--color-pf-text-tertiary)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-pf-text-secondary)]">
                      {bt.winRate != null ? `${bt.winRate}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDateTime(bt.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {(bt.status === 'RUNNING' || bt.status === 'PENDING' || bt.status === 'QUEUED') && (
                        <button
                          onClick={() => cancelBacktest(bt.id)}
                          disabled={cancelling[bt.id]}
                          aria-label={`Cancel backtest ${bt.id.slice(0, 8)}`}
                          className="inline-flex items-center gap-1 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-danger)] rounded"
                        >
                          {cancelling[bt.id] ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]">
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
