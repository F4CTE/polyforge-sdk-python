import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  TrendingDown, RefreshCw, Loader2, ArrowRight, AlertTriangle, Info,
} from 'lucide-react';
import { Button } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Opportunity {
  marketId: string;
  marketTitle: string;
  category: string;
  endDate: string | null;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: string;
  noPrice: string;
  sum: string;
  marginPct: string;
  costPerUnit: string;
  profitPerUnit: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function marginColor(pct: string): string {
  const n = parseFloat(pct);
  if (n >= 5) return 'text-pf-success';
  if (n >= 2) return 'text-pf-warning';
  return 'text-pf-text-muted';
}

function marginBg(pct: string): string {
  const n = parseFloat(pct);
  if (n >= 5) return 'bg-pf-success/10 border-pf-success/20';
  if (n >= 2) return 'bg-pf-warning/10 border-pf-warning/20';
  return 'bg-pf-surface border-pf-border';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [minMargin, setMinMargin] = useState(0.5);
  const [executing, setExecuting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/arbitrage?minMargin=${minMargin}`, { credentials: 'include' });
      if (res.ok) {
        setOpportunities(await res.json());
      } else {
        toast.error('Failed to load arbitrage opportunities');
      }
    } catch {
      toast.error('Failed to load arbitrage opportunities');
    }
    setLoading(false);
  }, [minMargin]);

  useEffect(() => { load(); }, [load]);

  async function executeArbitrage(opp: Opportunity) {
    setExecuting(opp.marketId);
    try {
      // Place YES buy
      const [yesRes, noRes] = await Promise.all([
        fetch('/api/v1/orders/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tokenId: opp.yesTokenId,
            side: 'BUY',
            outcome: 'YES',
            size: 10,
            price: parseFloat(opp.yesPrice),
            orderType: 'GTC',
          }),
        }),
        fetch('/api/v1/orders/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tokenId: opp.noTokenId,
            side: 'BUY',
            outcome: 'NO',
            size: 10,
            price: parseFloat(opp.noPrice),
            orderType: 'GTC',
          }),
        }),
      ]);
      if (yesRes.ok && noRes.ok) {
        toast.success(`Arbitrage orders placed — buying YES + NO on "${opp.marketTitle.slice(0, 40)}…"`);
        load();
      } else {
        toast.error('One or both orders failed — check your wallet connection');
      }
    } catch {
      toast.error('Failed to place arbitrage orders');
    }
    setExecuting(null);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-pf-text flex items-center gap-2">
            <TrendingDown className="size-6 text-pf-success" />
            Merge Arbitrage Scanner
          </h1>
          <p className="text-sm text-pf-text-secondary mt-1">
            Markets where YES + NO prices sum to less than $1.00 — buy both tokens and lock in
            risk-free profit on resolution.
          </p>
        </div>
        <Button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 p-4 rounded-pf-lg bg-pf-surface border border-pf-border">
        <Info className="size-4 text-pf-cyan-400 shrink-0 mt-0.5" />
        <p className="text-xs text-pf-text-secondary leading-relaxed">
          <span className="text-pf-text font-medium">How merge arbitrage works: </span>
          In a binary market, YES + NO = $1.00 at resolution. If the live prices sum to less than $1.00,
          you can buy both tokens at a discount and receive $1.00 back regardless of the outcome.
          Profit = <span className="font-mono text-pf-success">$1.00 − (YES price + NO price)</span> per share,
          minus CLOB trading fees (~0.5–1%).
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-pf-text-secondary whitespace-nowrap">Min margin:</span>
        {[0.5, 1, 2, 5].map(v => (
          <Button
            key={v}
            type="button"
            variant="ghost"
            onClick={() => setMinMargin(v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              minMargin === v
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {v}%+
          </Button>
        ))}
        <span className="ml-auto text-xs text-pf-text-muted">
          {loading ? 'Scanning…' : `${opportunities.length} opportunit${opportunities.length !== 1 ? 'ies' : 'y'} found`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-pf-elevated border border-pf-border rounded-pf-lg animate-pulse" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="size-10 text-pf-text-muted mb-3" />
          <p className="text-pf-text-secondary text-sm">No arbitrage opportunities at the {minMargin}%+ threshold right now.</p>
          <p className="text-pf-text-muted text-xs mt-1">Markets are efficiently priced. Lower the threshold or check back shortly.</p>
        </div>
      ) : (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-pf-border bg-pf-surface">
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider">Market</span>
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider text-right">YES</span>
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider text-right">NO</span>
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider text-right">Sum</span>
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider text-right">Margin</span>
            <span className="text-[10px] font-medium text-pf-text-muted uppercase tracking-wider text-right">Action</span>
          </div>

          {opportunities.map((opp) => (
            <div
              key={opp.marketId}
              className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-pf-border/50 last:border-b-0 hover:bg-pf-surface/50 transition-colors"
            >
              {/* Market */}
              <div className="min-w-0">
                <Link
                  to={`/markets/${opp.marketId}`}
                  className="text-sm text-pf-text hover:text-pf-cyan-400 transition-colors line-clamp-1"
                >
                  {opp.marketTitle}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  {opp.category && (
                    <span className="text-[10px] text-pf-text-muted">{opp.category}</span>
                  )}
                  {opp.endDate && (
                    <span className="text-[10px] text-pf-text-muted">· Closes {formatDate(opp.endDate)}</span>
                  )}
                </div>
              </div>

              {/* YES */}
              <span className="font-mono text-sm text-pf-text text-right">${opp.yesPrice}</span>

              {/* NO */}
              <span className="font-mono text-sm text-pf-text text-right">${opp.noPrice}</span>

              {/* Sum */}
              <span className="font-mono text-sm text-pf-text-muted text-right">${opp.sum}</span>

              {/* Margin */}
              <span className={`font-mono text-sm font-semibold text-right ${marginColor(opp.marginPct)}`}>
                +{opp.marginPct}%
              </span>

              {/* Execute */}
              <Button
                type="button"
                variant="success"
                onClick={() => executeArbitrage(opp)}
                disabled={executing === opp.marketId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-success text-black text-xs font-medium hover:bg-pf-success/80 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {executing === opp.marketId
                  ? <Loader2 className="size-3 animate-spin" />
                  : <ArrowRight className="size-3" />
                }
                Execute
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-pf-text-muted text-center">
        Prices from live Redis cache (10 s TTL). Always verify on-chain before executing large positions.
        Arbitrage profit is not guaranteed if prices move between quote and fill.
      </p>
    </div>
  );
}
