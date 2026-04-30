import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, Loader2, BarChart3, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button } from '@polyforge/ui';

interface StrategyMetrics {
  id: string;
  name: string;
  status: string;
  totalPnl: number;
  winRate: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  totalOrders: number;
  filledOrders: number;
  avgTradeSize: number;
  tags: string[];
}

function formatPnl(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MetricRow({ label, values, format, higherIsBetter = true }: {
  label: string;
  values: (number | null)[];
  format: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const numericValues = values.filter((v): v is number => v !== null);
  const best = higherIsBetter ? Math.max(...numericValues) : Math.min(...numericValues);

  return (
    <tr className="border-b border-subtle">
      <td className="py-2.5 px-3 text-label font-medium text-secondary">{label}</td>
      {values.map((v, i) => {
        const isBest = v !== null && numericValues.length > 1 && v === best;
        return (
          <td key={i} className="py-2.5 px-3 text-right font-mono tabular-nums text-body-sm">
            {v === null ? (
              <span className="text-tertiary">—</span>
            ) : (
              <span className={isBest ? 'text-accent-text font-semibold' : 'text-primary'}>
                {format(v)}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function Component() {
  const [searchParams] = useSearchParams();
  const ids = useMemo(() => {
    const raw = searchParams.get('ids') ?? '';
    return raw.split(',').filter(Boolean).slice(0, 3);
  }, [searchParams]);

  const [strategies, setStrategies] = useState<StrategyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) {
      setError('Select 2-3 strategies to compare');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all(
      ids.map((id) =>
        fetch(`/api/v1/strategies/${id}`, { credentials: 'include' })
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to load strategy ${id}`);
            return r.json();
          })
          .then((data): StrategyMetrics => ({
            id: data.id,
            name: data.name,
            status: data.status,
            totalPnl: data.totalPnl ?? 0,
            winRate: data.winRate ?? 0,
            sharpeRatio: data.sharpeRatio ?? null,
            maxDrawdown: data.maxDrawdown ?? 0,
            totalOrders: data.totalOrders ?? 0,
            filledOrders: data.filledOrders ?? 0,
            avgTradeSize: data.avgTradeSize ?? 0,
            tags: data.tags ?? [],
          }))
      )
    )
      .then(setStrategies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ids]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-subtle shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link
            to="/strategies"
            className="flex items-center gap-1 text-label text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Strategies
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
          <BarChart3 className="size-5 text-accent-text" aria-hidden="true" />
          Strategy Comparison
        </h1>
        <p className="text-body-sm text-secondary mt-1">
          Side-by-side performance metrics for {ids.length} strategies
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-tertiary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="size-6 text-warning mb-3" />
            <p className="text-body-sm text-secondary mb-3">{error}</p>
            <Link to="/strategies">
              <Button type="button" variant="secondary" size="sm">
                Back to Strategies
              </Button>
            </Link>
          </div>
        )}

        {!loading && !error && strategies.length >= 2 && (
          <div className="max-w-4xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">Strategy comparison metrics</caption>
                <thead>
                  <tr className="border-b border-default">
                    <th className="py-2.5 px-3 text-left text-caption font-medium text-tertiary uppercase tracking-wider w-40">
                      Metric
                    </th>
                    {strategies.map((s) => (
                      <th key={s.id} className="py-2.5 px-3 text-right min-w-[140px]">
                        <Link
                          to={`/strategies/${s.id}`}
                          className="text-body-sm font-semibold text-primary hover:text-accent-text transition-colors"
                        >
                          {s.name}
                        </Link>
                        <div className="text-caption text-tertiary mt-0.5">{s.status}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="Total PnL"
                    values={strategies.map((s) => s.totalPnl)}
                    format={(v) => `$${formatPnl(v)}`}
                    higherIsBetter
                  />
                  <MetricRow
                    label="Win Rate"
                    values={strategies.map((s) => s.winRate)}
                    format={formatPct}
                    higherIsBetter
                  />
                  <MetricRow
                    label="Sharpe Ratio"
                    values={strategies.map((s) => s.sharpeRatio)}
                    format={(v) => v.toFixed(2)}
                    higherIsBetter
                  />
                  <MetricRow
                    label="Max Drawdown"
                    values={strategies.map((s) => s.maxDrawdown)}
                    format={(v) => `${v.toFixed(1)}%`}
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="Total Orders"
                    values={strategies.map((s) => s.totalOrders)}
                    format={(v) => String(v)}
                    higherIsBetter
                  />
                  <MetricRow
                    label="Fill Rate"
                    values={strategies.map((s) => s.totalOrders > 0 ? (s.filledOrders / s.totalOrders) * 100 : 0)}
                    format={formatPct}
                    higherIsBetter
                  />
                  <MetricRow
                    label="Avg Trade Size"
                    values={strategies.map((s) => s.avgTradeSize)}
                    format={(v) => `$${v.toFixed(2)}`}
                    higherIsBetter={false}
                  />
                </tbody>
              </table>
            </div>

            {/* Visual comparison summary */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategies.map((s) => (
                <div key={s.id} className="bg-surface border border-subtle rounded-pf p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Link
                      to={`/strategies/${s.id}`}
                      className="text-body-md font-semibold text-primary hover:text-accent-text transition-colors truncate"
                    >
                      {s.name}
                    </Link>
                    {s.totalPnl >= 0 ? (
                      <TrendingUp className="size-4 text-gain shrink-0" />
                    ) : (
                      <TrendingDown className="size-4 text-loss shrink-0" />
                    )}
                  </div>
                  <div className="space-y-2 text-label">
                    <div className="flex justify-between">
                      <span className="text-tertiary">PnL</span>
                      <span className={`font-mono tabular-nums font-medium ${s.totalPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                        ${formatPnl(s.totalPnl)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Win Rate</span>
                      <span className="font-mono tabular-nums text-primary">{formatPct(s.winRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Drawdown</span>
                      <span className="font-mono tabular-nums text-loss">-{formatPct(s.maxDrawdown)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
