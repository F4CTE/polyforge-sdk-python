import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, AlertTriangle, ClipboardList, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

interface OrderRow {
  id: string;
  username: string;
  side: string;
  status: string;
  size: string | number;
  price: string | number;
  createdAt: string;
  [key: string]: unknown;
}

interface DlqEntry {
  intentId: string;
  username: string;
  lastError: string;
  attempts: number;
  enqueuedAt: string;
  [key: string]: unknown;
}

export function Component() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DlqEntry[]>([]);
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
      setOrders(((ordersRes.data ?? []) as any[]).map(o => ({ ...o, username: o.user?.username ?? o.username ?? '' })) as OrderRow[]);
      setTotal(ordersRes.total ?? 0);
      setTotalPages(ordersRes.totalPages ?? (ordersRes as any).pages ?? 1);
      setDlqEntries((dlqRes?.data ?? []) as unknown as DlqEntry[]);
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
        <h2 className="text-lg font-semibold text-pf-text">
          Orders <span className="text-sm font-normal text-pf-text-tertiary">({total})</span>
        </h2>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by order status"
          className="h-8 px-2 rounded-pf-sm bg-pf-elevated border border-pf-border text-xs text-pf-text focus-visible:outline-none focus-visible:border-pf-cyan-500"
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
          <AlertCircle className="mx-auto mb-3 text-pf-text-tertiary" size={40} aria-hidden="true" />
          <p className="text-pf-text-secondary mb-4">Failed to load data</p>
          <button type="button" onClick={load} className="text-pf-cyan-400 hover:text-[var(--color-pf-cyan-300)] text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-pf-sm">
            Try again
          </button>
        </div>
      )}

      {/* DLQ Section */}
      {dlqEntries.length > 0 && (
        <div className="bg-pf-elevated border border-pf-warning/30 rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-pf-warning" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-pf-warning">
              Dead Letter Queue ({dlqEntries.length})
            </h3>
          </div>
          <div className="space-y-3">
            {dlqEntries.map((entry) => (
              <div
                key={entry.intentId}
                className="flex items-center justify-between p-3 rounded-pf-sm bg-pf-base border border-pf-border"
              >
                <div className="min-w-0">
                  <div className="text-sm text-pf-text">
                    <span className="font-medium">{entry.username}</span>
                    <span className="text-pf-text-tertiary"> - Intent {entry.intentId.slice(0, 8)}</span>
                  </div>
                  <div className="text-xs text-pf-danger mt-0.5 truncate">{entry.lastError}</div>
                  <div className="text-[11px] text-pf-text-tertiary mt-0.5">
                    {entry.attempts} attempts - {formatDateTime(entry.enqueuedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {confirmAction?.intentId === entry.intentId ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-pf-text-secondary">
                        {confirmAction?.type === 'discard' ? 'Discard?' : 'Replay?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => confirmAction?.type === 'replay' ? handleReplay(entry.intentId) : handleDiscard(entry.intentId)}
                        className="px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="px-2 py-0.5 rounded bg-pf-elevated text-pf-text-secondary hover:bg-pf-base cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: 'replay', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-info/10 text-pf-info hover:bg-pf-info/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-info"
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        Replay
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: 'discard', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
                      >
                        <Trash2 size={12} aria-hidden="true" />
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
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Trading orders</caption>
            <thead>
              <tr className="border-b border-pf-border">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">ID</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">User</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Side</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Status</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Size</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Price</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Created</th>
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
                    <ClipboardList className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-pf-text-secondary font-medium">No orders found</p>
                    <p className="text-pf-text-tertiary text-xs mt-1">Orders will appear here once users start trading</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-pf-border last:border-0 hover:bg-pf-base transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-pf-text-secondary">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-pf-text">{o.username}</td>
                    <td className="px-4 py-3">
                      <span className={o.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}>
                        {o.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-pf-text">{o.size}</td>
                    <td className="px-4 py-3 text-right text-pf-text">{o.price}</td>
                    <td className="px-4 py-3 text-pf-text-tertiary">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-pf-border">
            <span className="text-xs text-pf-text-tertiary">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
