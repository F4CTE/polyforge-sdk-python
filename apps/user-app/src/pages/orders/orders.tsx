import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, ClipboardList, X, Plus, Trash2,
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
  marketQuestion?: string;
  marketId?: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ConditionalOrderType = 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED';
type ConditionalOrderStatus = 'PENDING' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

interface ConditionalOrder {
  id: string;
  marketId: string;
  tokenId: string;
  type: ConditionalOrderType;
  side: string;
  outcome: string;
  size: string;
  triggerPrice: string;
  limitPrice: string | null;
  trailingPct: string | null;
  status: ConditionalOrderStatus;
  expiresAt: string | null;
  createdAt: string;
}

interface ConditionalOrdersResponse {
  data: ConditionalOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ViewTab = 'orders' | 'conditional';

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
  PENDING:   { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  SUBMITTED: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
  LIVE:      { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
  MATCHED:   { text: 'text-pf-cyan-300', bg: 'bg-pf-cyan-500/8' },
  CONFIRMED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
  CANCELLED: { text: 'text-pf-text-secondary', bg: 'bg-pf-overlay' },
  FAILED:    { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};

const CONDITIONAL_TYPE_STYLES: Record<ConditionalOrderType, { text: string; bg: string; label: string }> = {
  TAKE_PROFIT:   { text: 'text-pf-success', bg: 'bg-pf-success/10', label: 'TP' },
  STOP_LOSS:     { text: 'text-pf-danger', bg: 'bg-pf-danger/10', label: 'SL' },
  TRAILING_STOP: { text: 'text-pf-warning', bg: 'bg-pf-warning/10', label: 'TRAILING' },
  LIMIT:         { text: 'text-pf-info', bg: 'bg-pf-info/10', label: 'LIMIT' },
  PEGGED:        { text: 'text-pf-purple-500', bg: 'bg-pf-purple-500/10', label: 'PEGGED' },
};

const CONDITIONAL_STATUS_STYLES: Record<ConditionalOrderStatus, { text: string; bg: string }> = {
  PENDING:   { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  TRIGGERED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
  CANCELLED: { text: 'text-pf-text-secondary', bg: 'bg-pf-overlay' },
  EXPIRED:   { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
  FAILED:    { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};

function fillRatio(order: Order): string {
  const total = parseFloat(order.size);
  if (!total) return '\u2014';
  return `${order.fillSize ?? '0'} / ${order.size}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/* ─── Create Conditional Order Dialog ────────────────────────────────── */

function CreateConditionalDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    marketId: '',
    tokenId: '',
    type: 'TAKE_PROFIT' as ConditionalOrderType,
    side: 'BUY',
    outcome: 'YES',
    size: '',
    triggerPrice: '',
    limitPrice: '',
    trailingPct: '',
    expiresAt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [positions, setPositions] = useState<Array<{ id: string; marketId: string; tokenId: string; marketTitle: string; outcome: string; size: string }>>([]);

  useEffect(() => {
    fetch('/api/v1/portfolio', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.positions) setPositions(data.positions); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        marketId: form.marketId,
        tokenId: form.tokenId,
        type: form.type,
        side: form.side,
        outcome: form.outcome,
        size: form.size,
        triggerPrice: form.triggerPrice,
      };
      if (form.limitPrice) body.limitPrice = form.limitPrice;
      if (form.trailingPct) body.trailingPct = form.trailingPct;
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();

      const res = await fetch('/api/v1/orders/conditional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Conditional order created');
        onCreated();
        onClose();
      } else {
        toast.error('Failed to create conditional order');
      }
    } catch {
      toast.error('Failed to create conditional order');
    }
    setSubmitting(false);
  }

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create Conditional Order">
      <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-lg p-6 shadow-pf-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-pf-text">Create Conditional Order</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-1 rounded text-pf-text-muted hover:text-pf-text cursor-pointer transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="cond-market-select" className="block text-xs font-medium text-pf-text-secondary mb-1">Market</label>
              <select id="cond-market-select" value={form.marketId} onChange={e => {
                const mkt = positions.find(p => p.marketId === e.target.value);
                updateField('marketId', e.target.value);
                if (mkt) updateField('tokenId', mkt.tokenId);
              }} required className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="">Select from your positions...</option>
                {positions.map(p => (
                  <option key={p.id} value={p.marketId}>
                    {p.marketTitle || p.marketId.slice(0, 12)} — {p.outcome} ({p.size})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cond-token-id" className="block text-xs font-medium text-pf-text-secondary mb-1">Token</label>
              <input id="cond-token-id" value={form.tokenId} readOnly
                className="w-full h-9 px-3 rounded-pf bg-pf-overlay border border-pf-border text-sm text-pf-text-secondary cursor-not-allowed font-mono text-xs" />
              <p className="text-[10px] text-pf-text-muted mt-0.5">Auto-filled from selected position</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-type" className="block text-xs font-medium text-pf-text-secondary mb-1">Type</label>
              <select id="cond-type" value={form.type} onChange={e => updateField('type', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="TAKE_PROFIT">Take Profit</option>
                <option value="STOP_LOSS">Stop Loss</option>
                <option value="TRAILING_STOP">Trailing Stop</option>
                <option value="LIMIT">Limit</option>
                <option value="PEGGED">Pegged</option>
              </select>
            </div>
            <div>
              <label htmlFor="cond-side" className="block text-xs font-medium text-pf-text-secondary mb-1">Side</label>
              <select id="cond-side" value={form.side} onChange={e => updateField('side', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label htmlFor="cond-outcome" className="block text-xs font-medium text-pf-text-secondary mb-1">Outcome</label>
              <select id="cond-outcome" value={form.outcome} onChange={e => updateField('outcome', e.target.value)}
                className="w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50">
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cond-size" className="block text-xs font-medium text-pf-text-secondary mb-1">Size</label>
              <input id="cond-size" type="number" step="any" value={form.size} onChange={e => updateField('size', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-trigger-price" className="block text-xs font-medium text-pf-text-secondary mb-1">Trigger Price</label>
              <input id="cond-trigger-price" type="number" step="any" value={form.triggerPrice} onChange={e => updateField('triggerPrice', e.target.value)} required
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cond-limit-price" className="block text-xs font-medium text-pf-text-secondary mb-1">Limit Price</label>
              <input id="cond-limit-price" type="number" step="any" value={form.limitPrice} onChange={e => updateField('limitPrice', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-trailing-pct" className="block text-xs font-medium text-pf-text-secondary mb-1">Trailing %</label>
              <input id="cond-trailing-pct" type="number" step="any" value={form.trailingPct} onChange={e => updateField('trailingPct', e.target.value)} placeholder="Optional"
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
            <div>
              <label htmlFor="cond-expires-at" className="block text-xs font-medium text-pf-text-secondary mb-1">Expires At</label>
              <input id="cond-expires-at" type="datetime-local" lang="en" value={form.expiresAt} onChange={e => updateField('expiresAt', e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-pf-border-subtle">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus className="size-3.5" /> Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [viewTab, setViewTab] = useState<ViewTab>('orders');

  // ── Regular orders state ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ── Conditional orders state ──
  const [condOrders, setCondOrders] = useState<ConditionalOrder[]>([]);
  const [condLoading, setCondLoading] = useState(true);
  const [condTotal, setCondTotal] = useState(0);
  const [condTotalPages, setCondTotalPages] = useState(0);
  const [condPage, setCondPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ── Load regular orders ──
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

  // ── Load conditional orders ──
  const loadConditional = useCallback(async (p: number) => {
    setCondLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      const res = await fetch(`/api/v1/orders/conditional?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: ConditionalOrdersResponse = await res.json();
        setCondOrders(data.data);
        setCondTotal(data.total);
        setCondTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load conditional orders'); }
    setCondLoading(false);
  }, []);

  useEffect(() => {
    if (viewTab === 'orders') load(page, filter);
  }, [page, filter, load, viewTab]);

  useEffect(() => {
    if (viewTab === 'conditional') loadConditional(condPage);
  }, [condPage, loadConditional, viewTab]);

  function changeFilter(f: FilterStatus) {
    setFilter(f);
    setPage(1);
  }

  async function cancelConditional(id: string) {
    try {
      const res = await fetch(`/api/v1/orders/conditional/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Conditional order cancelled');
        loadConditional(condPage);
      } else {
        toast.error('Failed to cancel order');
      }
    } catch { toast.error('Failed to cancel order'); }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Orders</h1>
        <div className="flex items-center gap-3">
          {viewTab === 'conditional' && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium border border-pf-cyan-500/30 hover:bg-pf-cyan-500/25 transition-colors"
            >
              <Plus className="size-3" /> New Conditional
            </button>
          )}
          {!loading && viewTab === 'orders' && <span className="text-sm text-pf-text-muted">{total} orders</span>}
          {!condLoading && viewTab === 'conditional' && <span className="text-sm text-pf-text-muted">{condTotal} conditional</span>}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 border-b border-pf-border-subtle pb-2" role="tablist" aria-label="Order type">
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'orders'}
          onClick={() => setViewTab('orders')}
          className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
            viewTab === 'orders' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'
          }`}
        >
          Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'conditional'}
          onClick={() => setViewTab('conditional')}
          className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
            viewTab === 'conditional' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'
          }`}
        >
          Conditional
        </button>
      </div>

      {/* ─── Regular Orders Tab ──────────────────────────────── */}
      {viewTab === 'orders' && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map(f => (
              <button
                type="button"
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
              <table className="w-full text-sm" aria-label="Orders">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3 font-medium w-10">#</th>
                    <th scope="col" className="px-4 py-3 font-medium">Market</th>
                    <th scope="col" className="px-4 py-3 font-medium">Side</th>
                    <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Price</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Filled / Total</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Avg Fill</th>
                    <th scope="col" className="px-4 py-3 font-medium">Type</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pf-border-subtle">
                  {loading ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 11 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
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
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="text-pf-text text-xs line-clamp-1" title={order.marketQuestion ?? order.marketId ?? ''}>
                              {order.marketQuestion || (order.marketId?.slice(0, 12)) || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              order.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {order.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              order.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
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
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Conditional Orders Tab ──────────────────────────── */}
      {viewTab === 'conditional' && (
        <>
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Conditional orders">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3 font-medium">Type</th>
                    <th scope="col" className="px-4 py-3 font-medium">Market</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Trigger</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                    <th scope="col" className="px-4 py-3 font-medium">Side</th>
                    <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Expires</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Created</th>
                    <th scope="col" className="px-4 py-3 font-medium w-10"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pf-border-subtle">
                  {condLoading ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : condOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ClipboardList className="size-10 text-pf-text-muted mb-3" />
                          <p className="text-sm font-medium text-pf-text">No conditional orders</p>
                          <p className="text-xs text-pf-text-muted mt-1">Set up take profit, stop loss, or trailing stop orders.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    condOrders.map((co) => {
                      const ts = CONDITIONAL_TYPE_STYLES[co.type] ?? CONDITIONAL_TYPE_STYLES.LIMIT;
                      const cs = CONDITIONAL_STATUS_STYLES[co.status] ?? CONDITIONAL_STATUS_STYLES.PENDING;
                      return (
                        <tr key={co.id} className="hover:bg-pf-surface/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ts.bg} ${ts.text}`}>
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-pf-text-muted">{co.marketId.slice(0, 8)}...</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{co.triggerPrice}</td>
                          <td className="px-4 py-3 text-right font-mono text-pf-text">{co.size}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              co.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {co.side}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              co.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {co.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cs.bg} ${cs.text}`}>
                              {co.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-[11px] text-pf-text-muted">
                              {co.expiresAt ? formatDate(co.expiresAt) : '\u2014'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-[11px] text-pf-text-muted">{formatDate(co.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {co.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => cancelConditional(co.id)}
                                aria-label="Cancel conditional order"
                                className="p-1 rounded text-pf-text-muted hover:text-pf-danger transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conditional Pagination */}
          {condTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setCondPage(p => Math.max(1, p - 1))}
                disabled={condPage === 1}
                aria-label="Previous page"
                className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {condPage} of {condTotalPages}</span>
              <button
                type="button"
                onClick={() => setCondPage(p => Math.min(condTotalPages, p + 1))}
                disabled={condPage === condTotalPages}
                aria-label="Next page"
                className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Order detail dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" role="dialog" aria-modal="true" aria-label="Order Details">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="animate-slide-right relative w-full max-w-md h-full bg-pf-surface border-l border-pf-border overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pf-border-subtle">
              <h2 className="text-lg font-semibold text-pf-text">Order Details</h2>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details" className="text-pf-text-muted hover:text-pf-text cursor-pointer transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {([
                { label: 'Order ID', value: <span className="font-mono text-[11px]">{selectedOrder.id.slice(0, 8)}...</span> },
                { label: 'Side', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                  }`}>{selectedOrder.side}</span>
                )},
                { label: 'Outcome', value: (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    selectedOrder.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
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
                  <span className="text-sm text-pf-text-secondary">{row.label}</span>
                  <span className="text-sm text-pf-text">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create conditional order dialog */}
      {showCreateDialog && (
        <CreateConditionalDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => loadConditional(condPage)}
        />
      )}
    </div>
  );
}
