import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, ClipboardList, X,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
type FilterStatus = 'ALL' | OrderStatus;

interface Order {
  id: string;
  side: string;
  outcome: string;
  size: string;
  price: string;
  fillSize?: string;
  fillPrice?: string;
  orderType: string;
  status: OrderStatus;
  createdAt: string;
  placedAt?: string;
  filledAt?: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Failed', value: 'FAILED' },
];

const STATUS_STYLES: Record<OrderStatus, { text: string; bg: string }> = {
  PENDING:   { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  SUBMITTED: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  LIVE:      { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  MATCHED:   { text: 'text-cyan-300', bg: 'bg-cyan-500/8' },
  CONFIRMED: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  CANCELLED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
  FAILED:    { text: 'text-red-400', bg: 'bg-red-500/10' },
};

function fillRatio(order: Order): string {
  const total = parseFloat(order.size);
  if (!total) return '\u2014';
  return `${order.fillSize ?? '0'} / ${order.size}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = useCallback(async (p: number, f: FilterStatus) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (f !== 'ALL') params.set('status', f);
      const res = await fetch(`/api/v1/orders?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: OrdersResponse = await res.json();
        setOrders(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load orders'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, filter); }, [page, filter, load]);

  function changeFilter(f: FilterStatus) {
    setFilter(f);
    setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Orders</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{total} orders</span>}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => changeFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              filter === f.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-muted uppercase tracking-wider">
                <th className="px-4 py-3 font-medium w-10">#</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium text-right">Size</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Filled / Total</th>
                <th className="px-4 py-3 font-medium text-right">Avg Fill</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <ClipboardList className="size-10 text-pf-text-muted mb-3" />
                      <p className="text-sm font-medium text-pf-text">No orders found</p>
                      <p className="text-xs text-pf-text-muted mt-1">Orders placed by your strategies will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order, i) => {
                  const ss = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;
                  return (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      onClick={() => setSelectedOrder(order)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOrder(order); }}
                      className="hover:bg-pf-surface/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-pf-text-muted">{(page - 1) * 25 + i + 1}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          order.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          order.outcome === 'YES' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {order.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text">{order.size}</td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text">{order.price}</td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{fillRatio(order)}</td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text">{order.fillPrice ?? '\u2014'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-pf-text-muted">{order.orderType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[11px] text-pf-text-muted">{formatDate(order.createdAt)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Order detail dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" role="dialog" aria-modal="true" aria-label="Order Details">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md h-full bg-pf-surface border-l border-pf-border overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pf-border-subtle">
              <h2 className="text-lg font-semibold text-pf-text">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-pf-text-muted hover:text-pf-text transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {([
                { label: 'Order ID', value: <span className="font-mono text-[11px]">{selectedOrder.id.slice(0, 8)}...</span> },
                { label: 'Side', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>{selectedOrder.side}</span>
                )},
                { label: 'Outcome', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.outcome === 'YES' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>{selectedOrder.outcome}</span>
                )},
                { label: 'Size', value: <span className="font-mono">{selectedOrder.size}</span> },
                { label: 'Price', value: <span className="font-mono">{selectedOrder.price}</span> },
                { label: 'Fill Price', value: <span className="font-mono">{selectedOrder.fillPrice ?? '\u2014'}</span> },
                { label: 'Filled', value: <span className="font-mono">{fillRatio(selectedOrder)}</span> },
                { label: 'Type', value: selectedOrder.orderType },
                { label: 'Status', value: (() => {
                  const ss = STATUS_STYLES[selectedOrder.status] ?? STATUS_STYLES.PENDING;
                  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>{selectedOrder.status}</span>;
                })() },
                { label: 'Created', value: <span className="font-mono text-xs">{formatDate(selectedOrder.placedAt ?? selectedOrder.createdAt)}</span> },
              ] as { label: string; value: React.ReactNode }[]).map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-pf-border-subtle last:border-0">
                  <span className="text-sm text-pf-text-muted">{row.label}</span>
                  <span className="text-sm text-pf-text">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
