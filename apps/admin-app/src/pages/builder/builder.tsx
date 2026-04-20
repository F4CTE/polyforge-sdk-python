import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Hammer, TrendingUp, Award, DollarSign, Medal, BarChart3, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { adminApi } from '@/lib/api';

interface BuilderStats {
  tier: string;
  weeklyRewardUsdc: string;
  attributedVolume: string;
  leaderboardRank?: number;
  totalBuilders?: number;
  weekly: { week: string; volume: string; reward: string }[];
}

function formatWeekLabel(w: string): string {
  if (w.length > 10) return w.slice(5, 10);
  return w;
}

export function Component() {
  const [stats, setStats] = useState<BuilderStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await adminApi.builderStats();
      setStats(res as unknown as BuilderStats);
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

  const chartData = (stats.weekly ?? []).map(w => ({
    week: formatWeekLabel(w.week),
    volume: Number(w.volume),
    reward: Number(w.reward),
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-warning" aria-hidden="true" />
            <span className="text-label text-tertiary">Current Tier</span>
          </div>
          <div className="text-2xl font-semibold text-primary capitalize">{stats.tier ?? 'N/A'}</div>
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
          <div className="text-2xl font-semibold text-primary">${Number(stats.attributedVolume ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="flex items-center gap-2 mb-2">
            <Medal size={16} className="text-accent" aria-hidden="true" />
            <span className="text-label text-tertiary">Leaderboard Rank</span>
          </div>
          <div className="text-2xl font-semibold text-primary">
            {stats.leaderboardRank != null ? (
              <>
                #{stats.leaderboardRank}
                {stats.totalBuilders != null && (
                  <span className="text-body-sm text-tertiary font-normal ml-1.5">/ {stats.totalBuilders}</span>
                )}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>
      </div>

      {/* Daily Volume Chart */}
      {chartData.length > 0 && (
        <div className="bg-elevated border border-default rounded-pf p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-accent" aria-hidden="true" />
            <h3 className="text-body-md font-semibold text-primary">Weekly Volume</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Volume']}
                />
                <Bar dataKey="volume" fill="var(--accent-default)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
