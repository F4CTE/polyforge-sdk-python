import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  Layers, Loader2, RefreshCw, X, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, AlertTriangle, Plus,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type SmartOrderType = 'TWAP' | 'DCA' | 'BRACKET' | 'OCO';
type SmartOrderStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

interface ChildOrder {
  id: string;
  status: string;
  fillSize: string | null;
  fillPrice: string | null;
  createdAt: string;
}

interface SmartOrder {
  id: string;
  type: SmartOrderType;
  status: SmartOrderStatus;
  marketId: string;
  tokenId: string;
  outcome: string;
  side: string;
  totalSize: string;
  config: Record<string, unknown>;
  slicesFilled: number;
  slicesTotal: number;
  nextExecuteAt: string | null;
  completedAt: string | null;
  createdAt: string;
  orders: ChildOrder[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const TYPE_LABEL: Record<SmartOrderType, string> = {
  TWAP: 'TWAP',
  DCA: 'DCA',
  BRACKET: 'Bracket',
  OCO: 'OCO',
};

const TYPE_DESC: Record<SmartOrderType, string> = {
  TWAP: 'Time-weighted average price — splits order into equal slices over time',
  DCA: 'Dollar-cost average — recurring buys at fixed intervals',
  BRACKET: 'Entry + take-profit + stop-loss linked order bundle',
  OCO: 'One-cancels-other — two legs, first fill cancels the other',
};

function StatusBadge({ status }: { status: SmartOrderStatus }) {
  const map: Record<SmartOrderStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    PENDING: { cls: 'text-pf-text-muted bg-pf-surface border-pf-border', icon: <Clock className="size-3" />, label: 'Pending' },
    ACTIVE: { cls: 'text-pf-cyan-400 bg-pf-cyan-500/10 border-pf-cyan-500/20', icon: <Loader2 className="size-3 animate-spin" />, label: 'Active' },
    COMPLETED: { cls: 'text-pf-success bg-pf-success/10 border-pf-success/20', icon: <CheckCircle className="size-3" />, label: 'Completed' },
    CANCELLED: { cls: 'text-pf-text-muted bg-pf-surface border-pf-border', icon: <XCircle className="size-3" />, label: 'Cancelled' },
    FAILED: { cls: 'text-pf-danger bg-pf-danger/10 border-pf-danger/20', icon: <AlertTriangle className="size-3" />, label: 'Failed' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {icon}{label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [orders, setOrders] = useState<SmartOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/orders/smart', { credentials: 'include' });
      if (res.ok) setOrders(await res.json());
      else toast.error('Failed to load smart orders');
    } catch {
      toast.error('Failed to load smart orders');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancel(id: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/v1/orders/smart/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Smart order cancelled');
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to cancel');
      }
    } catch {
      toast.error('Failed to cancel');
    }
    setCancelling(null);
  }

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-pf-text flex items-center gap-2">
            <Layers className="size-6 text-pf-cyan-400" />
            Smart Orders
          </h1>
          <p className="text-sm text-pf-text-secondary mt-1">
            TWAP, DCA, Bracket, and OCO orders — advanced execution strategies.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Order types info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(TYPE_DESC) as SmartOrderType[]).map((t) => (
          <div key={t} className="p-3 bg-pf-surface border border-pf-border rounded-pf-lg">
            <p className="text-xs font-semibold text-pf-text mb-1">{TYPE_LABEL[t]}</p>
            <p className="text-[11px] text-pf-text-muted leading-relaxed">{TYPE_DESC[t]}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-pf-elevated border border-pf-border rounded-pf-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="size-10 text-pf-text-muted mb-3" />
          <p className="text-pf-text-secondary text-sm">No smart orders yet.</p>
          <p className="text-pf-text-muted text-xs mt-1">
            Place a smart order via the{' '}
            <Link to="/markets" className="text-pf-cyan-400 hover:underline">market detail page</Link>{' '}
            or API.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((so) => (
            <div key={so.id} className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === so.id ? null : so.id)}
                  className="shrink-0 text-pf-text-muted hover:text-pf-text"
                  aria-label="Toggle details"
                >
                  {expanded === so.id
                    ? <ChevronDown className="size-4" />
                    : <ChevronRight className="size-4" />}
                </button>

                {/* Type badge */}
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-pf-surface border border-pf-border text-pf-text-secondary">
                  {TYPE_LABEL[so.type]}
                </span>

                {/* Market / token */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-pf-text font-medium truncate">
                    {so.side} {so.outcome} · {so.tokenId.slice(0, 12)}…
                  </p>
                  <p className="text-xs text-pf-text-muted">
                    Size: {parseFloat(so.totalSize).toFixed(2)} USDC
                    {(so.type === 'TWAP' || so.type === 'DCA') && (
                      <> · Slice {so.slicesFilled}/{so.slicesTotal}</>
                    )}
                    {so.nextExecuteAt && so.status === 'ACTIVE' && (
                      <> · Next: {formatDate(so.nextExecuteAt)}</>
                    )}
                  </p>
                </div>

                <StatusBadge status={so.status} />

                <span className="text-xs text-pf-text-muted shrink-0">{formatDate(so.createdAt)}</span>

                {['PENDING', 'ACTIVE'].includes(so.status) && (
                  <button
                    type="button"
                    onClick={() => cancel(so.id)}
                    disabled={cancelling === so.id}
                    className="shrink-0 p-1.5 rounded-pf text-pf-danger hover:bg-pf-danger/10 disabled:opacity-50 transition-colors"
                    aria-label="Cancel"
                    title="Cancel smart order"
                  >
                    {cancelling === so.id
                      ? <Loader2 className="size-4 animate-spin" />
                      : <X className="size-4" />}
                  </button>
                )}
              </div>

              {/* Expanded: child orders */}
              {expanded === so.id && so.orders.length > 0 && (
                <div className="border-t border-pf-border/50 px-4 py-3 bg-pf-surface/50">
                  <p className="text-[11px] font-medium text-pf-text-muted uppercase tracking-wider mb-2">
                    Child Orders ({so.orders.length})
                  </p>
                  <div className="space-y-1">
                    {so.orders.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-4 text-xs text-pf-text-secondary"
                      >
                        <span className="font-mono text-pf-text-muted truncate w-24">{child.id.slice(0, 10)}…</span>
                        <span className={`font-medium ${
                          child.status === 'MATCHED' || child.status === 'CONFIRMED' ? 'text-pf-success' :
                          child.status === 'CANCELLED' ? 'text-pf-text-muted' :
                          child.status === 'FAILED' ? 'text-pf-danger' : 'text-pf-text-secondary'
                        }`}>{child.status}</span>
                        {child.fillSize && <span>Filled: {child.fillSize} @ {child.fillPrice}</span>}
                        <span className="ml-auto text-pf-text-muted">{formatDate(child.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
