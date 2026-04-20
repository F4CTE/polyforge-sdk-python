import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, AlertTriangle, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@polyforge/ui';

interface HealthMetrics {
  fillRate: number;
  avgLatencyMs: number;
  errorCount24h: number;
  slippageBps: number;
  winRate: number | null;
  totalPnl: number | null;
  maxDrawdown: number | null;
  totalOrders: number;
  filledOrders: number;
  lastUpdated: string | null;
}

type HealthLevel = 'good' | 'warning' | 'critical';

function getHealthLevel(metric: string, value: number): HealthLevel {
  switch (metric) {
    case 'fillRate':
      return value >= 90 ? 'good' : value >= 70 ? 'warning' : 'critical';
    case 'avgLatencyMs':
      return value < 500 ? 'good' : value < 2000 ? 'warning' : 'critical';
    case 'errorCount24h':
      return value === 0 ? 'good' : value <= 5 ? 'warning' : 'critical';
    case 'slippageBps':
      return value < 10 ? 'good' : value < 50 ? 'warning' : 'critical';
    default:
      return 'good';
  }
}

const HEALTH_COLORS: Record<HealthLevel, { dot: string; text: string; bg: string }> = {
  good: { dot: 'bg-gain', text: 'text-gain', bg: 'bg-gain/10' },
  warning: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' },
  critical: { dot: 'bg-loss', text: 'text-loss', bg: 'bg-loss/10' },
};

interface HealthMetricCardProps {
  label: string;
  value: string;
  level: HealthLevel;
  icon: React.ReactNode;
  subtitle?: string;
}

function HealthMetricCard({ label, value, level, icon, subtitle }: HealthMetricCardProps) {
  const colors = HEALTH_COLORS[level];
  return (
    <div className={`rounded-pf border border-subtle p-3 ${colors.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-caption text-secondary uppercase tracking-wider font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${colors.dot}`} aria-label={`Status: ${level}`} />
          <span className="text-tertiary">{icon}</span>
        </div>
      </div>
      <div className={`text-base font-semibold font-mono tabular-nums ${colors.text}`}>
        {value}
      </div>
      {subtitle && (
        <span className="text-caption text-tertiary">{subtitle}</span>
      )}
    </div>
  );
}

interface HealthDashboardProps {
  strategyId: string;
  strategyStatus: string;
}

export function HealthDashboard({ strategyId, strategyStatus }: HealthDashboardProps) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/v1/strategies/${strategyId}/health`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load health metrics');
        return r.json();
      })
      .then((data) => {
        setMetrics({
          fillRate: data.fillRate ?? 0,
          avgLatencyMs: data.avgLatencyMs ?? 0,
          errorCount24h: data.errorCount24h ?? 0,
          slippageBps: data.slippageBps ?? 0,
          winRate: data.winRate ?? null,
          totalPnl: data.totalPnl ?? null,
          maxDrawdown: data.maxDrawdown ?? null,
          totalOrders: data.totalOrders ?? 0,
          filledOrders: data.filledOrders ?? 0,
          lastUpdated: data.lastUpdated ?? null,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [strategyId]);

  useEffect(() => {
    fetchHealth();

    const isActive = strategyStatus === 'RUNNING' || strategyStatus === 'PAPER';
    if (!isActive) return;

    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth, strategyStatus]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-tertiary" />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="size-5 text-loss mb-2" />
        <p className="text-body-sm text-loss mb-3">{error}</p>
        <Button type="button" variant="secondary" size="sm" onClick={fetchHealth}>
          <RefreshCw className="size-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!metrics) return null;

  const fillLevel = getHealthLevel('fillRate', metrics.fillRate);
  const latencyLevel = getHealthLevel('avgLatencyMs', metrics.avgLatencyMs);
  const errorLevel = getHealthLevel('errorCount24h', metrics.errorCount24h);
  const slippageLevel = getHealthLevel('slippageBps', metrics.slippageBps);

  const overallHealth: HealthLevel =
    [fillLevel, latencyLevel, errorLevel, slippageLevel].includes('critical') ? 'critical' :
    [fillLevel, latencyLevel, errorLevel, slippageLevel].includes('warning') ? 'warning' : 'good';

  return (
    <div className="space-y-4">
      {/* Overall health banner */}
      <div className={`flex items-center justify-between rounded-pf border border-subtle p-3 ${HEALTH_COLORS[overallHealth].bg}`}>
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${HEALTH_COLORS[overallHealth].dot}`} />
          <span className={`text-body-sm font-medium ${HEALTH_COLORS[overallHealth].text}`}>
            {overallHealth === 'good' ? 'Healthy' : overallHealth === 'warning' ? 'Needs Attention' : 'Critical Issues'}
          </span>
        </div>
        {metrics.lastUpdated && (
          <span className="text-caption text-tertiary">
            Updated {new Date(metrics.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Primary metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthMetricCard
          label="Fill Rate"
          value={`${metrics.fillRate.toFixed(1)}%`}
          level={fillLevel}
          icon={<Activity className="size-3" />}
          subtitle={`${metrics.filledOrders}/${metrics.totalOrders} orders`}
        />
        <HealthMetricCard
          label="Avg Latency"
          value={metrics.avgLatencyMs < 1000 ? `${Math.round(metrics.avgLatencyMs)}ms` : `${(metrics.avgLatencyMs / 1000).toFixed(1)}s`}
          level={latencyLevel}
          icon={<Clock className="size-3" />}
        />
        <HealthMetricCard
          label="Errors (24h)"
          value={String(metrics.errorCount24h)}
          level={errorLevel}
          icon={<AlertTriangle className="size-3" />}
        />
        <HealthMetricCard
          label="Slippage"
          value={`${metrics.slippageBps.toFixed(1)} bps`}
          level={slippageLevel}
          icon={<TrendingDown className="size-3" />}
        />
      </div>

      {/* Secondary metrics */}
      {(metrics.winRate !== null || metrics.totalPnl !== null || metrics.maxDrawdown !== null) && (
        <div className="grid grid-cols-3 gap-3">
          {metrics.winRate !== null && (
            <div className="rounded-pf border border-subtle bg-surface p-3">
              <span className="text-caption text-secondary uppercase tracking-wider font-medium block mb-1">Win Rate</span>
              <span className="text-base font-semibold font-mono tabular-nums text-primary">
                {metrics.winRate.toFixed(1)}%
              </span>
            </div>
          )}
          {metrics.totalPnl !== null && (
            <div className="rounded-pf border border-subtle bg-surface p-3">
              <span className="text-caption text-secondary uppercase tracking-wider font-medium block mb-1">Total PnL</span>
              <span className={`text-base font-semibold font-mono tabular-nums ${metrics.totalPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                {metrics.totalPnl >= 0 ? '+' : ''}{metrics.totalPnl.toFixed(2)}
              </span>
            </div>
          )}
          {metrics.maxDrawdown !== null && (
            <div className="rounded-pf border border-subtle bg-surface p-3">
              <span className="text-caption text-secondary uppercase tracking-wider font-medium block mb-1">Max Drawdown</span>
              <span className="text-base font-semibold font-mono tabular-nums text-loss">
                -{metrics.maxDrawdown.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
