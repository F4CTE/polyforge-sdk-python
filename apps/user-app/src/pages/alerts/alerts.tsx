import { useState, useEffect, useRef } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface AlertToken {
  id: string;
  outcome: string;
  price: string;
}

interface MarketResult {
  id: string;
  title: string;
  question?: string;
  tokens: AlertToken[];
}

interface PriceAlert {
  id: string;
  tokenId: string;
  direction: 'above' | 'below';
  price: string;
  persistent: boolean;
  triggered: boolean;
  createdAt: string;
  market?: {
    title?: string;
    question?: string;
  };
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const upper = outcome.toUpperCase();
  if (upper === 'YES') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-success/30 bg-pf-success/10 text-pf-success font-semibold">
        YES
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-danger/30 bg-pf-danger/10 text-pf-danger font-semibold">
      NO
    </span>
  );
}

export function Component() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Market search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketResult | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('0.50');
  const [persistent, setPersistent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark onboarding alert step as visited
  useEffect(() => {
    try { localStorage.setItem('pf-onboarding-alert-visited', 'true'); } catch { /* ignore */ }
  }, []);

  // Fetch existing alerts
  useEffect(() => {
    fetch('/api/v1/alerts', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  // Market search debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/markets?q=${encodeURIComponent(query.trim())}&limit=8`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const markets: MarketResult[] = Array.isArray(data) ? data : (data.markets ?? []);
          setSearchResults(markets);
          setShowDropdown(markets.length > 0);
        }
      } catch {
        // ignore search errors
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectMarket(market: MarketResult) {
    setSelectedMarket(market);
    setQuery(market.title);
    setShowDropdown(false);
    // Default to YES token if available
    const yes = market.tokens.find(t => t.outcome.toUpperCase() === 'YES');
    setSelectedTokenId(yes?.id ?? market.tokens[0]?.id ?? '');
  }

  function resetForm() {
    setQuery('');
    setSearchResults([]);
    setSelectedMarket(null);
    setSelectedTokenId('');
    setDirection('above');
    setPrice('0.50');
    setPersistent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTokenId) {
      toast.error('Select a market and outcome first');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0.01 || priceNum > 0.99) {
      toast.error('Price must be between 0.01 and 0.99');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: selectedTokenId, direction, price, persistent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? 'Failed to create alert');
      }
      const created: PriceAlert = await res.json();
      setAlerts(prev => [created, ...prev]);
      toast.success('Alert created');
      resetForm();
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAlert(id: string) {
    // Optimistic removal
    setAlerts(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/v1/alerts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Alert removed');
    } catch {
      toast.error('Failed to remove alert');
      // Re-fetch to restore state
      fetch('/api/v1/alerts', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : []))
        .then(setAlerts)
        .catch(() => {});
    }
  }

  const yesNoTokens = selectedMarket?.tokens.filter(
    t => t.outcome.toUpperCase() === 'YES' || t.outcome.toUpperCase() === 'NO'
  ) ?? [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-pf-text">Price Alerts</h1>
            <p className="text-sm text-pf-text-secondary mt-0.5">
              {loading ? '...' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setFormOpen(v => !v); if (formOpen) resetForm(); }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-pf-sm bg-pf-cyan-500/10 text-pf-cyan-400 hover:bg-pf-cyan-500/20 transition-colors font-medium"
          >
            <span className="text-base leading-none">＋</span>
            New Alert
          </button>
        </div>

        {/* Create form (collapsible) */}
        {formOpen && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-pf border border-pf-border bg-pf-surface p-4 space-y-4 animate-fade-in"
          >
            {/* Market search */}
            <div className="space-y-1" ref={searchRef}>
              <label className="block text-xs font-medium text-pf-text-secondary uppercase tracking-wide">
                Market
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    if (selectedMarket && e.target.value !== selectedMarket.title) {
                      setSelectedMarket(null);
                      setSelectedTokenId('');
                    }
                  }}
                  placeholder="Search markets..."
                  className="w-full bg-pf-elevated border border-pf-border rounded-pf-sm px-3 py-2 text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:ring-1 focus:ring-pf-cyan-500/50"
                />
                {showDropdown && (
                  <div className="absolute z-20 w-full top-full mt-1 rounded-pf border border-pf-border bg-pf-elevated shadow-lg overflow-hidden">
                    {searchResults.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => selectMarket(m)}
                        className="w-full text-left px-3 py-2 text-sm text-pf-text hover:bg-pf-surface transition-colors truncate"
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* YES / NO token selector */}
            {selectedMarket && yesNoTokens.length > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-pf-text-secondary uppercase tracking-wide">
                  Outcome
                </label>
                <div className="flex gap-2">
                  {yesNoTokens.map(t => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-pf-sm border cursor-pointer text-sm transition-colors ${
                        selectedTokenId === t.id
                          ? t.outcome.toUpperCase() === 'YES'
                            ? 'border-pf-success/50 bg-pf-success/10 text-pf-success'
                            : 'border-pf-danger/50 bg-pf-danger/10 text-pf-danger'
                          : 'border-pf-border text-pf-text-secondary hover:border-pf-border-hover'
                      }`}
                    >
                      <input
                        type="radio"
                        name="token"
                        value={t.id}
                        checked={selectedTokenId === t.id}
                        onChange={() => setSelectedTokenId(t.id)}
                        className="sr-only"
                      />
                      <span className="font-semibold">{t.outcome.toUpperCase()}</span>
                      <span className="text-xs font-mono opacity-70">
                        {(parseFloat(t.price) * 100).toFixed(0)}¢
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Direction + price row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-pf-text-secondary uppercase tracking-wide">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={e => setDirection(e.target.value as 'above' | 'below')}
                  className="w-full bg-pf-elevated border border-pf-border rounded-pf-sm px-3 py-2 text-sm text-pf-text focus:outline-none focus:ring-1 focus:ring-pf-cyan-500/50"
                >
                  <option value="above">Price rises above</option>
                  <option value="below">Price falls below</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-pf-text-secondary uppercase tracking-wide">
                  Price threshold
                </label>
                <input
                  type="number"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-pf-elevated border border-pf-border rounded-pf-sm px-3 py-2 text-sm text-pf-text font-mono focus:outline-none focus:ring-1 focus:ring-pf-cyan-500/50"
                />
              </div>
            </div>

            {/* Persistent toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={persistent}
                onChange={e => setPersistent(e.target.checked)}
                className="w-4 h-4 rounded border-pf-border accent-pf-cyan-500"
              />
              <span className="text-sm text-pf-text-secondary">Keep alerting after trigger</span>
            </label>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !selectedTokenId}
                className="px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-pf-bg text-sm font-semibold hover:bg-pf-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </form>
        )}

        {/* Alerts list */}
        {loading ? (
          <div className="text-center py-12 text-pf-text-muted text-sm">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={40} strokeWidth={1.25} className="text-pf-text-muted mx-auto mb-3" />
            <p className="text-pf-text-secondary text-sm font-medium">No active alerts</p>
            <p className="text-pf-text-muted text-xs mt-1">
              Set a price target on any market to get notified
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => {
              const title = alert.market?.title ?? alert.market?.question ?? alert.tokenId;
              const priceNum = parseFloat(alert.price);
              const priceCents = isNaN(priceNum) ? '—' : `${(priceNum * 100).toFixed(0)}¢`;
              const created = new Date(alert.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              // Infer outcome from tokenId suffix heuristic or fall back to id display
              // We don't have outcome in the API response directly; show price arrow + threshold only
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-pf border border-pf-border bg-pf-surface px-3 py-2.5 hover:border-pf-border-hover transition-colors"
                >
                  {/* Direction arrow */}
                  <span
                    className={`text-base leading-none shrink-0 ${
                      alert.direction === 'above' ? 'text-pf-success' : 'text-pf-danger'
                    }`}
                    aria-label={alert.direction === 'above' ? 'above' : 'below'}
                  >
                    {alert.direction === 'above' ? '▲' : '▼'}
                  </span>

                  {/* Market + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-pf-text font-medium truncate" title={title}>
                      {title}
                    </p>
                    <p className="text-xs text-pf-text-muted mt-0.5">
                      {alert.direction === 'above' ? 'Rises above' : 'Falls below'}{' '}
                      <span className="font-mono font-semibold text-pf-text">{priceCents}</span>
                      {' · '}{created}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {alert.triggered ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold">
                        Triggered
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-cyan-500/30 bg-pf-cyan-500/10 text-pf-cyan-400 font-semibold">
                        Active
                      </span>
                    )}
                    {alert.persistent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-border bg-pf-elevated text-pf-text-muted font-medium">
                        Persistent
                      </span>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-danger transition-colors shrink-0"
                    aria-label="Delete alert"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
