import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  Layers, Loader2, RefreshCw, X, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, AlertTriangle, Plus,
} from 'lucide-react';
import { Button, StatusBadge } from '@polyforge/ui';

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

const SMART_ORDER_STATUS: Record<SmartOrderStatus, { variant: 'secondary' | 'default' | 'success' | 'danger'; icon: React.ReactNode; label: string }> = {
  PENDING: { variant: 'secondary', icon: <Clock className="size-3" />, label: 'Pending' },
  ACTIVE: { variant: 'default', icon: <Loader2 className="size-3 animate-spin" />, label: 'Active' },
  COMPLETED: { variant: 'success', icon: <CheckCircle className="size-3" />, label: 'Completed' },
  CANCELLED: { variant: 'secondary', icon: <XCircle className="size-3" />, label: 'Cancelled' },
  FAILED: { variant: 'danger', icon: <AlertTriangle className="size-3" />, label: 'Failed' },
};

function SmartOrderStatusBadge({ status }: { status: SmartOrderStatus }) {
  const { variant, icon, label } = SMART_ORDER_STATUS[status];
  return <StatusBadge variant={variant} icon={icon} label={label} />;
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
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <Layers className="size-6 text-accent-text" />
            Smart Orders
          </h1>
          <p className="text-body-sm text-secondary mt-1">
            TWAP, DCA, Bracket, and OCO orders — advanced execution strategies.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-body-sm text-secondary hover:text-primary hover:border-strong transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Order types info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(TYPE_DESC) as SmartOrderType[]).map((t) => (
          <div key={t} className="p-3 bg-surface border border-default rounded-xl">
            <p className="text-label font-semibold text-primary mb-1">{TYPE_LABEL[t]}</p>
            <p className="text-label text-tertiary leading-relaxed">{TYPE_DESC[t]}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-elevated border border-default rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="size-10 text-tertiary mb-3" />
          <p className="text-secondary text-body-sm">No smart orders yet.</p>
          <p className="text-tertiary text-label mt-1">
            Place a smart order via the{' '}
            <Link to="/markets" className="text-accent-text hover:underline">market detail page</Link>{' '}
            or API.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((so) => (
            <div key={so.id} className="bg-elevated border border-default rounded-xl overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setExpanded(expanded === so.id ? null : so.id)}
                  className="shrink-0 text-tertiary hover:text-primary"
                  aria-label="Toggle details"
                >
                  {expanded === so.id
                    ? <ChevronDown className="size-4" />
                    : <ChevronRight className="size-4" />}
                </Button>

                {/* Type badge */}
                <span className="shrink-0 px-2 py-1 rounded text-label font-semibold bg-surface border border-default text-secondary">
                  {TYPE_LABEL[so.type]}
                </span>

                {/* Market / token */}
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-primary font-medium truncate">
                    {so.side} {so.outcome} · {so.tokenId.slice(0, 12)}…
                  </p>
                  <p className="text-label text-tertiary">
                    Size: {parseFloat(so.totalSize).toFixed(2)} USDC
                    {(so.type === 'TWAP' || so.type === 'DCA') && (
                      <> · Slice {so.slicesFilled}/{so.slicesTotal}</>
                    )}
                    {so.nextExecuteAt && so.status === 'ACTIVE' && (
                      <> · Next: {formatDate(so.nextExecuteAt)}</>
                    )}
                  </p>
                </div>

                <SmartOrderStatusBadge status={so.status} />

                <span className="text-caption text-tertiary shrink-0">{formatDate(so.createdAt)}</span>

                {['PENDING', 'ACTIVE'].includes(so.status) && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => cancel(so.id)}
                    disabled={cancelling === so.id}
                    className="shrink-0 p-2 rounded-pf text-loss hover:bg-loss/10 disabled:opacity-50 transition-colors"
                    aria-label="Cancel"
                    title="Cancel smart order"
                  >
                    {cancelling === so.id
                      ? <Loader2 className="size-4 animate-spin" />
                      : <X className="size-4" />}
                  </Button>
                )}
              </div>

              {/* Expanded: child orders */}
              {expanded === so.id && so.orders.length > 0 && (
                <div className="border-t border-default/50 px-4 py-3 bg-surface/50">
                  <p className="text-label font-medium text-tertiary uppercase tracking-wider mb-2">
                    Child Orders ({so.orders.length})
                  </p>
                  <div className="space-y-1">
                    {so.orders.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-4 text-label text-secondary"
                      >
                        <span className="font-mono text-tertiary truncate w-24">{child.id.slice(0, 10)}…</span>
                        <span className={`font-medium ${
                          child.status === 'MATCHED' || child.status === 'CONFIRMED' ? 'text-gain' :
                          child.status === 'CANCELLED' ? 'text-tertiary' :
                          child.status === 'FAILED' ? 'text-loss' : 'text-secondary'
                        }`}>{child.status}</span>
                        {child.fillSize && <span>Filled: {child.fillSize} @ {child.fillPrice}</span>}
                        <span className="ml-auto text-tertiary">{formatDate(child.createdAt)}</span>
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
