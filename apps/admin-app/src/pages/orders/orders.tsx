import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, Select } from '@polyforge/ui';
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
        <h2 className="text-lg font-semibold text-primary">
          Orders <span className="text-body-sm font-normal text-tertiary">({total})</span>
        </h2>
        <Select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by order status"
          className="h-8 px-2 rounded-sm bg-elevated border border-default text-label text-primary focus-visible:outline-none focus-visible:border-accent"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="LIVE">Live</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-tertiary" size={40} aria-hidden="true" />
          <p className="text-secondary mb-4">Failed to load data</p>
          <Button type="button" variant="ghost" onClick={load} className="text-accent-text hover:text-accent-text text-body-sm">
            Try again
          </Button>
        </div>
      )}

      {/* DLQ Section */}
      {dlqEntries.length > 0 && (
        <div className="bg-elevated border border-warning/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
            <h3 className="text-body-md font-semibold text-warning">
              Dead Letter Queue ({dlqEntries.length})
            </h3>
          </div>
          <div className="space-y-3">
            {dlqEntries.map((entry) => (
              <div
                key={entry.intentId}
                className="flex items-center justify-between p-3 rounded-sm bg-app border border-default"
              >
                <div className="min-w-0">
                  <div className="text-body-sm text-primary">
                    <span className="font-medium">{entry.username}</span>
                    <span className="text-tertiary"> - Intent {entry.intentId.slice(0, 8)}</span>
                  </div>
                  <div className="text-label text-loss mt-1 truncate">{entry.lastError}</div>
                  <div className="text-label text-tertiary mt-1">
                    {entry.attempts} attempts - {formatDateTime(entry.enqueuedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {confirmAction?.intentId === entry.intentId ? (
                    <div className="flex items-center gap-2 text-label">
                      <span className="text-secondary">
                        {confirmAction?.type === 'discard' ? 'Discard?' : 'Replay?'}
                      </span>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => confirmAction?.type === 'replay' ? handleReplay(entry.intentId) : handleDiscard(entry.intentId)}
                        className="px-2 py-1 rounded-sm bg-loss/10 text-loss hover:bg-loss/20 cursor-pointer transition-colors"
                      >
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setConfirmAction(null)}
                        className="px-2 py-1 rounded-sm bg-elevated text-secondary hover:bg-app cursor-pointer transition-colors"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => setConfirmAction({ type: 'replay', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-label rounded-sm bg-info/10 text-info hover:bg-info/20 cursor-pointer transition-colors"
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        Replay
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setConfirmAction({ type: 'discard', intentId: entry.intentId })}
                        className="flex items-center gap-1 px-2 py-1 text-label rounded-sm bg-loss/10 text-loss hover:bg-loss/20 cursor-pointer transition-colors"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Discard
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-elevated border border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <caption className="sr-only">Trading orders</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">ID</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">User</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Side</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Status</th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Size</th>
                <th scope="col" className="text-right px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Price</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardList className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-secondary font-medium">No orders found</p>
                    <p className="text-tertiary text-label mt-1">Orders will appear here once users start trading</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-default last:border-0 hover:bg-app transition-colors">
                    <td className="px-4 py-3 font-mono text-label text-secondary">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-primary">{o.username}</td>
                    <td className="px-4 py-3">
                      <span className={o.side === 'BUY' ? 'text-gain' : 'text-loss'}>
                        {o.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-label font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-primary font-mono">{o.size}</td>
                    <td className="px-4 py-3 text-right text-primary font-mono">{o.price}</td>
                    <td className="px-4 py-3 text-tertiary">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-caption text-tertiary">Page {page} of {totalPages}</span>
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
  );
}
