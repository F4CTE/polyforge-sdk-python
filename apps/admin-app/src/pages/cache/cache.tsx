import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';
import { Database, Trash2, RefreshCw, Activity, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface CacheStats {
  hitRate: number;
  keyCount: number;
  memoryUsageMb: number;
  patterns: { pattern: string; keyCount: number; hitRate: number }[];
}

interface StreamGroup {
  name: unknown;
  consumers: number;
  pending: number;
}

interface StreamInfo {
  name: string;
  length: number;
  groups: StreamGroup[];
  error: boolean;
}

type CacheTab = 'cache' | 'streams';

export function Component() {
  const [tab, setTab] = useState<CacheTab>('cache');
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState('');
  const [flushing, setFlushing] = useState(false);
  const [confirmFlush, setConfirmFlush] = useState(false);

  const [streams, setStreams] = useState<StreamInfo[] | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);

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

  async function loadStreams() {
    setLoadingStreams(true);
    try {
      const res = await adminApi.streamStats();
      setStreams(res.streams);
    } catch {
      toast.error('Failed to load stream stats');
    } finally {
      setLoadingStreams(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'streams' && !streams) loadStreams();
  }, [tab]);

  function handleFlush() {
    if (!pattern.trim()) return;
    setConfirmFlush(true);
  }

  async function doFlush() {
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
      <div className="animate-fade-in space-y-6" role="status" aria-label="Loading cache statistics">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-elevated border border-default rounded-xl p-5 space-y-3">
              <div className="h-3 bg-app rounded w-20 animate-pulse" />
              <div className="h-6 bg-app rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-surface border border-default rounded-sm p-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTab('cache')}
            className={`px-3 py-2 text-body-sm rounded transition-colors ${tab === 'cache' ? 'bg-elevated text-primary font-medium' : 'text-secondary hover:text-primary'}`}
          >
            Cache
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTab('streams')}
            className={`px-3 py-2 text-body-sm rounded transition-colors ${tab === 'streams' ? 'bg-elevated text-primary font-medium' : 'text-secondary hover:text-primary'}`}
          >
            Streams
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={tab === 'cache' ? loadStats : loadStreams}
          className="flex items-center gap-2 px-3 py-2 text-body-sm rounded-sm border border-default text-secondary hover:bg-elevated transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* ═══ CACHE TAB ═══ */}
      {tab === 'cache' && (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-elevated border border-default rounded-xl p-4">
                <div className="text-label text-tertiary mb-1">Hit Rate</div>
                <div className="text-2xl font-semibold text-primary">
                  {((stats.hitRate ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-elevated border border-default rounded-xl p-4">
                <div className="text-label text-tertiary mb-1">Total Keys</div>
                <div className="text-2xl font-semibold text-primary">
                  {(stats.keyCount ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-elevated border border-default rounded-xl p-4">
                <div className="text-label text-tertiary mb-1">Memory Usage</div>
                <div className="text-2xl font-semibold text-primary">
                  {(stats.memoryUsageMb ?? 0).toFixed(1)} MB
                </div>
              </div>
            </div>
          )}

          <div className="bg-elevated border border-default rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 size={16} className="text-warning" aria-hidden="true" />
              <h3 className="text-heading font-semibold text-primary">Flush by Pattern</h3>
            </div>
            <div className="flex gap-3">
              <label htmlFor="cache-pattern" className="sr-only">Cache key pattern</label>
              <Input
                id="cache-pattern"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. user:*, strategy:abc*"
                className="flex-1 px-3 py-2 text-body-sm rounded-sm border border-default bg-app text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 font-mono"
              />
              <Button
                type="button"
                variant="danger"
                onClick={handleFlush}
                disabled={flushing || !pattern.trim()}
                className="px-4 py-2 text-body-sm rounded-sm bg-warning text-primary hover:bg-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {flushing ? 'Flushing...' : 'Flush'}
              </Button>
            </div>
          </div>

          {stats && stats.patterns && stats.patterns.length > 0 && (
            <div className="bg-elevated border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Database size={16} className="text-accent" aria-hidden="true" />
                <h3 className="text-heading font-semibold text-primary">Cache Patterns</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm" aria-label="Cache entries">
                  <caption className="sr-only">Cache patterns</caption>
                  <thead>
                    <tr className="border-b border-default">
                      <th scope="col" className="text-left px-3 py-2 text-label font-medium text-tertiary uppercase">Pattern</th>
                      <th scope="col" className="text-right px-3 py-2 text-label font-medium text-tertiary uppercase">Keys</th>
                      <th scope="col" className="text-right px-3 py-2 text-label font-medium text-tertiary uppercase">Hit Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.patterns.map((p) => (
                      <tr key={p.pattern} className="border-b border-default last:border-0">
                        <td className="px-3 py-3 font-mono text-label text-primary">{p.pattern}</td>
                        <td className="px-3 py-3 text-right text-secondary">{p.keyCount.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-secondary">{(p.hitRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ STREAMS TAB ═══ */}
      {tab === 'streams' && (
        <>
          {loadingStreams ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-elevated border border-default rounded-xl p-4 animate-pulse h-20" />
              ))}
            </div>
          ) : streams ? (
            <div className="space-y-3">
              {streams.map((s) => (
                <div key={s.name} className="bg-elevated border border-default rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {s.error
                        ? <AlertCircle size={14} className="text-warning" />
                        : <Activity size={14} className="text-gain" />
                      }
                      <span className="font-mono text-body-sm text-primary">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-caption text-tertiary">
                        {s.error ? 'stream empty or not found' : `${s.length.toLocaleString()} entries`}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-caption font-medium ${
                        s.error ? 'bg-warning/10 text-warning' : 'bg-gain/10 text-gain'
                      }`}>
                        {s.error ? 'empty' : 'active'}
                      </span>
                    </div>
                  </div>
                  {!s.error && s.groups.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {s.groups.map((g, gi) => (
                        <div key={gi} className="bg-app border border-default rounded-sm p-3">
                          <p className="font-mono text-label text-primary truncate">{String(g.name)}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-caption text-tertiary">{g.consumers} consumer{g.consumers !== 1 ? 's' : ''}</span>
                            <span className={`text-caption font-medium ${g.pending > 0 ? 'text-warning' : 'text-gain'}`}>
                              {g.pending} pending
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!s.error && s.groups.length === 0 && (
                    <p className="text-caption text-tertiary">No consumer groups</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>

    <ConfirmDialog
      open={confirmFlush}
      title="Flush cache keys?"
      description={`This will flush all cache keys matching "${pattern}". This cannot be undone.`}
      confirmationText={pattern}
      destructiveLabel="Flush cache"
      isLoading={flushing}
      onConfirm={() => { setConfirmFlush(false); doFlush(); }}
      onCancel={() => setConfirmFlush(false)}
    />
    </>
  );
}
