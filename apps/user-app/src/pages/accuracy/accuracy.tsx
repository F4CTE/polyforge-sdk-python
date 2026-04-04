import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Target, Info } from 'lucide-react';
import { Button } from '@polyforge/ui';
import { resolveChartTheme } from '@polyforge/ui/lib/chart-colors';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface CalibrationBucket {
  bucketMid: number;
  frequency: number;
  count: number;
}

interface CategoryStat {
  count: number;
  brierScore: number;
}

interface AccuracyData {
  brierScore: number | null;
  totalPredictions: number;
  correctPredictions: number;
  winRate: string;
  calibration: CalibrationBucket[];
  byCategory: Record<string, CategoryStat>;
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-pf-overlay rounded animate-pulse ${className ?? ''}`} />;
}

function PageSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  tooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 relative">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">{label}</span>
        {tooltip && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onFocus={() => setShowTip(true)}
            onBlur={() => setShowTip(false)}
            aria-label={`Info: ${label}`}
            className="text-pf-text-muted hover:text-pf-text-secondary transition-colors focus-visible:outline-none"
          >
            <Info className="size-4" />
          </Button>
        )}
      </div>
      <span className="text-3xl font-mono font-semibold text-pf-text">{value}</span>
      {sub && <p className="text-xs text-pf-text-muted mt-1">{sub}</p>}
      {showTip && tooltip && (
        <div className="absolute top-full left-0 z-20 mt-2 w-56 rounded-pf-sm bg-pf-elevated border border-pf-border shadow-pf-lg p-3 text-xs text-pf-text-secondary leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const themeColors = useMemo(() => resolveChartTheme(), []);
  const { textMuted, bgElevated, borderColor, textSecondary, cyan500 } = themeColors;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const token = localStorage.getItem('access_token');
    fetch('/api/v1/accuracy/me', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load accuracy data');
        return r.json();
      })
      .then((d: AccuracyData) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load';
          setError(msg);
          toast.error(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">Failed to load accuracy data</p>
          <p className="text-sm text-pf-text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  /* ─── Empty state ─────────────────────────────────────────────────── */
  if (!data || data.totalPredictions === 0) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Target className="size-5 text-pf-text-muted" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-pf-text">Accuracy</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center bg-pf-elevated border border-pf-border rounded-pf-lg">
          <Target className="size-12 text-pf-text-muted mb-4 opacity-40" aria-hidden="true" />
          <p className="text-pf-text font-medium text-lg">No predictions yet</p>
          <p className="text-sm text-pf-text-muted mt-1 max-w-xs">
            Once you place and resolve predictions, your accuracy metrics will appear here.
          </p>
        </div>
      </div>
    );
  }

  const categories = Object.entries(data.byCategory);

  /* Diagonal reference line data for perfect calibration */
  const diagLine = [
    { bucketMid: 0, frequency: 0 },
    { bucketMid: 1, frequency: 1 },
  ];

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="size-5 text-pf-text-muted" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-pf-text">Accuracy</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Brier Score"
          value={data.brierScore !== null ? data.brierScore.toFixed(3) : '--'}
          sub="Lower is better"
          tooltip="Brier Score measures the accuracy of probabilistic predictions. A perfect score is 0, while 0.25 is equivalent to random guessing. Lower values indicate better calibration."
        />
        <StatCard
          label="Win Rate"
          value={`${data.winRate}%`}
          sub={`${data.correctPredictions} of ${data.totalPredictions} correct`}
        />
        <StatCard
          label="Total Predictions"
          value={data.totalPredictions.toLocaleString()}
        />
      </div>

      {/* Calibration Chart */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <h2 className="text-sm font-medium text-pf-text mb-1">Calibration Curve</h2>
        <p className="text-xs text-pf-text-muted mb-4">
          Points close to the diagonal line indicate well-calibrated predictions.
        </p>
        {data.calibration.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-pf-text-muted">
            Not enough data to display calibration curve.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid
                  stroke={borderColor}
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="bucketMid"
                  type="number"
                  domain={[0, 1]}
                  ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                  tick={{ fontSize: 10, fill: textMuted }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  label={{ value: 'Predicted Probability', position: 'insideBottom', offset: -4, fontSize: 11, fill: textSecondary }}
                />
                <YAxis
                  dataKey="frequency"
                  type="number"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={{ fontSize: 10, fill: textMuted }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  width={40}
                  label={{ value: 'Actual Frequency', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: textSecondary }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: borderColor }}
                  contentStyle={{
                    background: bgElevated,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: textSecondary }}
                  itemStyle={{ color: cyan500 }}
                  formatter={(value: number, name: string) => [value.toFixed(3), name === 'frequency' ? 'Actual' : 'Predicted']}
                />
                {/* Perfect calibration reference line */}
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  stroke={textSecondary}
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{ value: 'Perfect', position: 'insideTopLeft', fontSize: 10, fill: textSecondary }}
                />
                <Scatter
                  name="Calibration"
                  data={data.calibration}
                  fill={cyan500}
                  opacity={0.85}
                  r={5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-pf-border-subtle">
            <h2 className="text-sm font-medium text-pf-text">Breakdown by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Accuracy by category">
              <thead>
                <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                  <th scope="col" className="px-6 py-3 font-medium">Category</th>
                  <th scope="col" className="px-6 py-3 font-medium text-right">Predictions</th>
                  <th scope="col" className="px-6 py-3 font-medium text-right">Brier Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border-subtle">
                {categories.map(([cat, stat]) => (
                  <tr key={cat} className="hover:bg-pf-surface/50 transition-colors">
                    <td className="px-6 py-3 text-pf-text font-medium">{cat}</td>
                    <td className="px-6 py-3 text-right font-mono text-pf-text-secondary">
                      {stat.count.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      <span className={`${
                        stat.brierScore <= 0.1
                          ? 'text-pf-success'
                          : stat.brierScore <= 0.2
                          ? 'text-pf-warning'
                          : 'text-pf-danger'
                      }`}>
                        {stat.brierScore.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
