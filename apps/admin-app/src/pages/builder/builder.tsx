import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Hammer, TrendingUp, Award, DollarSign } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface BuilderStats {
  tier: string;
  weeklyRewardUsdc: string;
  attributedVolume: string;
  weekly: { week: string; volume: string; reward: string }[];
}

export function Component() {
  const [stats, setStats] = useState<BuilderStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminApi.builderStats();
        setStats(res as unknown as BuilderStats);
      } catch {
        toast.error('Failed to load builder stats');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-primary">Builder Program</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-elevated border border-default rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-warning" aria-hidden="true" />
            <span className="text-label text-tertiary">Current Tier</span>
          </div>
          <div className="text-2xl font-semibold text-primary capitalize">{stats.tier ?? 'N/A'}</div>
        </div>
        <div className="bg-elevated border border-default rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-gain" aria-hidden="true" />
            <span className="text-label text-tertiary">Weekly Reward</span>
          </div>
          <div className="text-2xl font-semibold text-primary">${stats.weeklyRewardUsdc ?? '0'}</div>
        </div>
        <div className="bg-elevated border border-default rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-info" aria-hidden="true" />
            <span className="text-label text-tertiary">Attributed Volume</span>
          </div>
          <div className="text-2xl font-semibold text-primary">${Number(stats.attributedVolume ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Weekly History */}
      <div className="bg-elevated border border-default rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Hammer size={16} className="text-accent" aria-hidden="true" />
          <h3 className="text-body-md font-semibold text-primary">Weekly History</h3>
        </div>
        {!stats.weekly || stats.weekly.length === 0 ? (
          <p className="text-body-sm text-tertiary">No weekly data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm" aria-label="Strategy builder blocks">
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
