import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import { ChevronLeft, ChevronRight, Square, Zap, AlertCircle, Star } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface StrategyRow {
  id: string;
  name: string;
  username: string;
  status: string;
  execMode: string;
  visibility: string;
  createdAt: string;
  featured?: boolean;
  [key: string]: unknown;
}

export function Component() {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await adminApi.strategies({ page, limit });
      setStrategies((res.data ?? []) as unknown as StrategyRow[]);
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

  function handleForceStop(strategyId: string) {
    setConfirmStop(strategyId);
  }

  async function doForceStop(strategyId: string) {
    try {
      await adminApi.forceStop(strategyId);
      setStrategies((s) =>
        s.map((st) => (st.id === strategyId ? { ...st, status: 'IDLE' } : st)),
      );
      toast.success('Strategy force-stopped');
    } catch {
      toast.error('Failed to force-stop strategy');
    }
  }

  async function handleToggleFeatured(strategyId: string, currentFeatured: boolean) {
    const nextFeatured = !currentFeatured;
    // Optimistic update
    setStrategies((s) =>
      s.map((st) => (st.id === strategyId ? { ...st, featured: nextFeatured } : st)),
    );
    try {
      await adminApi.setFeatured(strategyId, nextFeatured);
      toast.success(nextFeatured ? 'Strategy featured' : 'Feature removed');
    } catch {
      // Revert on failure
      setStrategies((s) =>
        s.map((st) => (st.id === strategyId ? { ...st, featured: currentFeatured } : st)),
      );
      toast.error('Failed to update featured status');
    }
  }

  return (
    <>
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-primary">
        Strategies <span className="text-sm font-normal text-tertiary">({total})</span>
      </h2>

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-tertiary" size={40} aria-hidden="true" />
          <p className="text-secondary mb-4">Failed to load data</p>
          <Button type="button" variant="ghost" onClick={load} className="text-accent-text hover:text-accent-text text-sm">
            Try again
          </Button>
        </div>
      )}

      <div className="bg-elevated border border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto" data-density="compact">
          <table className="w-full text-sm">
            <caption className="sr-only">Trading strategies</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Name</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Owner</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Status</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Exec Mode</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Visibility</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Created</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Featured</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : strategies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Zap className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-secondary font-medium">No strategies found</p>
                    <p className="text-tertiary text-xs mt-1">User strategies will appear here</p>
                  </td>
                </tr>
              ) : (
                strategies.map((s) => (
                  <tr key={s.id} className="border-b border-default last:border-0 hover:bg-app transition-colors">
                    <td className="px-4 py-3 font-medium text-primary">{s.name}</td>
                    <td className="px-4 py-3 text-secondary">{(s as any).user?.username ?? s.username ?? ''}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary capitalize">{s.execMode}</td>
                    <td className="px-4 py-3 text-secondary">{s.visibility}</td>
                    <td className="px-4 py-3 text-tertiary">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleFeatured(s.id, !!s.featured)}
                        aria-label={s.featured ? `Remove featured from ${s.name}` : `Feature strategy ${s.name}`}
                        aria-pressed={!!s.featured}
                        className="inline-flex items-center justify-center p-1 rounded-sm transition-colors hover:bg-app"
                      >
                        <Star
                          size={16}
                          aria-hidden="true"
                          className={s.featured ? 'text-warning fill-warning' : 'text-tertiary'}
                        />
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(s.status === 'RUNNING' || s.status === 'PAPER') && (
                        <Button type="button"
                          variant="danger"
                          onClick={() => handleForceStop(s.id)}
                          aria-label={`Force stop strategy ${s.name}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm bg-loss/10 text-loss hover:bg-loss/20 cursor-pointer transition-colors"
                        >
                          <Square size={12} aria-hidden="true" />
                          Force Stop
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-xs text-tertiary">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={16} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

    <ConfirmDialog
      open={confirmStop !== null}
      title="Force-stop strategy?"
      description="This will immediately halt the running strategy."
      confirmationText="stop"
      destructiveLabel="Force stop"
      onConfirm={() => { const id = confirmStop!; setConfirmStop(null); doForceStop(id); }}
      onCancel={() => setConfirmStop(null)}
    />
    </>
  );
}
