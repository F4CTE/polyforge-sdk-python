import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Square, Zap, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';

export function Component() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await adminApi.strategies({ page, limit });
      setStrategies(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      setError(true);
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleForceStop(id: string) {
    if (!window.confirm('Are you sure you want to force-stop this strategy?')) return;
    try {
      await adminApi.forceStop(id);
      setStrategies((s) =>
        s.map((st) => (st.id === id ? { ...st, status: 'IDLE' } : st)),
      );
      toast.success('Strategy force-stopped');
    } catch {
      toast.error('Failed to force-stop strategy');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
        Strategies <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
      </h2>

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)]" size={40} />
          <p className="text-[var(--color-pf-text-secondary)] mb-4">Failed to load data</p>
          <button type="button" onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)] rounded-pf-sm px-2 py-1">
            Try again
          </button>
        </div>
      )}

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Trading strategies</caption>
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Name</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Owner</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Exec Mode</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Visibility</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : strategies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Zap className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No strategies found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">User strategies will appear here</p>
                  </td>
                </tr>
              ) : (
                strategies.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-pf-text)]">{s.name}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{s.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status ?? 'UNKNOWN')}`}>
                        {s.status ?? 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)] capitalize">{s.execMode}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{s.visibility}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {(s.status === 'RUNNING' || s.status === 'PAPER') && (
                        <button type="button"
                          onClick={() => handleForceStop(s.id)}
                          aria-label={`Force stop strategy ${s.name}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger/40"
                        >
                          <Square size={12} />
                          Force Stop
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
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
