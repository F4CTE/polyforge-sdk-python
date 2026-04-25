import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Hammer, TrendingUp, Award, DollarSign, Medal, BarChart3, RefreshCw, Users, Zap, ArrowUpRight } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { adminApi } from '@/lib/api';
import { chartTooltipContentStyle, chartTooltipLabelStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';

interface BuilderStats {
  attributedVolumeUsdc: number;
  totalOrders: number;
  activeStrategies: number;
  connectedUsers: number;
  currentTier: string;
  relayLimit: number;
  weeklyRewardUsdc: number | null;
  weekly?: { week: string; volume: string; reward: string }[];
}

interface LeaderboardData {
  rank: number | null;
  totalBuilders: number;
  entries: { name?: string; volume?: number; rank?: number }[];
}

interface VolumeData {
  daily: { date: string; volume: number }[];
  totalVolume: number;
}

const TIER_THRESHOLDS: Record<string, { next: string | null; label: string; color: string }> = {
  UNVERIFIED: { next: 'VERIFIED', label: 'Unverified', color: 'var(--text-tertiary)' },
  VERIFIED: { next: 'PARTNER', label: 'Verified', color: 'var(--accent-default)' },
  PARTNER: { next: null, label: 'Partner', color: 'var(--gain)' },
};

function formatWeekLabel(w: string): string {
  if (w.length > 10) return w.slice(5, 10);
  return w;
}

function formatDateLabel(d: string): string {
  if (d.length >= 10) return d.slice(5, 10);
  return d;
}

export function Component() {
  const [stats, setStats] = useState<BuilderStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [volume, setVolume] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [statsRes, leaderboardRes, volumeRes] = await Promise.allSettled([
        adminApi.builderStats(),
        adminApi.builderLeaderboard(),
        adminApi.builderVolume(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value as unknown as BuilderStats);
      if (leaderboardRes.status === 'fulfilled') setLeaderboard(leaderboardRes.value as unknown as LeaderboardData);
      if (volumeRes.status === 'fulfilled') setVolume(volumeRes.value as unknown as VolumeData);
    } catch {
      toast.error('Failed to load builder stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading builder statistics">
        <div className="text-body-sm text-secondary">Loading builder stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-tertiary">No builder data available</p>
      </div>
    );
  }

  const tierInfo = TIER_THRESHOLDS[stats.currentTier] ?? TIER_THRESHOLDS.UNVERIFIED;

  const weeklyChartData = (stats.weekly ?? []).map(w => ({
    week: formatWeekLabel(w.week),
    volume: Number(w.volume),
    reward: Number(w.reward),
  }));

  const dailyChartData = (volume?.daily ?? []).map(d => ({
    date: formatDateLabel(d.date),
    volume: d.volume,
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Builder Program</h2>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-body-sm text-secondary hover:text-primary transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Tier Badge & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Tier Badge Card */}
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} style={{ color: tierInfo.color }} aria-hidden="true" />
            <span className="text-label text-tertiary">Current Tier</span>
          </div>
          <div className="text-2xl font-semibold text-primary">{tierInfo.label}</div>
          {tierInfo.next && (
            <div className="mt-1 flex items-center gap-1 text-label text-tertiary">
              <ArrowUpRight size={12} />
              <span>Next: {tierInfo.next}</span>
            </div>
          )}
          <div className="mt-1 text-label text-secondary">
            Relay limit: {stats.relayLimit === Infinity ? '∞' : stats.relayLimit.toLocaleString()}
          </div>
        </div>

        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-gain" aria-hidden="true" />
            <span className="text-label text-tertiary">Weekly Reward</span>
          </div>
          <div className="text-2xl font-semibold text-primary">${stats.weeklyRewardUsdc ?? '0'}</div>
        </div>

        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-info" aria-hidden="true" />
            <span className="text-label text-tertiary">Attributed Volume</span>
          </div>
          <div className="text-2xl font-semibold text-primary">${stats.attributedVolumeUsdc.toLocaleString()}</div>
          <div className="mt-1 text-label text-secondary">{stats.totalOrders.toLocaleString()} orders</div>
        </div>

        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <Medal size={16} className="text-accent" aria-hidden="true" />
            <span className="text-label text-tertiary">Leaderboard</span>
          </div>
          <div className="text-2xl font-semibold text-primary">
            {leaderboard?.rank != null ? (
              <>
                #{leaderboard.rank}
                {leaderboard.totalBuilders > 0 && (
                  <span className="text-body-sm text-tertiary font-normal ml-1.5">/ {leaderboard.totalBuilders}</span>
                )}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>

        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-accent" aria-hidden="true" />
            <span className="text-label text-tertiary">Platform</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-lg font-semibold text-primary">{stats.activeStrategies}</div>
              <div className="text-label text-tertiary">strategies</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-primary">{stats.connectedUsers}</div>
              <div className="text-label text-tertiary">users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Volume Chart (per-market attribution) */}
        {dailyChartData.length > 0 && (
          <div className="bg-elevated border border-default rounded-pf p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-accent" aria-hidden="true" />
                <h3 className="text-body-md font-semibold text-primary">Daily Volume Attribution</h3>
              </div>
              {volume && (
                <span className="text-label text-secondary">
                  Total: ${volume.totalVolume.toLocaleString()}
                </span>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" tick={chartAxisTick} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, 'Volume']} />
                  <Bar dataKey="volume" fill="var(--accent-default)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekly Reward History (Line Chart) */}
        {weeklyChartData.length > 0 && (
          <div className="bg-elevated border border-default rounded-pf p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-gain" aria-hidden="true" />
              <h3 className="text-body-md font-semibold text-primary">Weekly Rewards & Volume</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyChartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="week" tick={chartAxisTick} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                  <YAxis yAxisId="volume" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="reward" orientation="right" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                  <Line yAxisId="volume" type="monotone" dataKey="volume" stroke="var(--accent-default)" strokeWidth={2} dot={{ r: 3 }} name="Volume" />
                  <Line yAxisId="reward" type="monotone" dataKey="reward" stroke="var(--gain)" strokeWidth={2} dot={{ r: 3 }} name="Reward" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Weekly History Table */}
      <div className="bg-elevated border border-default rounded-pf p-5">
        <div className="flex items-center gap-2 mb-4">
          <Hammer size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-body-md font-semibold text-primary">Weekly History</h3>
        </div>
        {!stats.weekly || stats.weekly.length === 0 ? (
          <p className="text-body-sm text-tertiary">No weekly data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm" aria-label="Weekly builder history">
              <caption className="sr-only">Weekly builder history</caption>
              <thead>
                <tr className="border-b border-default">
                  <th scope="col" className="text-left px-3 py-2 text-label font-medium text-tertiary uppercase">Week</th>
                  <th scope="col" className="text-right px-3 py-2 text-label font-medium text-tertiary uppercase">Volume</th>
                  <th scope="col" className="text-right px-3 py-2 text-label font-medium text-tertiary uppercase">Reward</th>
                </tr>
              </thead>
              <tbody>
                {stats.weekly.map((w) => (
                  <tr key={w.week} className="border-b border-default last:border-0">
                    <td className="px-3 py-3 text-primary">{w.week}</td>
                    <td className="px-3 py-3 text-right text-secondary">
                      ${Number(w.volume).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-gain font-medium">
                      ${w.reward}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
