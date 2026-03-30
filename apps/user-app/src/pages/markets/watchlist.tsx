import { useState, useEffect } from 'react';
import { Link } from 'react-router';

interface WatchedMarket {
  id: string;
  title: string;
  category?: string;
  image?: string;
  closed: boolean;
  volume24h: string;
  tokens?: Array<{ id: string; outcome: string; price: string }>;
  watchlistId: string;
  addedAt: string;
}

export function Component() {
  const [markets, setMarkets] = useState<WatchedMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = () => {
    setLoading(true);
    fetch('/api/v1/watchlist', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWatchlist(); }, []);

  const removeFromWatchlist = async (marketId: string) => {
    await fetch(`/api/v1/watchlist/${marketId}`, { method: 'DELETE', credentials: 'include' });
    setMarkets(prev => prev.filter(m => m.id !== marketId));
  };

  const yesPrice = (m: WatchedMarket) => {
    const yes = m.tokens?.find(t => t.outcome?.toUpperCase() === 'YES');
    return yes ? parseFloat(yes.price) : null;
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-pf-text">My Watchlist</h1>
            <p className="text-sm text-pf-text-secondary mt-0.5">{markets.length} markets</p>
          </div>
          <Link to="/markets" className="text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors">
            Browse Markets →
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-pf-text-muted text-sm">Loading watchlist...</div>
        ) : markets.length === 0 ? (
          <div className="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pf-text-muted mx-auto mb-3">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <p className="text-pf-text-secondary text-sm">No markets in your watchlist</p>
            <p className="text-pf-text-muted text-xs mt-1">Star any market to add it here</p>
            <Link to="/markets" className="mt-4 inline-block text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors">
              Browse Markets →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {markets.map(m => {
              const price = yesPrice(m);
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-pf border border-pf-border bg-pf-surface p-3 hover:border-pf-border-hover transition-colors group">
                  <Link to={`/markets/${m.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {m.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-border bg-pf-surface-elevated text-pf-text-muted flex-shrink-0">
                          {m.category}
                        </span>
                      )}
                      <span className={`text-[10px] flex-shrink-0 ${m.closed ? 'text-pf-danger' : 'text-pf-success'}`}>
                        {m.closed ? 'Closed' : 'Live'}
                      </span>
                    </div>
                    <p className="text-sm text-pf-text font-medium mt-0.5 truncate group-hover:text-pf-cyan-400 transition-colors">
                      {m.title}
                    </p>
                    <p className="text-xs text-pf-text-muted mt-0.5">
                      Vol: ${parseFloat(m.volume24h ?? '0').toLocaleString(undefined, { maximumFractionDigits: 0 })} · Added {new Date(m.addedAt).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {price !== null && (
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-pf-text">{(price * 100).toFixed(0)}¢</p>
                        <p className="text-[10px] text-pf-text-muted">YES</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFromWatchlist(m.id)}
                      className="p-1.5 rounded-pf text-amber-400 hover:text-pf-danger transition-colors"
                      title="Remove from watchlist"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
