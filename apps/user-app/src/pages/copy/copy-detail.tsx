import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Pause,
  Play,
  Square,
  Pencil,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Input } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

type CopyStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';
type CopyMode = 'PERCENTAGE' | 'FIXED' | 'MIRROR';
type TradeStatus = 'FILLED' | 'PARTIAL' | 'FAILED' | 'PENDING';

interface CopyConfig {
  id: string;
  targetWallet: string;
  mode: CopyMode;
  status: CopyStatus;
  sizeValue: number;
  maxExposure: number;
  maxDailyLoss: number;
  priceOffset: number;
  totalPnl: number;
  totalCopiedTrades: number;
  winRate: number;
  avgSize: number;
  createdAt: string;
  updatedAt: string;
}

interface CopiedTrade {
  id: string;
  market: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  sourceSize: string;
  copiedSize: string;
  price: string;
  pnl: number;
  status: TradeStatus;
  timestamp: string;
}

interface TradesResponse {
  data: CopiedTrade[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<CopyStatus, { dot: string; bg: string; text: string }> = {
  ACTIVE:  { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
  PAUSED:  { dot: 'bg-pf-warning',  bg: 'bg-pf-warning/10',  text: 'text-pf-warning' },
  STOPPED: { dot: 'bg-pf-text-muted',   bg: 'bg-pf-text-muted/10',   text: 'text-pf-text-muted' },
};

const MODE_STYLES: Record<CopyMode, { bg: string; text: string }> = {
  PERCENTAGE: { bg: 'bg-pf-cyan-500/10', text: 'text-pf-cyan-400' },
  FIXED:      { bg: 'bg-pf-purple-500/10',  text: 'text-pf-purple-500' },
  MIRROR:     { bg: 'bg-pf-success/10', text: 'text-pf-success' },
};

const TRADE_STATUS_STYLES: Record<TradeStatus, string> = {
  FILLED:  'bg-pf-success/15 text-pf-success',
  PARTIAL: 'bg-pf-warning/15 text-pf-warning',
  FAILED:  'bg-pf-danger/15 text-pf-danger',
  PENDING: 'bg-pf-text-muted/15 text-pf-text-muted',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Address copied'),
    () => toast.error('Failed to copy'),
  );
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <div className="h-4 bg-pf-overlay rounded w-20 animate-pulse" />
      <div className="h-6 bg-pf-overlay rounded w-[300px] animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-2 animate-shimmer">
            <div className="h-3 bg-pf-overlay rounded w-[60%]" />
            <div className="h-5 bg-pf-overlay rounded w-[80%]" />
          </div>
        ))}
      </div>
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-shimmer">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-3 bg-pf-overlay rounded w-full mb-3" />
        ))}
      </div>
    </div>
  );
}

/* ─── Edit Dialog ────────────────────────────────────────────────────── */

