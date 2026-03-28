import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, AlertTriangle, ClipboardList, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

export function Component() {
  const [orders, setOrders] = useState<any[]>([]);
  const [dlqEntries, setDlqEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ordersRes, dlqRes] = await Promise.all([
        adminApi.orders({ page, limit, status: statusFilter || undefined }),
        adminApi.dlq(),
      ]);
      setOrders(ordersRes.data ?? []);
      setTotal(ordersRes.total ?? 0);
      setTotalPages(ordersRes.totalPages ?? 1);
      setDlqEntries(dlqRes ?? []);
    } catch {
      setError(true);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const [confirmAction, setConfirmAction] = useState<{ type: 'replay' | 'discard'; intentId: string } | null>(null);

  async function handleReplay(intentId: string) {
    setConfirmAction(null);
    try {
      await adminApi.dlqReplay(intentId);
      setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
      toast.success('DLQ entry replayed');
    } catch {
      toast.error('Failed to replay');
    }
  }

  async function handleDiscard(intentId: string) {
    setConfirmAction(null);
    try {
      await adminApi.dlqDiscard(intentId);
      setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
      toast.success('DLQ entry discarded');
    } catch {
      toast.error('Failed to discard');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
          Orders <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
        </h2>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by order status"
          className="h-8 px-2 rounded-pf-sm bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] text-xs text-[var(--color-pf-text)] focus:outline-none focus:border-[var(--color-pf-cyan-500)]"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="LIVE">Live</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)]" size={40} />
          <p className="text-[var(--color-pf-text-secondary)] mb-4">Failed to load data</p>
          <button onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm">
            Try again
          </button>
        </div>
      )}

      {/* DLQ Section */}
      {dlqEntries.length > 0 && (
        <div className="bg-[var(--color-pf-elevated)] border border-pf-warning/30 rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-pf-warning" />
            <h3 className="text-sm font-semibold text-pf-warning">
              Dead Letter Queue ({dlqEntries.length})
            </h3>
          </div>
          <div className="space-y-3">
            {dlqEntries.map((entry) => (
              <div
                key={entry.intentId}
                className="flex items-center justify-between p-3 rounded-pf-sm bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-pf-text)]">
                    <span className="font-medium">{entry.username}</span>
                    <span className="text-[var(--color-pf-text-tertiary)]"> - Intent {entry.intentId.slice(0, 8)}</span>
                  </div>
                  <div className="text-xs text-pf-danger mt-0.5 truncate">{entry.lastError}</div>
                  <div className="text-[11px] text-[var(--color-pf-text-tertiary)] mt-0.5">
                    {entry.attempts} attempts - {formatDateTime(entry.enqueuedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {confirmAction?.intentId === entry.intentId ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--color-pf-text-secondary)]">
                        {confirmAction?.type === 'discard' ? 'Discard?' : 'Replay?'}
                      </span>
                      <button
                        onClick={() => confirmAction?.type === 'replay' ? handleReplay(entry.intentId) : handleDiscard(entry.intentId)}
                        className="px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmAction({ type: 'replay', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-info/10 text-pf-info hover:bg-pf-info/20 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Replay
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'discard', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors"
                      >
                        <Trash2 size={12} />
                        Discard
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
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
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardList className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No orders found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Orders will appear here once users start trading</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-pf-text-secondary)]">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text)]">{o.username}</td>
                    <td className="px-4 py-3">
                      <span className={o.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}>
                        {o.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status ?? 'UNKNOWN')}`}>
                        {o.status ?? 'UNKNOWN'}
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
