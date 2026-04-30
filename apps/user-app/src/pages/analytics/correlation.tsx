import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import {
  GitMerge,
  Grid3x3,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface CorrelationData {
  categories: string[];
  matrix: number[][];
  updatedAt: string;
}

interface MarketCorrelation {
  marketIdA: string;
  titleA: string;
  marketIdB: string;
  titleB: string;
  correlation: number;
  sampleSize: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatCorr(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}`;
}

function correlationLabel(val: number): string {
  if (val >= 0.7) return 'strong positive';
  if (val >= 0.3) return 'moderate positive';
  if (val <= -0.7) return 'strong negative';
  if (val <= -0.3) return 'moderate negative';
  return 'neutral';
}

function correlationCellClass(val: number): string {
  if (val >= 0.7) return 'bg-gain/80';
  if (val >= 0.3) return 'bg-gain/35';
  if (val <= -0.7) return 'bg-loss/80';
  if (val <= -0.3) return 'bg-loss/35';
  return 'bg-overlay';
}

function correlationTextClass(val: number): string {
  if (val >= 0.7 || val >= 0.3) return 'text-gain';
  if (val <= -0.7 || val <= -0.3) return 'text-loss';
  return 'text-secondary';
}

function correlationBadgeClass(val: number): string {
  if (val >= 0.3) return 'bg-gain-subtle text-gain border border-gain/30';
  if (val <= -0.3) return 'bg-loss-subtle text-loss border border-loss/30';
  return 'bg-overlay text-secondary border border-default';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Insights derivation ────────────────────────────────────────────── */

interface Insight {
  icon: 'up' | 'down' | 'neutral';
  text: string;
}

function deriveInsights(data: CorrelationData): Insight[] {
  const { categories, matrix } = data;
  if (categories.length < 2) return [];

  let maxVal = -Infinity;
  let maxI = 0;
  let maxJ = 1;

  let minAbsVal = Infinity;
  let minAbsI = 0;
  let minAbsJ = 1;

  let globalMinVal = Infinity;
  let globalMinI = 0;
  let globalMinJ = 1;

  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const v = matrix[i][j];
      if (v > maxVal) { maxVal = v; maxI = i; maxJ = j; }
      if (Math.abs(v) < minAbsVal) { minAbsVal = Math.abs(v); minAbsI = i; minAbsJ = j; }
      if (v < globalMinVal) { globalMinVal = v; globalMinI = i; globalMinJ = j; }
    }
  }

  const insights: Insight[] = [];

  // Highest positive
  insights.push({
    icon: 'up',
    text: `${capitalize(categories[maxI])} and ${capitalize(categories[maxJ])} move together (${formatCorr(maxVal)})`,
  });

  // Most neutral pair
  insights.push({
    icon: 'neutral',
    text: `${capitalize(categories[minAbsI])} and ${capitalize(categories[minAbsJ])} are uncorrelated (${formatCorr(matrix[minAbsI][minAbsJ])})`,
  });

  // Best diversification (lowest correlation pair overall)
  insights.push({
    icon: 'down',
    text: `Best diversification: add ${capitalize(categories[globalMinJ])} to your ${capitalize(categories[globalMinI])} positions`,
  });

  return insights;
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-overlay rounded animate-pulse ${className ?? ''}`} />;
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-4 overflow-x-auto">
        <div className="inline-grid gap-1 correlation-grid" style={{ '--correlation-col-count': 6 } as React.CSSProperties}>
          {Array.from({ length: 7 * 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PairsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/* ─── Tooltip ────────────────────────────────────────────────────────── */

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [corrData, setCorrData] = useState<CorrelationData | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  const [pairs, setPairs] = useState<MarketCorrelation[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(false);
  const [categoryA, setCategoryA] = useState('');
  const [categoryB, setCategoryB] = useState('');

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  const [highlightCol, setHighlightCol] = useState<number | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);

  /* ── Fetch matrix ─────────────────────────────────────────────────── */

  const loadMatrix = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const res = await fetch('/api/v1/analytics/correlation/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load correlation data');
      setCorrData(await res.json());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load correlation data';
      toast.error(msg);
    } finally {
      setLoadingMatrix(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  /* ── Fetch pairs ──────────────────────────────────────────────────── */

  const loadPairs = useCallback(async (catA: string, catB: string) => {
    if (!catA || !catB || catA === catB) return;
    setLoadingPairs(true);
    try {
      const params = new URLSearchParams({ categoryA: catA, categoryB: catB, limit: '10' });
      const res = await fetch(`/api/v1/analytics/correlation/markets?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load market pairs');
      const json = await res.json() as { data: MarketCorrelation[] };
      setPairs(json.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load market pairs';
      toast.error(msg);
      setPairs([]);
    } finally {
      setLoadingPairs(false);
    }
  }, []);

  useEffect(() => {
    if (categoryA && categoryB && categoryA !== categoryB) {
      loadPairs(categoryA, categoryB);
    } else {
      setPairs([]);
    }
  }, [categoryA, categoryB, loadPairs]);

  /* ── Insights ─────────────────────────────────────────────────────── */

  const insights = useMemo(() => {
    if (!corrData) return [];
    return deriveInsights(corrData);
  }, [corrData]);

  /* ── Heatmap interaction ──────────────────────────────────────────── */

  function handleCellEnter(
    e: React.MouseEvent<HTMLDivElement>,
    i: number,
    j: number,
    val: number,
    catA: string,
    catB: string,
  ) {
    setHighlightRow(i);
    setHighlightCol(j);
    const label = correlationLabel(val);
    setTooltip({
      visible: true,
      text: `${capitalize(catA)} \u2194 ${capitalize(catB)}: ${formatCorr(val)} (${label})`,
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleCellMove(e: React.MouseEvent<HTMLDivElement>) {
    setTooltip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
  }

  function handleCellLeave() {
    setHighlightRow(null);
    setHighlightCol(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  const categories = corrData?.categories ?? [];
  const matrix = corrData?.matrix ?? [];

  const categoryOptions = categories.map((c) => ({ label: capitalize(c), value: c }));

  return (
    <div className="animate-fade-in p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <GitMerge className="size-5 text-tertiary mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Market Correlation</h1>
          <p className="text-body-sm text-tertiary mt-1">
            How Polymarket categories move together
          </p>
        </div>
      </div>

      {/* ── Section 1: Category Heatmap ────────────────────────────────── */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Grid3x3 className="size-4 text-tertiary" aria-hidden="true" />
          <h2 className="text-body-md font-medium text-primary">Category Correlation Heatmap</h2>
        </div>
        <p className="text-label text-tertiary -mt-2">
          Correlation coefficients between Polymarket categories. Values range from -1 (inverse) to +1 (identical movement).
        </p>

        {loadingMatrix ? (
          <HeatmapSkeleton />
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <Grid3x3 className="size-10 text-tertiary opacity-30" aria-hidden="true" />
            <p className="text-body-sm text-tertiary">No correlation data available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="inline-grid gap-1 correlation-grid"
              style={{ '--correlation-col-count': categories.length } as React.CSSProperties}
              role="grid"
              aria-label="Category correlation matrix"
            >
              {/* Top-left empty corner */}
              <div className="h-[72px] w-20" aria-hidden="true" />

              {/* Column headers */}
              {categories.map((cat, j) => (
                <div
                  key={`col-${cat}`}
                  className={`h-[72px] w-[72px] flex items-end justify-center pb-2 transition-colors duration-micro ${
                    highlightCol === j ? 'text-accent-text' : 'text-secondary'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className="text-caption font-semibold uppercase tracking-wider truncate max-w-[64px] block text-center correlation-header-cell"
                  >
                    {capitalize(cat)}
                  </span>
                </div>
              ))}

              {/* Matrix rows */}
              {categories.map((rowCat, i) => (
                <>
                  {/* Row header */}
                  <div
                    key={`row-label-${rowCat}`}
                    className={`h-[72px] w-20 flex items-center justify-end pr-2 transition-colors duration-micro ${
                      highlightRow === i ? 'text-accent-text' : 'text-secondary'
                    }`}
                    aria-hidden="true"
                  >
                    <span className="text-caption font-semibold uppercase tracking-wider truncate">
                      {capitalize(rowCat)}
                    </span>
                  </div>

                  {/* Row cells */}
                  {categories.map((colCat, j) => {
                    const isDiagonal = i === j;
                    const val = matrix[i]?.[j] ?? 0;

                    if (isDiagonal) {
                      return (
                        <div
                          key={`cell-${i}-${j}`}
                          className="h-[72px] w-[72px] rounded bg-accent/20 flex items-center justify-center"
                          aria-label={`${capitalize(rowCat)} self-correlation`}
                          role="gridcell"
                        >
                          <span className="text-body-md font-mono text-accent-text">—</span>
                        </div>
                      );
                    }

                    const cellBg = correlationCellClass(val);
                    const textClass = correlationTextClass(val);
                    const isHighlighted = highlightRow === i || highlightCol === j;

                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        className={`h-[72px] w-[72px] rounded flex items-center justify-center cursor-default transition-all duration-micro ${cellBg} ${
                          isHighlighted ? 'ring-1 ring-accent-text/50 scale-[1.04]' : ''
                        }`}
                        role="gridcell"
                        aria-label={`${capitalize(rowCat)} to ${capitalize(colCat)}: ${formatCorr(val)}`}
                        onMouseEnter={(e) => handleCellEnter(e, i, j, val, rowCat, colCat)}
                        onMouseMove={handleCellMove}
                        onMouseLeave={handleCellLeave}
                      >
                        <span className={`text-label font-mono font-semibold ${textClass}`}>
                          {formatCorr(val)}
                        </span>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        {!loadingMatrix && categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
            <span className="text-label text-tertiary font-medium uppercase tracking-wider">Legend:</span>
            <LegendItem bgClass="bg-gain/80" label="Strong positive" />
            <LegendItem bgClass="bg-gain/35" label="Moderate positive" />
            <LegendItem bgClass="bg-overlay border border-default" label="Neutral" />
            <LegendItem bgClass="bg-loss/35" label="Moderate negative" />
            <LegendItem bgClass="bg-loss/80" label="Strong negative" />
          </div>
        )}
      </div>

      {/* ── Section 3: Insight cards (above pairs, derived from matrix) ── */}
      {!loadingMatrix && insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {insights.map((insight, idx) => (
            <InsightCard key={idx} insight={insight} />
          ))}
        </div>
      )}

      {/* ── Section 2: Top correlated market pairs ─────────────────────── */}
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="px-6 py-4 border-b border-default">
          <h2 className="text-body-md font-medium text-primary">Top Correlated Market Pairs</h2>
          <p className="text-label text-tertiary mt-1">
            Select two different categories to see the most correlated individual market pairs between them.
          </p>
        </div>

        {/* Category selectors */}
        <div className="px-6 py-4 border-b border-default flex flex-col sm:flex-row gap-3">
          <CategorySelect
            id="category-a"
            label="Category A"
            value={categoryA}
            options={categoryOptions}
            onChange={setCategoryA}
            disabled={loadingMatrix}
          />
          <CategorySelect
            id="category-b"
            label="Category B"
            value={categoryB}
            options={categoryOptions}
            onChange={setCategoryB}
            disabled={loadingMatrix}
          />
          {categoryA && categoryB && categoryA === categoryB && (
            <div className="flex items-center gap-2 text-label text-warning self-end pb-1">
              <Info className="size-4" aria-hidden="true" />
              Select two different categories
            </div>
          )}
        </div>

        {/* Pairs table / states */}
        {!categoryA || !categoryB || categoryA === categoryB ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
            <GitMerge className="size-10 text-tertiary opacity-30" aria-hidden="true" />
            <p className="text-body-sm text-tertiary">Select two categories to see correlated market pairs</p>
          </div>
        ) : loadingPairs ? (
          <div className="p-6">
            <PairsSkeleton />
          </div>
        ) : pairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
            <p className="text-body-sm text-tertiary">No correlated pairs found for these categories.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm" aria-label="Correlated market pairs">
              <caption className="sr-only">Correlated market pairs</caption>
              <thead>
                <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                  <th scope="col" className="px-6 py-3 font-medium">Market A</th>
                  <th scope="col" className="px-6 py-3 font-medium">Market B</th>
                  <th scope="col" className="px-6 py-3 font-medium text-right">Correlation</th>
                  <th scope="col" className="px-6 py-3 font-medium text-right">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {pairs.map((pair) => (
                  <tr key={`${pair.marketIdA}-${pair.marketIdB}`} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3 max-w-xs">
                      <Link
                        to={`/markets/${pair.marketIdA}`}
                        className="text-primary hover:text-accent-text transition-colors line-clamp-2 text-label leading-relaxed"
                      >
                        {pair.titleA}
                      </Link>
                    </td>
                    <td className="px-6 py-3 max-w-xs">
                      <Link
                        to={`/markets/${pair.marketIdB}`}
                        className="text-primary hover:text-accent-text transition-colors line-clamp-2 text-label leading-relaxed"
                      >
                        {pair.titleB}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-label font-mono font-semibold ${correlationBadgeClass(pair.correlation)}`}>
                        {pair.correlation >= 0.3 && <TrendingUp className="size-3" aria-hidden="true" />}
                        {pair.correlation <= -0.3 && <TrendingDown className="size-3" aria-hidden="true" />}
                        {formatCorr(pair.correlation)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-secondary text-label">
                      {pair.sampleSize.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global tooltip */}
      {tooltip.visible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-pf bg-elevated border border-default text-label text-primary shadow-elevation-2 max-w-[240px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }} /* computed position: intentional */
          aria-hidden="true"
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function LegendItem({ bgClass, label }: { bgClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`size-3 rounded-sm ${bgClass}`} aria-hidden="true" />
      <span className="text-label text-tertiary">{label}</span>
    </div>
  );
}

function InsightCard({ insight }: { insight: { icon: 'up' | 'down' | 'neutral'; text: string } }) {
  const iconMap = {
    up: <TrendingUp className="size-4 text-gain shrink-0" aria-hidden="true" />,
    down: <TrendingDown className="size-4 text-accent-text shrink-0" aria-hidden="true" />,
    neutral: <Info className="size-4 text-tertiary shrink-0" aria-hidden="true" />,
  };

  return (
    <div className="bg-elevated border border-default rounded-pf p-4 flex items-start gap-3">
      {iconMap[insight.icon]}
      <p className="text-label text-secondary leading-relaxed">{insight.text}</p>
    </div>
  );
}

interface SelectOption {
  label: string;
  value: string;
}

function CategorySelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <label htmlFor={id} className="text-label font-medium text-secondary">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-surface border border-default rounded-sm px-3 py-2 pr-8 text-body-md text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select category…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