function EditDialog({
  config,
  onClose,
  onSave,
}: {
  config: CopyConfig;
  onClose: () => void;
  onSave: (updated: CopyConfig) => void;
}) {
  const [sizeValue, setSizeValue] = useState(config.sizeValue);
  const [maxExposure, setMaxExposure] = useState(config.maxExposure);
  const [maxDailyLoss, setMaxDailyLoss] = useState(config.maxDailyLoss);
  const [priceOffset, setPriceOffset] = useState(config.priceOffset);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/copy/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sizeValue, maxExposure, maxDailyLoss, priceOffset }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSave(updated);
        toast.success('Config updated');
      } else {
        toast.error('Failed to update config');
      }
    } catch {
      toast.error('Failed to update config');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-config-title" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 w-full max-w-md space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 id="edit-config-title" className="text-sm font-medium text-pf-text">Edit Config</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close edit config" className="text-pf-text-muted hover:text-pf-text transition-colors">
            <X className="size-4" />
          </Button>
        </div>

        {config.mode !== 'MIRROR' && (
          <div className="space-y-2">
            <label htmlFor="edit-size-value" className="text-xs text-pf-text-secondary">
              {config.mode === 'PERCENTAGE' ? 'Size (%)' : 'Fixed Amount ($)'}
            </label>
            <Input
              id="edit-size-value"
              type="number"
              min={0}
              value={sizeValue}
              onChange={(e) => setSizeValue(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="edit-max-exposure" className="text-xs text-pf-text-secondary">Max Exposure ($)</label>
          <Input
            id="edit-max-exposure"
            type="number"
            min={0}
            value={maxExposure}
            onChange={(e) => setMaxExposure(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-max-daily-loss" className="text-xs text-pf-text-secondary">Max Daily Loss ($)</label>
          <Input
            id="edit-max-daily-loss"
            type="number"
            min={0}
            value={maxDailyLoss}
            onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-price-offset" className="text-xs text-pf-text-secondary">Price Offset (%)</label>
          <Input
            id="edit-price-offset"
            type="number"
            min={-5}
            max={5}
            step={0.1}
            value={priceOffset}
            onChange={(e) => setPriceOffset(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-4 py-2 rounded-pf-sm text-sm text-pf-text-secondary hover:text-pf-text border border-pf-border hover:border-pf-border-strong transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-pf-sm text-sm bg-pf-cyan-500 text-pf-text-contrast font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
          >
            <Check className="size-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams<{ id: string }>();

  const [config, setConfig] = useState<CopyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Trades
  const [trades, setTrades] = useState<CopiedTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradePage, setTradePage] = useState(1);
  const [tradeTotalPages, setTradeTotalPages] = useState(0);

  const loadConfig = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await fetch(`/api/v1/copy/${id}`, { credentials: 'include' });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!res.ok) { setError(true); setLoading(false); return; }
      const data: CopyConfig = await res.json();
      setConfig(data);
    } catch {
      toast.error('Failed to load copy config');
      setError(true);
    }
    setLoading(false);
  }, [id]);

  const loadTrades = useCallback(async (p: number) => {
    if (!id) return;
    setTradesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      const res = await fetch(`/api/v1/copy/${id}/trades?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: TradesResponse = await res.json();
        setTrades(data.data);
        setTradeTotalPages(data.totalPages);
      }
    } catch {
      toast.error('Failed to load trades');
    }
    setTradesLoading(false);
  }, [id]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadTrades(tradePage); }, [tradePage, loadTrades]);

  async function doAction(action: 'pause' | 'resume' | 'stop') {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/copy/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setConfig((prev) => prev ? { ...prev, status: data.status } : prev);
        toast.success(`Config ${action}d`);
      } else {
        toast.error(`Failed to ${action} config`);
      }
    } catch {
      toast.error(`Failed to ${action} config`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (notFound) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/copy" className="flex items-center gap-2 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to Copy Trading
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Copy className="size-10 text-pf-text-muted mb-4" />
          <p className="text-pf-text font-medium">Config not found</p>
          <p className="text-sm text-pf-text-muted mt-1">This copy config does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/copy" className="flex items-center gap-2 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to Copy Trading
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="size-10 text-pf-danger mb-4" />
          <p className="text-pf-text font-medium">Something went wrong</p>
          <p className="text-sm text-pf-text-muted mt-1">Failed to load copy config. Please try again.</p>
          <Button type="button" onClick={loadConfig} className="mt-4 px-4 py-2 rounded-pf-sm text-sm bg-pf-elevated border border-pf-border text-pf-text hover:border-pf-border-strong transition-colors">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[config.status];
  const modeStyle = MODE_STYLES[config.mode];

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/copy" className="flex items-center gap-2 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors">
        <ArrowLeft className="size-4" /> Back to Copy Trading
      </Link>

      {/* Config header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-pf-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center">
            <Copy className="size-5 text-pf-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-pf-text">{truncateAddress(config.targetWallet)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => copyToClipboard(config.targetWallet)}
                className="text-pf-text-muted hover:text-pf-text transition-colors shrink-0"
                title="Copy address"
                aria-label="Copy wallet address"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-pf-full text-pf-label font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                <span className={`w-3 h-3 rounded-pf-full ${statusStyle.dot} ${config.status === 'ACTIVE' ? 'animate-pulse-dot' : ''}`} />
                {config.status}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-pf-full text-pf-label font-medium ${modeStyle.bg} ${modeStyle.text}`}>
                {config.mode}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text transition-colors"
          >
            <Pencil className="size-4" /> Edit
          </Button>
          {config.status === 'ACTIVE' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => doAction('pause')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-warning/30 text-pf-warning hover:bg-pf-warning/10 disabled:opacity-40 transition-colors"
            >
              <Pause className="size-4" /> Pause
            </Button>
          )}
          {config.status === 'PAUSED' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => doAction('resume')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors"
            >
              <Play className="size-4" /> Resume
            </Button>
          )}
          {config.status !== 'STOPPED' && (
            <Button
              type="button"
              variant="danger"
              onClick={() => doAction('stop')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-danger/30 text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors"
            >
              <Square className="size-4" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Total P&L</div>
          <div className={`text-lg font-mono font-semibold ${config.totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
            {formatPnl(config.totalPnl)}
          </div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Total Trades</div>
          <div className="text-lg font-mono font-semibold text-pf-text">{config.totalCopiedTrades}</div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Win Rate</div>
          <div className="text-lg font-mono font-semibold text-pf-text">{config.winRate}%</div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Avg Size</div>
          <div className="text-lg font-mono font-semibold text-pf-text">${config.avgSize.toFixed(2)}</div>
        </div>
      </div>

      {/* Risk settings */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
        <div className="text-xs text-pf-text-secondary mb-3 uppercase tracking-wider font-medium">Risk Settings</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-pf-text-muted">Max Exposure</span>
            <p className="font-mono text-sm text-pf-text">${config.maxExposure.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs text-pf-text-muted">Max Daily Loss</span>
            <p className="font-mono text-sm text-pf-text">${config.maxDailyLoss.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs text-pf-text-muted">Price Offset</span>
            <p className="font-mono text-sm text-pf-text">{config.priceOffset > 0 ? '+' : ''}{config.priceOffset}%</p>
          </div>
        </div>
      </div>

      {/* Trade history table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-pf-border">
          <h2 className="text-sm font-medium text-pf-text">Trade History</h2>
        </div>
        {tradesLoading && trades.length === 0 ? (
          <div className="p-4 space-y-3 animate-shimmer">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-3 bg-pf-overlay rounded w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Trade history">
              <thead>
                <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3 font-medium">Market</th>
                  <th scope="col" className="px-4 py-3 font-medium">Side</th>
                  <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Source Size</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Copied Size</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Price</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">P&L</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border-subtle">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-sm text-pf-text-muted">No copied trades yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-pf-surface/50 transition-colors">
                      <td className="px-4 py-3 text-pf-text max-w-[180px] truncate">{trade.market}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-pf-label font-semibold ${
                          trade.side === 'BUY' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-pf-label font-semibold ${
                          trade.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                        }`}>
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{trade.sourceSize}</td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{trade.copiedSize}</td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{trade.price}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-medium ${trade.pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                          {formatPnl(trade.pnl)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-pf-label font-semibold ${TRADE_STATUS_STYLES[trade.status]}`}>
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary text-xs">{formatDateTime(trade.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade pagination */}
      {tradeTotalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTradePage((p) => Math.max(1, p - 1))}
            disabled={tradePage === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">
            Page {tradePage} of {tradeTotalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTradePage((p) => Math.min(tradeTotalPages, p + 1))}
            disabled={tradePage === tradeTotalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      {showEdit && (
        <EditDialog
          config={config}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            setConfig(updated);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
