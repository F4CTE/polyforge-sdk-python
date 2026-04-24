import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  TrendingDown, RefreshCw, Loader2, ArrowRight, AlertTriangle, Info, ArrowLeftRight,
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

interface CrossVenueOpportunity {
  matchId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  polymarketYes: number;
  kalshiYes: number;
  spreadPct: number;
  direction: string;
  confidence: number;
}

type Tab = 'single' | 'cross';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function marginColor(pct: string): string {
  const n = parseFloat(pct);
  if (n >= 5) return 'text-gain';
  if (n >= 2) return 'text-warning';
  return 'text-tertiary';
}

function spreadColor(pct: number): string {
  if (pct >= 5) return 'text-gain';
  if (pct >= 2) return 'text-warning';
  return 'text-tertiary';
}

function confidenceBar(score: number): string {
  if (score >= 0.8) return 'bg-gain';
  if (score >= 0.5) return 'bg-warning';
  return 'bg-loss';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [tab, setTab] = useState<Tab>('single');

  // Single-venue state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [minMargin, setMinMargin] = useState(0.5);
  const [executing, setExecuting] = useState<string | null>(null);

  // Cross-venue state
  const [crossVenue, setCrossVenue] = useState<CrossVenueOpportunity[]>([]);
  const [crossLoading, setCrossLoading] = useState(false);
  const [minSpread, setMinSpread] = useState(3);

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

  const loadCrossVenue = useCallback(async () => {
    setCrossLoading(true);
    try {
      const res = await fetch(`/api/v1/arbitrage/cross-venue?minSpread=${minSpread}`, { credentials: 'include' });
      if (res.ok) {
        setCrossVenue(await res.json());
      } else {
        toast.error('Failed to load cross-venue opportunities');
      }
    } catch {
      toast.error('Failed to load cross-venue opportunities');
    }
    setCrossLoading(false);
  }, [minSpread]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'cross') loadCrossVenue();
  }, [tab, loadCrossVenue]);

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
            Arbitrage Scanner
          </h1>
          <p className="text-body-sm text-secondary mt-1">
            Find and execute risk-free arbitrage opportunities across markets and venues.
          </p>
        </div>
        <Button
          type="button"
          onClick={tab === 'single' ? load : loadCrossVenue}
          disabled={tab === 'single' ? loading : crossLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-body-sm text-secondary hover:text-primary hover:border-strong transition-colors disabled:opacity-50"
        >
          {(tab === 'single' ? loading : crossLoading)
            ? <Loader2 className="size-4 animate-spin" />
            : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface rounded-pf p-1 border border-subtle w-fit" role="tablist" aria-label="Arbitrage mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'single'}
          data-testid="tab-single-venue"
          onClick={() => setTab('single')}
          className={`px-4 py-2 rounded-sm text-label font-medium transition-colors ${
            tab === 'single'
              ? 'bg-elevated text-primary shadow-sm'
              : 'text-tertiary hover:text-secondary'
          }`}
        >
          Single-venue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cross'}
          data-testid="tab-cross-venue"
          onClick={() => setTab('cross')}
          className={`px-4 py-2 rounded-sm text-label font-medium transition-colors flex items-center gap-2 ${
            tab === 'cross'
              ? 'bg-elevated text-primary shadow-sm'
              : 'text-tertiary hover:text-secondary'
          }`}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          Cross-venue
        </button>
      </div>

      {/* ── Single-venue content (unchanged) ─────────────────────────── */}
      {tab === 'single' && (
        <>
          {/* How it works */}
          <div className="flex items-start gap-3 p-4 rounded-pf bg-surface border border-default">
            <Info className="size-4 text-accent-text shrink-0 mt-1" />
            <p className="text-label text-secondary leading-relaxed">
              <span className="text-primary font-medium">How merge arbitrage works: </span>
              In a binary market, YES + NO = $1.00 at resolution. If the live prices sum to less than $1.00,
              you can buy both tokens at a discount and receive $1.00 back regardless of the outcome.
              Profit = <span className="font-mono text-gain">$1.00 − (YES price + NO price)</span> per share,
              minus CLOB trading fees (~0.5–1%).
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <span className="text-label text-secondary whitespace-nowrap">Min margin:</span>
            {[0.5, 1, 2, 5].map(v => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                onClick={() => setMinMargin(v)}
                className={`px-3 py-1 rounded-full text-label font-medium border transition-colors ${
                  minMargin === v
                    ? 'bg-accent-subtle text-accent-text border-accent/30'
                    : 'bg-elevated text-secondary border-default hover:border-strong'
                }`}
              >
                {v}%+
              </Button>
            ))}
            <span className="ml-auto text-label text-tertiary">
              {loading ? 'Scanning…' : `${opportunities.length} opportunit${opportunities.length !== 1 ? 'ies' : 'y'} found`}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-elevated border border-default rounded-pf animate-pulse" />
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="size-10 text-tertiary mb-3" />
              <p className="text-secondary text-body-sm">No arbitrage opportunities at the {minMargin}%+ threshold right now.</p>
              <p className="text-tertiary text-label mt-1">Markets are efficiently priced. Lower the threshold or check back shortly.</p>
            </div>
          ) : (
            <div role="table" aria-label="Arbitrage opportunities" className="bg-elevated border border-default rounded-pf overflow-hidden">
              {/* Header row */}
              <div role="row" className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-default bg-surface">
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider">Market</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">YES</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">NO</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Sum</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Margin</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Action</span>
              </div>

              {opportunities.map((opp) => (
                <div
                  key={opp.marketId}
                  role="row"
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-default/50 last:border-b-0 hover:bg-surface/50 transition-colors"
                >
                  {/* Market */}
                  <div role="cell" className="min-w-0">
                    <Link
                      to={`/markets/${opp.marketId}`}
                      className="text-body-md text-primary hover:text-accent-text transition-colors line-clamp-1"
                    >
                      {opp.marketTitle}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {opp.category && (
                        <span className="text-caption text-tertiary">{opp.category}</span>
                      )}
                      {opp.endDate && (
                        <span className="text-caption text-tertiary">· Closes {formatDate(opp.endDate)}</span>
                      )}
                    </div>
                  </div>

                  {/* YES */}
                  <span role="cell" className="font-mono tabular-nums text-body-md text-primary text-right">${opp.yesPrice}</span>

                  {/* NO */}
                  <span role="cell" className="font-mono tabular-nums text-body-md text-primary text-right">${opp.noPrice}</span>

                  {/* Sum */}
                  <span role="cell" className="font-mono tabular-nums text-body-sm text-tertiary text-right">${opp.sum}</span>

                  {/* Margin */}
                  <span role="cell" className={`font-mono tabular-nums text-body-md font-semibold text-right ${marginColor(opp.marginPct)}`}>
                    +{opp.marginPct}%
                  </span>

                  {/* Execute */}
                  <div role="cell">
                    <Button
                      type="button"
                      variant="success"
                      onClick={() => executeArbitrage(opp)}
                      disabled={executing === opp.marketId}
                      className="flex items-center gap-2 px-3 py-2 rounded-pf bg-gain text-inverse text-label font-medium hover:bg-gain/80 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {executing === opp.marketId
                        ? <Loader2 className="size-3 animate-spin" />
                        : <ArrowRight className="size-3" />
                      }
                      Execute
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-caption text-tertiary text-center">
            Prices from live Redis cache (10 s TTL). Always verify on-chain before executing large positions.
            Arbitrage profit is not guaranteed if prices move between quote and fill.
          </p>
        </>
      )}

      {/* ── Cross-venue content ───────────────────────────────────────── */}
      {tab === 'cross' && (
        <>
          <div className="flex items-start gap-3 p-4 rounded-pf bg-surface border border-default">
            <Info className="size-4 text-accent-text shrink-0 mt-1" />
            <p className="text-label text-secondary leading-relaxed">
              <span className="text-primary font-medium">How cross-venue arbitrage works: </span>
              When the same real-world event is priced differently on Polymarket vs Kalshi, you can
              buy the underpriced side on one venue and sell (or hedge) on the other.
              Spread = difference in YES prices between venues.
            </p>
          </div>

          {/* Min spread filter */}
          <div className="flex items-center gap-4">
            <span className="text-label text-secondary whitespace-nowrap">Min spread:</span>
            {[1, 2, 3, 5].map(v => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                onClick={() => setMinSpread(v)}
                className={`px-3 py-1 rounded-full text-label font-medium border transition-colors ${
                  minSpread === v
                    ? 'bg-accent-subtle text-accent-text border-accent/30'
                    : 'bg-elevated text-secondary border-default hover:border-strong'
                }`}
              >
                {v}%+
              </Button>
            ))}
            <span className="ml-auto text-label text-tertiary">
              {crossLoading ? 'Scanning…' : `${crossVenue.length} opportunit${crossVenue.length !== 1 ? 'ies' : 'y'} found`}
            </span>
          </div>

          {/* Cross-venue table */}
          {crossLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-elevated border border-default rounded-pf animate-pulse" />
              ))}
            </div>
          ) : crossVenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ArrowLeftRight className="size-10 text-tertiary mb-3" />
              <p className="text-secondary text-body-sm">No cross-venue opportunities at the {minSpread}%+ spread right now.</p>
              <p className="text-tertiary text-label mt-1">Both venues are pricing these markets similarly. Check back later.</p>
            </div>
          ) : (
            <div role="table" aria-label="Cross-venue arbitrage opportunities" data-testid="cross-venue-table" className="bg-elevated border border-default rounded-pf overflow-hidden">
              {/* Header */}
              <div role="row" className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-default bg-surface">
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider">Markets (Poly ↔ Kalshi)</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Poly YES</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Kalshi YES</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Spread</span>
                <span role="columnheader" className="text-caption font-medium text-tertiary uppercase tracking-wider text-right">Confidence</span>
              </div>

              {crossVenue.map((opp) => (
                <div
                  key={opp.matchId}
                  role="row"
                  data-testid="cross-venue-row"
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-default/50 last:border-b-0 hover:bg-surface/50 transition-colors"
                >
                  {/* Market pair */}
                  <div role="cell" className="min-w-0 space-y-0.5">
                    <p className="text-body-sm text-primary line-clamp-1">{opp.polymarketTitle}</p>
                    <p className="text-caption text-tertiary line-clamp-1 flex items-center gap-1">
                      <ArrowLeftRight className="size-3 shrink-0" aria-hidden="true" />
                      {opp.kalshiTitle}
                    </p>
                    <span className="text-caption text-tertiary">{opp.direction}</span>
                  </div>

                  {/* Poly YES */}
                  <span role="cell" className="font-mono tabular-nums text-body-md text-primary text-right">
                    ${opp.polymarketYes.toFixed(2)}
                  </span>

                  {/* Kalshi YES */}
                  <span role="cell" className="font-mono tabular-nums text-body-md text-primary text-right">
                    ${opp.kalshiYes.toFixed(2)}
                  </span>

                  {/* Spread */}
                  <span role="cell" className={`font-mono tabular-nums text-body-md font-semibold text-right ${spreadColor(opp.spreadPct)}`}>
                    {opp.spreadPct.toFixed(1)}%
                  </span>

                  {/* Confidence bar */}
                  <div role="cell" className="flex flex-col items-end gap-1 min-w-[64px]">
                    <span className="text-caption tabular-nums text-tertiary">{Math.round(opp.confidence * 100)}%</span>
                    <div className="w-16 h-1.5 rounded-full bg-overlay overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${confidenceBar(opp.confidence)}`}
                        style={{ width: `${opp.confidence * 100}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(opp.confidence * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Match confidence"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-caption text-tertiary text-center">
            Match confidence indicates how closely the two markets track the same underlying event.
            Kalshi credentials required for cross-venue trading — connect in Trading Account settings.
          </p>
        </>
      )}
    </div>
  );
}
