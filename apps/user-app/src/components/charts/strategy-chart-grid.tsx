import { StrategyChart, type TradeMarker } from './strategy-chart';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketSlot {
  slot: string;
  label?: string;
}

interface StrategyChartGridProps {
  /** slot → tokenId mapping from market bindings */
  marketBindings: Record<string, string>;
  /** Ordered slot list (provides display labels) */
  marketSlots: MarketSlot[];
  /**
   * Backtest trades — no tokenId so shown on all charts.
   * Pass either `trades` (backtest) or `recentTrades` (live), not both.
   */
  trades?: TradeMarker[];
  /**
   * Live trades — include `market` field (tokenId) so filtered per chart.
   */
  recentTrades?: (TradeMarker & { market: string })[];
  /** Price history start date (ISO or YYYY-MM-DD) */
  dateFrom?: string;
  /** Price history end date (ISO or YYYY-MM-DD) */
  dateTo?: string;
}

/* ─── Grid layout helper ─────────────────────────────────────────────── */

function gridClass(count: number): string {
  if (count === 1) return 'grid-cols-1';
  return 'grid-cols-2';
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function StrategyChartGrid({
  marketBindings, marketSlots, trades, recentTrades, dateFrom, dateTo,
}: StrategyChartGridProps) {
  // Build list of {tokenId, label} pairs in slot order
  const charts = marketSlots
    .filter(s => !!marketBindings[s.slot])
    .map(s => ({
      tokenId: marketBindings[s.slot],
      label: s.label ?? s.slot,
    }));

  // Fall back: if no slot metadata, iterate bindings directly
  const items = charts.length > 0
    ? charts
    : Object.entries(marketBindings).map(([slot, tokenId]) => ({ tokenId, label: slot }));

  if (items.length === 0) return null;

  return (
    <div className={`grid ${gridClass(items.length)} gap-2`}>
      {items.map(({ tokenId, label }) => {
        // For live trades: filter to this specific token
        const liveForToken = recentTrades
          ? recentTrades.filter(t => t.market === tokenId)
          : undefined;

        // Use live-filtered trades if available, otherwise backtest trades (shown on all)
        const markers: TradeMarker[] = liveForToken ?? trades ?? [];

        return (
          <StrategyChart
            key={tokenId}
            tokenId={tokenId}
            label={label}
            trades={markers}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        );
      })}
    </div>
  );
}
