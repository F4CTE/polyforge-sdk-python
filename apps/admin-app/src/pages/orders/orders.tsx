import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

export function Component() {
  const [orders, setOrders] = useState<any[]>([]);
  const [dlqEntries, setDlqEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, dlqRes] = await Promise.all([
        adminApi.orders({ page, limit }),
        adminApi.dlq(),
      ]);
      setOrders(ordersRes.data ?? []);
      setTotal(ordersRes.total ?? 0);
      setTotalPages(ordersRes.totalPages ?? 1);
      setDlqEntries(dlqRes ?? []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReplay(intentId: string) {
    try {
      await adminApi.dlqReplay(intentId);
      setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
      toast.success('DLQ entry replayed');
    } catch {
      toast.error('Failed to replay');
    }
  }

  async function handleDiscard(intentId: string) {
    try {
      await adminApi.dlqDiscard(intentId);
      setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
      toast.success('DLQ entry discarded');
    } catch {
      toast.error('Failed to discard');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
        Orders <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
      </h2>

      {/* DLQ Section */}
      {dlqEntries.length > 0 && (
        <div className="bg-[var(--color-pf-elevated)] border border-amber-500/30 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400">
              Dead Letter Queue ({dlqEntries.length})
            </h3>
          </div>
          <div className="space-y-3">
            {dlqEntries.map((entry) => (
              <div
                key={entry.intentId}
                className="flex items-center justify-between p-3 rounded-md bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-pf-text)]">
                    <span className="font-medium">{entry.username}</span>
                    <span className="text-[var(--color-pf-text-tertiary)]"> - Intent {entry.intentId.slice(0, 8)}</span>
                  </div>
                  <div className="text-xs text-red-400 mt-0.5 truncate">{entry.lastError}</div>
                  <div className="text-[11px] text-[var(--color-pf-text-tertiary)] mt-0.5">
                    {entry.attempts} attempts - {formatDateTime(entry.enqueuedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => handleReplay(entry.intentId)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Replay
                  </button>
                  <button
                    onClick={() => handleDiscard(entry.intentId)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={12} />
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Side</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Size</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Price</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">Loading...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">No orders found</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-pf-text-secondary)]">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text)]">{o.username}</td>
                    <td className="px-4 py-3">
                      <span className={o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                        {o.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-pf-text)]">{o.size}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-pf-text)]">{o.price}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDateTime(o.createdAt)}</td>
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
