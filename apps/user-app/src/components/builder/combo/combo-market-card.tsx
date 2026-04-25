import { memo, useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
// ─── Types ────────────────────────────────────────────────────────────────────
// Note: snake_case fields match raw Kalshi REST API JSON (see KalshiComboCollection
// in @polyforge/shared-types for the canonical definition).
interface ComboCollection {
  collection_ticker: string;
  title: string;
  category: string;
  status: string;
  markets_count: number;
  series_ticker?: string;
}

interface LookupResult {
  event_ticker: string;
  market_ticker: string;
}

interface ComboMarketCardProps {
  /** Current resolved market ticker (controlled). Empty string means unset. */
  value: string;
  onConfirm: (marketTicker: string) => void;
  onCancel: () => void;
}

type Phase = 'browse' | 'detail' | 'confirm';

interface LegSelection {
  ticker: string;
  title: string;
  outcome: 'yes' | 'no';
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:  'bg-gain/15 text-gain border-gain/25',
  settled: 'bg-info/15 text-info border-info/25',
  expired: 'bg-tertiary/10 text-tertiary border-subtle',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.expired;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-caption font-medium border ${cls}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

// ─── Collection list item ─────────────────────────────────────────────────────

interface CollectionRowProps {
  collection: ComboCollection;
  isSelected: boolean;
  onSelect: (c: ComboCollection) => void;
}

function CollectionRow({ collection, isSelected, onSelect }: CollectionRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(collection)}
      className={`w-full text-left px-3 py-2.5 rounded-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        isSelected
          ? 'bg-accent/10 border border-accent/25'
          : 'hover:bg-elevated border border-transparent'
      }`}
      aria-pressed={isSelected}
      aria-label={`Select ${collection.title}`}
    >
      <Layers className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-label font-medium text-primary truncate">{collection.title}</p>
        <p className="text-caption text-tertiary truncate">{collection.category} · {collection.markets_count} markets</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={collection.status} />
        <ChevronRight className="size-3 text-tertiary" aria-hidden="true" />
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ComboMarketCardInner({ value, onConfirm, onCancel }: ComboMarketCardProps) {
  const [phase, setPhase] = useState<Phase>(value ? 'confirm' : 'browse');
  const [collections, setCollections] = useState<ComboCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const [selectedCollection, setSelectedCollection] = useState<ComboCollection | null>(null);
  const [legs, setLegs] = useState<LegSelection[]>([]);
  const [legOpen, setLegOpen] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resolvedTicker, setResolvedTicker] = useState<string>(value);

  // ── Fetch collections on browse phase ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'browse') return;
    setLoadingCollections(true);
    setCollectionError(null);
    fetch('/api/v1/markets/combo/collections', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((res: { collections: ComboCollection[] }) => {
        setCollections(res.collections ?? []);
      })
      .catch((err: unknown) => {
        setCollectionError(err instanceof Error ? err.message : 'Failed to load collections');
      })
      .finally(() => setLoadingCollections(false));
  }, [phase]);

  // ── Select a collection → detail phase ───────────────────────────────────
  const handleSelectCollection = useCallback((c: ComboCollection) => {
    setSelectedCollection(c);
    // Initialise legs with default 'yes' outcome for each leg slot.
    // The backend returns leg detail via GET /collections/:ticker but
    // we optimistically seed empty legs; the user fills in the outcome.
    setLegs([]);
    setLookupError(null);
    setPhase('detail');
  }, []);

  // ── Add / toggle a leg ───────────────────────────────────────────────────
  const handleLegOutcomeChange = useCallback((ticker: string, title: string, outcome: 'yes' | 'no') => {
    setLegs((prev) => {
      const existing = prev.findIndex((l) => l.ticker === ticker);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = { ticker, title, outcome };
        return updated;
      }
      return [...prev, { ticker, title, outcome }];
    });
  }, []);

  const handleRemoveLeg = useCallback((ticker: string) => {
    setLegs((prev) => prev.filter((l) => l.ticker !== ticker));
  }, []);

  // ── Lookup — resolve legs → market ticker ─────────────────────────────────
  const handleLookup = useCallback(async () => {
    if (!selectedCollection || legs.length === 0) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/v1/markets/combo/lookup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionTicker: selectedCollection.collection_ticker,
          legs: legs.map((l) => ({ ticker: l.ticker, outcome: l.outcome })),
        }),
      });
      if (res.status === 404) throw new Error('No market found for these leg selections');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LookupResult = await res.json();
      setResolvedTicker(data.market_ticker);
      setPhase('confirm');
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }, [selectedCollection, legs]);

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (resolvedTicker) onConfirm(resolvedTicker);
  }, [resolvedTicker, onConfirm]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="combo-market-card w-full rounded-sm border border-subtle bg-surface overflow-hidden"
      role="region"
      aria-label="Combo market selector"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-subtle bg-elevated">
        <div className="flex items-center gap-2">
          {phase !== 'browse' && (
            <button
              type="button"
              onClick={() => {
                if (phase === 'confirm' && resolvedTicker) {
                  setPhase('detail');
                } else {
                  setPhase('browse');
                  setSelectedCollection(null);
                  setLegs([]);
                }
              }}
              className="p-0.5 rounded hover:bg-surface text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Go back"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <Layers className="size-3.5 text-accent" aria-hidden="true" />
          <span className="text-label font-medium text-primary">
            {phase === 'browse' && 'Combo Collections'}
            {phase === 'detail' && (selectedCollection?.title ?? 'Collection Detail')}
            {phase === 'confirm' && 'Resolved Ticker'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-0.5 rounded hover:bg-loss/20 text-tertiary hover:text-loss transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label="Cancel"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* ── Browse phase ── */}
      {phase === 'browse' && (
        <div className="p-2 space-y-1 max-h-52 overflow-y-auto" aria-live="polite">
          {loadingCollections && (
            <div className="flex items-center justify-center py-6 gap-2 text-tertiary text-label">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading collections…
            </div>
          )}
          {collectionError && !loadingCollections && (
            <div className="flex items-center gap-2 px-3 py-2 text-loss text-label" role="alert">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {collectionError}
            </div>
          )}
          {!loadingCollections && !collectionError && collections.length === 0 && (
            <p className="text-center text-caption text-tertiary py-4">No combo collections available</p>
          )}
          {!loadingCollections && collections.map((c) => (
            <CollectionRow
              key={c.collection_ticker}
              collection={c}
              isSelected={selectedCollection?.collection_ticker === c.collection_ticker}
              onSelect={handleSelectCollection}
            />
          ))}
        </div>
      )}

      {/* ── Detail phase — leg builder ── */}
      {phase === 'detail' && selectedCollection && (
        <div className="p-3 space-y-3">
          {/* Collection meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={selectedCollection.status} />
            <span className="text-caption text-tertiary">{selectedCollection.markets_count} markets</span>
            {selectedCollection.series_ticker && (
              <span className="text-caption text-tertiary font-mono">{selectedCollection.series_ticker}</span>
            )}
          </div>

          {/* Legs section */}
          <div>
            <button
              type="button"
              onClick={() => setLegOpen((v) => !v)}
              className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-tertiary hover:text-primary transition-colors focus-visible:outline-none"
              aria-expanded={legOpen}
              aria-controls="combo-legs-panel"
            >
              {legOpen
                ? <ChevronDown className="size-3" aria-hidden="true" />
                : <ChevronRight className="size-3" aria-hidden="true" />}
              Leg selections ({legs.length})
            </button>

            {legOpen && (
              <div id="combo-legs-panel" className="mt-2 space-y-1.5">
                {legs.length === 0 && (
                  <p className="text-caption text-tertiary italic">No legs added yet. Use the fields below to add legs.</p>
                )}
                {legs.map((leg) => (
                  <div key={leg.ticker} className="flex items-center gap-2 px-2 py-1.5 rounded-sm bg-elevated border border-subtle">
                    <span className="text-label text-primary flex-1 truncate font-mono text-caption">{leg.ticker}</span>
                    <span className={`text-caption font-semibold ${leg.outcome === 'yes' ? 'text-gain' : 'text-loss'}`}>
                      {leg.outcome.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLeg(leg.ticker)}
                      className="p-0.5 rounded hover:bg-loss/20 text-tertiary hover:text-loss transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      aria-label={`Remove leg ${leg.ticker}`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline leg adder */}
          <LegAdder onAdd={handleLegOutcomeChange} existingTickers={legs.map((l) => l.ticker)} />

          {lookupError && (
            <div className="flex items-center gap-2 text-loss text-label" role="alert">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {lookupError}
            </div>
          )}

          <button
            type="button"
            onClick={handleLookup}
            disabled={legs.length === 0 || lookupLoading}
            className="w-full py-1.5 rounded-sm text-label font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 flex items-center justify-center gap-2"
            aria-disabled={legs.length === 0 || lookupLoading}
          >
            {lookupLoading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Resolve Ticker
          </button>
        </div>
      )}

      {/* ── Confirm phase ── */}
      {phase === 'confirm' && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2 px-2 py-2 rounded-sm bg-gain/10 border border-gain/20">
            <CheckCircle2 className="size-4 text-gain shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-caption text-tertiary">Resolved ticker</p>
              <p className="text-label font-mono text-primary truncate">{resolvedTicker}</p>
            </div>
          </div>

          {selectedCollection && legs.length > 0 && (
            <div className="space-y-1">
              <p className="text-caption font-semibold uppercase tracking-wider text-tertiary">Legs</p>
              {legs.map((leg) => (
                <div key={leg.ticker} className="flex items-center gap-2 text-caption">
                  <span className="text-tertiary font-mono truncate flex-1">{leg.ticker}</span>
                  <span className={`font-semibold ${leg.outcome === 'yes' ? 'text-gain' : 'text-loss'}`}>
                    {leg.outcome.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-1.5 rounded-sm text-label font-medium bg-accent text-white hover:bg-accent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Use this market
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Leg adder sub-component ─────────────────────────────────────────────────

interface LegAdderProps {
  onAdd: (ticker: string, title: string, outcome: 'yes' | 'no') => void;
  existingTickers: string[];
}

function LegAdder({ onAdd, existingTickers }: LegAdderProps) {
  const [ticker, setTicker] = useState('');
  const [title, setTitle] = useState('');
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');

  const isDuplicate = existingTickers.includes(ticker.trim());
  const canAdd = ticker.trim().length > 0 && !isDuplicate;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(ticker.trim(), title.trim() || ticker.trim(), outcome);
    setTicker('');
    setTitle('');
    setOutcome('yes');
  };

  return (
    <div className="space-y-1.5 border-t border-subtle pt-2">
      <p className="text-caption font-semibold uppercase tracking-wider text-tertiary">Add Leg</p>
      <input
        type="text"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Market ticker (e.g. KXNBA-25)"
        aria-label="Leg market ticker"
        className={`w-full px-2 py-1 text-label bg-surface border rounded-sm placeholder:text-tertiary/50 focus-visible:outline-none transition-colors font-mono ${
          isDuplicate ? 'border-loss/40 bg-loss-subtle' : 'border-subtle focus-visible:border-accent/50'
        }`}
      />
      {isDuplicate && (
        <p className="text-caption text-loss">This ticker is already added</p>
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Label (optional)"
        aria-label="Leg label"
        className="w-full px-2 py-1 text-label bg-surface border border-subtle rounded-sm placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
      />
      <div className="flex gap-2">
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as 'yes' | 'no')}
          aria-label="Leg outcome"
          className="flex-1 px-2 py-1 text-label bg-surface border border-subtle rounded-sm focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
        >
          <option value="yes">YES</option>
          <option value="no">NO</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="px-3 py-1 rounded-sm text-label font-medium bg-elevated border border-subtle hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-disabled={!canAdd}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export const ComboMarketCard = memo(ComboMarketCardInner);
