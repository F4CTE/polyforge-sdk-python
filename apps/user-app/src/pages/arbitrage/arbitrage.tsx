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
  if (n >= 5) return 'text-gain';
  if (n >= 2) return 'text-warning';
  return 'text-tertiary';
}

function marginBg(pct: string): string {
  const n = parseFloat(pct);
  if (n >= 5) return 'bg-gain/10 border-gain/20';
  if (n >= 2) return 'bg-warning/10 border-warning/20';
  return 'bg-surface border-default';
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
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <TrendingDown className="size-6 text-gain" />
            Merge Arbitrage Scanner
          </h1>
          <p className="text-sm text-secondary mt-1">
            Markets where YES + NO prices sum to less than $1.00 — buy both tokens and lock in
            risk-free profit on resolution.
          </p>
        </div>
        <Button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-sm text-secondary hover:text-primary hover:border-strong transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 p-4 rounded-pf-lg bg-surface border border-default">
        <Info className="size-4 text-accent-text shrink-0 mt-1" />
        <p className="text-xs text-secondary leading-relaxed">
          <span className="text-primary font-medium">How merge arbitrage works: </span>
          In a binary market, YES + NO = $1.00 at resolution. If the live prices sum to less than $1.00,
          you can buy both tokens at a discount and receive $1.00 back regardless of the outcome.
          Profit = <span className="font-mono text-gain">$1.00 − (YES price + NO price)</span> per share,
          minus CLOB trading fees (~0.5–1%).
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-secondary whitespace-nowrap">Min margin:</span>
        {[0.5, 1, 2, 5].map(v => (
          <Button
            key={v}
            type="button"
            variant="ghost"
            onClick={() => setMinMargin(v)}
            className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors ${
              minMargin === v
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
            }`}
          >
            {v}%+
          </Button>
        ))}
        <span className="ml-auto text-xs text-tertiary">
          {loading ? 'Scanning…' : `${opportunities.length} opportunit${opportunities.length !== 1 ? 'ies' : 'y'} found`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-elevated border border-default rounded-pf-lg animate-pulse" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="size-10 text-tertiary mb-3" />
          <p className="text-secondary text-sm">No arbitrage opportunities at the {minMargin}%+ threshold right now.</p>
          <p className="text-tertiary text-xs mt-1">Markets are efficiently priced. Lower the threshold or check back shortly.</p>
        </div>
      ) : (
        <div className="bg-elevated border border-default rounded-pf-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-default bg-surface">
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider">Market</span>
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider text-right">YES</span>
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider text-right">NO</span>
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider text-right">Sum</span>
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider text-right">Margin</span>
            <span className="text-pf-caption font-medium text-tertiary uppercase tracking-wider text-right">Action</span>
          </div>

          {opportunities.map((opp) => (
            <div
              key={opp.marketId}
              className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-default/50 last:border-b-0 hover:bg-surface/50 transition-colors"
            >
              {/* Market */}
              <div className="min-w-0">
                <Link
                  to={`/markets/${opp.marketId}`}
                  className="text-sm text-primary hover:text-accent-text transition-colors line-clamp-1"
                >
                  {opp.marketTitle}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {opp.category && (
                    <span className="text-pf-caption text-tertiary">{opp.category}</span>
                  )}
                  {opp.endDate && (
                    <span className="text-pf-caption text-tertiary">· Closes {formatDate(opp.endDate)}</span>
                  )}
                </div>
              </div>

              {/* YES */}
              <span className="font-mono text-sm text-primary text-right">${opp.yesPrice}</span>

              {/* NO */}
              <span className="font-mono text-sm text-primary text-right">${opp.noPrice}</span>

              {/* Sum */}
              <span className="font-mono text-sm text-tertiary text-right">${opp.sum}</span>

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
                className="flex items-center gap-2 px-3 py-2 rounded-pf bg-gain text-inverse text-xs font-medium hover:bg-gain/80 disabled:opacity-50 transition-colors whitespace-nowrap"
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

      <p className="text-pf-caption text-tertiary text-center">
        Prices from live Redis cache (10 s TTL). Always verify on-chain before executing large positions.
        Arbitrage profit is not guaranteed if prices move between quote and fill.
      </p>
    </div>
  );
}
