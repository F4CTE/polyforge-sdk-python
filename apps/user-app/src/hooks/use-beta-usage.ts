import { useState, useEffect } from 'react';

export interface BetaUsage {
  strategies: { used: number; limit: number };
  monthlyVolume: { usedUsdc: number; limitUsdc: number };
  positionSize: { maxUsdc: number };
  backtests: { runningOrQueued: number; maxConcurrent: number };
  marketplaceListings: { used: number; limit: number };
}

export interface UseBetaUsageResult {
  usage: BetaUsage | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

/**
 * Fetches the current user's beta usage vs. limits from the API.
 * All limit values come from the server so they automatically reflect
 * any env-config changes without a frontend deploy.
 */
export function useBetaUsage(): UseBetaUsageResult {
  const [usage, setUsage] = useState<BetaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/v1/settings/beta-usage', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('non-ok');
        return r.json() as Promise<BetaUsage>;
      })
      .then((data) => {
        if (!cancelled) {
          setUsage(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [rev]);

  return { usage, loading, error, refetch: () => setRev((n) => n + 1) };
}
