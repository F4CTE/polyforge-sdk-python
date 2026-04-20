import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, X, BarChart3, Zap } from 'lucide-react';
import { useDelayedUnmount } from '@polyforge/ui/lib/use-delayed-unmount';

interface SearchResult {
  type: 'market' | 'strategy';
  id: string;
  title: string;
  sub?: string;
  href: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { mounted, visible } = useDelayedUnmount(open, 120);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const [mktRes, stratRes] = await Promise.all([
        fetch(`/api/v1/markets?search=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' }),
        fetch(`/api/v1/strategies?search=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' }),
      ]);
      const items: SearchResult[] = [];
      if (mktRes.ok) {
        const mkt = await mktRes.json();
        (mkt.data ?? []).forEach((m: { id: string; question: string; category?: string }) => {
          items.push({ type: 'market', id: m.id, title: m.question, sub: m.category ?? 'Market', href: `/markets/${m.id}` });
        });
      }
      if (stratRes.ok) {
        const strat = await stratRes.json();
        (strat.data ?? []).forEach((s: { id: string; name: string; status?: string }) => {
          items.push({ type: 'strategy', id: s.id, title: s.name, sub: s.status, href: `/strategies/${s.id}` });
        });
      }
      setResults(items);
      setActiveIndex(0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  function select(result: SearchResult) {
    navigate(result.href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) select(results[activeIndex]);
    else if (e.key === 'Escape') onClose();
  }

  if (!mounted) return null;

  const state = visible ? 'open' : 'closed';

  return (
    <div
      data-state={state}
      className="animate-backdrop fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        data-state={state}
        className="animate-dialog-content w-full max-w-sm sm:max-w-xl mx-4 bg-elevated border border-default rounded-pf shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-default">
          <Search className="size-4 text-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="cmd-palette-results"
            aria-activedescendant={results[activeIndex] ? `cmd-result-${results[activeIndex].type}-${results[activeIndex].id}` : undefined}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search markets and strategies"
            placeholder="Search markets, strategies..."
            className="flex-1 bg-transparent text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded text-label text-tertiary border border-default font-mono">
            Esc
          </kbd>
          <button type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-pf" aria-label="Close command palette">
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <div role="listbox" id="cmd-palette-results" aria-label="Search results" className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-body-sm text-tertiary motion-safe:animate-pulse">Searching...</div>
          )}
          {!loading && !query && (
            <div className="px-4 py-8 text-center">
              <p className="text-label text-tertiary">Type to search markets and strategies</p>
              <p className="text-label text-tertiary mt-1 opacity-60">
                <kbd className="px-1 py-1 rounded border border-default font-mono text-caption">↑↓</kbd> navigate ·{' '}
                <kbd className="px-1 py-1 rounded border border-default font-mono text-caption">Enter</kbd> open
              </p>
            </div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-body-sm text-tertiary">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((r, i) => (
            <button
              type="button"
              key={`${r.type}-${r.id}`}
              id={`cmd-result-${r.type}-${r.id}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => select(r)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                i === activeIndex ? 'bg-accent/10' : 'hover:bg-surface'
              }`}
            >
              <span className={`p-2 rounded-sm shrink-0 ${
                r.type === 'market' ? 'bg-accent/10 text-accent-text' : 'bg-category-subtle text-category-muted'
              }`}>
                {r.type === 'market' ? <BarChart3 className="size-4" /> : <Zap className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-body-md text-primary truncate">{r.title}</div>
                {r.sub && <div className="text-label text-tertiary capitalize">{r.sub}</div>}
              </div>
              <span className={`text-caption font-medium px-2 py-1 rounded shrink-0 ${
                r.type === 'market' ? 'bg-accent/10 text-accent-text' : 'bg-category-subtle text-category-muted'
              }`}>
                {r.type === 'market' ? 'Market' : 'Strategy'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
