import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Square } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';

export function Component() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.strategies({ page, limit });
      setStrategies(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleForceStop(id: string) {
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
        Strategies <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
      </h2>

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Exec Mode</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Visibility</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">Loading...</td>
                </tr>
              ) : strategies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">No strategies found</td>
                </tr>
              ) : (
                strategies.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-pf-text)]">{s.name}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{s.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)] capitalize">{s.execMode}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{s.visibility}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {(s.status === 'RUNNING' || s.status === 'PAPER') && (
                        <button
                          onClick={() => handleForceStop(s.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
