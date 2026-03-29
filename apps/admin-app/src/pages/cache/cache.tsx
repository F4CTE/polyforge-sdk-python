import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface CacheStats {
  hitRate: number;
  keyCount: number;
  memoryUsageMb: number;
  patterns: { pattern: string; keyCount: number; hitRate: number }[];
}

export function Component() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState('');
  const [flushing, setFlushing] = useState(false);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await adminApi.cacheStats();
      setStats(res as unknown as CacheStats);
    } catch {
      toast.error('Failed to load cache stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function handleFlush() {
    if (!pattern.trim()) return;
    if (!window.confirm(`Are you sure you want to flush cache keys matching "${pattern}"?`)) return;
    setFlushing(true);
    try {
      const res = await adminApi.cacheFlush(pattern);
      toast.success(`Flushed ${res.keysDeleted} keys`);
      setPattern('');
      loadStats();
    } catch {
      toast.error('Failed to flush cache');
    } finally {
      setFlushing(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5 space-y-3">
              <div className="h-3 bg-[var(--color-pf-bg)] rounded w-20 animate-pulse" />
              <div className="h-6 bg-[var(--color-pf-bg)] rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
          <div className="h-4 bg-[var(--color-pf-bg)] rounded w-32 animate-pulse mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-[var(--color-pf-bg)] rounded animate-pulse mb-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">Cache</h2>
        <button type="button"
          onClick={loadStats}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-elevated)] cursor-pointer transition-colors"
          aria-label="Refresh cache stats"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
            <div className="text-xs text-[var(--color-pf-text-tertiary)] mb-1">Hit Rate</div>
            <div className="text-2xl font-bold text-[var(--color-pf-text)]">
              {((stats.hitRate ?? 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
            <div className="text-xs text-[var(--color-pf-text-tertiary)] mb-1">Total Keys</div>
            <div className="text-2xl font-bold text-[var(--color-pf-text)]">
              {(stats.keyCount ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4">
            <div className="text-xs text-[var(--color-pf-text-tertiary)] mb-1">Memory Usage</div>
            <div className="text-2xl font-bold text-[var(--color-pf-text)]">
              {(stats.memoryUsageMb ?? 0).toFixed(1)} MB
            </div>
          </div>
        </div>
      )}

      {/* Flush */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 size={16} className="text-pf-warning" />
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">Flush by Pattern</h3>
        </div>
        <div className="flex gap-3">
          <label htmlFor="cache-pattern" className="sr-only">Cache key pattern</label>
          <input
            id="cache-pattern"
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. user:*, strategy:abc*"
            className="flex-1 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] font-mono"
          />
          <button type="button"
            onClick={handleFlush}
            disabled={flushing || !pattern.trim()}
            className="px-4 py-2 text-sm rounded-pf-sm bg-pf-warning text-white hover:bg-pf-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {flushing ? 'Flushing...' : 'Flush'}
          </button>
        </div>
      </div>

      {/* Patterns Table */}
      {stats && stats.patterns && stats.patterns.length > 0 && (
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-[var(--color-pf-cyan-500)]" />
            <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">Cache Patterns</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Cache patterns</caption>
              <thead>
                <tr className="border-b border-[var(--color-pf-border)]">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Pattern</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Keys</th>
                  <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.patterns.map((p) => (
                  <tr key={p.pattern} className="border-b border-[var(--color-pf-border)] last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-pf-text)]">{p.pattern}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]">{p.keyCount.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]">{(p.hitRate * 100).toFixed(1)}%</td>
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
