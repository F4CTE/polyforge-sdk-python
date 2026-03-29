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
        <div className="text-sm text-[var(--color-pf-text-secondary)]">Loading builder stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-pf-text-tertiary)]">No builder data available</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">Builder Program</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-pf-warning" />
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Current Tier</span>
          </div>
          <div className="text-2xl font-bold text-[var(--color-pf-text)] capitalize">{stats.tier ?? 'N/A'}</div>
        </div>
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-pf-success" />
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Weekly Reward</span>
          </div>
          <div className="text-2xl font-bold text-[var(--color-pf-text)]">${stats.weeklyRewardUsdc ?? '0'}</div>
        </div>
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-pf-info" />
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Attributed Volume</span>
          </div>
          <div className="text-2xl font-bold text-[var(--color-pf-text)]">${Number(stats.attributedVolume ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Weekly History */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Hammer size={16} className="text-[var(--color-pf-cyan-500)]" />
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">Weekly History</h3>
        </div>
        {!stats.weekly || stats.weekly.length === 0 ? (
          <p className="text-sm text-[var(--color-pf-text-tertiary)]">No weekly data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Weekly builder history</caption>
              <thead>
                <tr className="border-b border-[var(--color-pf-border)]">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Week</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Volume</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Reward</th>
                </tr>
              </thead>
              <tbody>
                {stats.weekly.map((w) => (
                  <tr key={w.week} className="border-b border-[var(--color-pf-border)] last:border-0">
                    <td className="px-3 py-2.5 text-[var(--color-pf-text)]">{w.week}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]">
                      ${Number(w.volume).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-pf-success font-medium">
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
