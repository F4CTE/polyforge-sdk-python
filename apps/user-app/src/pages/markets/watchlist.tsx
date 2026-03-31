import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { wsManager } from '@/lib/websocket';

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
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const prevPrices = useRef<Record<string, number>>({});

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

  // Subscribe to live prices for all watchlisted tokens
  useEffect(() => {
    if (!markets.length) return;
    const tokenIds: string[] = [];
    markets.forEach(m => {
      m.tokens?.forEach(t => tokenIds.push(t.id));
    });
    if (!tokenIds.length) return;
    wsManager.subscribePrices(tokenIds);
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type !== 'PRICE_UPDATE') return;
      const d = (msg.data && typeof msg.data === 'object') ? msg.data as Record<string, unknown> : msg;
      const tokenId = d.tokenId as string;
      const price = typeof d.price === 'number' ? d.price : parseFloat(String(d.price ?? '0'));
      if (!tokenId || isNaN(price)) return;
      setLivePrices(prev => {
        prevPrices.current[tokenId] = prev[tokenId] ?? price;
        return { ...prev, [tokenId]: price };
      });
    };
    wsManager.addListener(handler);
    return () => {
      wsManager.removeListener(handler);
      wsManager.unsubscribePrices(tokenIds);
    };
  }, [markets]);

  const yesPrice = (m: WatchedMarket): { price: number; live: boolean; prev: number | null } | null => {
    const yes = m.tokens?.find(t => t.outcome?.toUpperCase() === 'YES');
    if (!yes) return null;
    const live = livePrices[yes.id];
    if (live !== undefined) {
      return { price: live, live: true, prev: prevPrices.current[yes.id] ?? null };
    }
    return { price: parseFloat(yes.price), live: false, prev: null };
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
              const priceInfo = yesPrice(m);
              const priceDelta = priceInfo?.live && priceInfo.prev !== null
                ? priceInfo.price - priceInfo.prev
                : null;
              const deltaUp = priceDelta !== null && priceDelta > 0;
              const deltaDown = priceDelta !== null && priceDelta < 0;
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
                    {priceInfo !== null && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <p className={`text-sm font-mono font-semibold transition-colors ${
                            deltaUp ? 'text-pf-success' : deltaDown ? 'text-pf-danger' : 'text-pf-text'
                          }`}>
                            {(priceInfo.price * 100).toFixed(0)}¢
                          </p>
                          {priceDelta !== null && Math.abs(priceDelta) >= 0.001 && (
                            <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                              deltaUp ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                            }`}>
                              {deltaUp ? '▲' : '▼'}{Math.abs(priceDelta * 100).toFixed(1)}¢
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-pf-text-muted">
                          YES{priceInfo.live && <span className="ml-1 text-pf-cyan-400">●</span>}
                        </p>
                      </div>
                    )}
                    {!m.closed && (
                      <Link
                        to={`/markets/${m.id}`}
                        className="text-[11px] px-2 py-1 rounded-pf-sm bg-pf-cyan-500/10 text-pf-cyan-400 hover:bg-pf-cyan-500/20 transition-colors font-medium"
                        title="Trade this market"
                      >
                        Trade
                      </Link>
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
