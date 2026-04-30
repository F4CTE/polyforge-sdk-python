import {
  BACKTEST_STATS,
  STRATEGY_LINES,
  PNL_CATEGORIES,
} from "../data/landing-data";

function EquityCurveCard() {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-5">
      <div className="font-mono text-caption text-tertiary uppercase tracking-widest">
        Equity curve · 30d
      </div>
      <div className="font-mono text-3xl font-semibold text-gain tracking-tight mt-1 tabular-nums">
        +34.2%
      </div>
      <svg
        width="100%"
        height="96"
        viewBox="0 0 400 96"
        preserveAspectRatio="none"
        className="mt-2.5"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="eqGrad-bt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--gain)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 76 L 40 68 L 80 72 L 120 56 L 160 46 L 200 52 L 240 36 L 280 30 L 320 18 L 400 8 L 400 96 L 0 96 Z"
          fill="url(#eqGrad-bt)"
        />
        <path
          d="M0 76 L 40 68 L 80 72 L 120 56 L 160 46 L 200 52 L 240 36 L 280 30 L 320 18 L 400 8"
          fill="none"
          stroke="var(--gain)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="grid grid-cols-4 gap-3 mt-3.5 pt-3.5 border-t border-subtle">
        {BACKTEST_STATS.map(({ label, value, color }) => (
          <div key={label}>
            <div className="font-mono text-caption text-tertiary uppercase tracking-widest">
              {label}
            </div>
            <div
              className={`font-mono text-sm font-semibold mt-0.5 tabular-nums ${color}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyComparisonCard() {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-5">
      <div className="font-mono text-caption text-tertiary uppercase tracking-widest mb-2.5">
        Compare · 4 strategies
      </div>
      <svg
        width="100%"
        height="140"
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g stroke="var(--border-subtle)" strokeWidth="0.5">
          <line x1="0" y1="30" x2="400" y2="30" />
          <line x1="0" y1="70" x2="400" y2="70" />
          <line x1="0" y1="110" x2="400" y2="110" />
        </g>
        <path
          d="M0 120 L 80 105 L 160 95 L 240 82 L 320 60 L 400 30"
          stroke="var(--accent-default)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0 120 L 80 115 L 160 100 L 240 100 L 320 75 L 400 50"
          stroke="var(--gain)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0 120 L 80 110 L 160 120 L 240 115 L 320 105 L 400 92"
          stroke="var(--warning)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0 120 L 80 122 L 160 118 L 240 125 L 320 130 L 400 128"
          stroke="var(--loss)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 3"
        />
      </svg>
      <div className="flex gap-3 flex-wrap mt-2.5 text-caption font-mono">
        {STRATEGY_LINES.map(({ name, color }) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-0.5 inline-block rounded-full"
              style={{ background: color }}
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryPnlCard() {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-5">
      <div className="font-mono text-caption text-tertiary uppercase tracking-widest mb-2.5">
        Per-category P&L
      </div>
      {PNL_CATEGORIES.map(({ category, pct, tone }) => (
        <div
          key={category}
          className="grid items-center gap-2.5 py-2 border-b border-subtle"
          style={{ gridTemplateColumns: "76px 1fr 56px" }}
        >
          <span className="text-xs text-primary">{category}</span>
          <div className="relative bg-subtle h-1.5 rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left:
                  tone === "loss"
                    ? `${50 - Math.abs(pct) / 2}%`
                    : "50%",
                width: `${Math.abs(pct) / 2}%`,
                background: `var(--${tone})`,
                opacity: 0.8,
              }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-default" />
          </div>
          <span
            className={`font-mono text-xs tabular-nums text-right text-${tone}`}
          >
            {pct > 0 ? "+" : ""}
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function BacktestSection() {
  return (
    <section className="py-20 md:py-28 border-t border-subtle" id="backtest">
      <div className="max-w-container-landing mx-auto px-6">
        <div className="mb-12 max-w-2xl mx-auto text-center">
          <p className="text-label font-medium text-accent-text uppercase tracking-wider font-mono mb-4">
            03 · Backtest &amp; paper
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary tracking-tight mb-4">
            Prove the edge before the capital.
          </h2>
          <p className="text-base text-secondary leading-relaxed">
            Run any strategy on full Polymarket history. Sharpe, max drawdown,
            per-category P&L. Compare four variants on a shared axis. Paper mode
            routes real prices to simulated fills — Kelly-sized and all.
          </p>
        </div>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          }}
          aria-hidden="true"
        >
          <EquityCurveCard />
          <StrategyComparisonCard />
          <CategoryPnlCard />
        </div>
      </div>
    </section>
  );
}
