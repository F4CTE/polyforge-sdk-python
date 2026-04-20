import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Store, Star, ShoppingCart, Loader2, RefreshCw,
  GitFork, Filter, Search, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Button, Input } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Listing {
  id: string;
  title: string;
  description: string | null;
  priceUsdc: string;
  status: string;
  purchaseCount: number;
  avgRating: string | null;
  ratingCount: number;
  forkCount: number;
  tags: string[];
  createdAt: string;
  seller: { id: string; name: string; avatarUrl: string | null };
  strategy: { id: string; name: string; description: string | null };
}

type SortOption = 'newest' | 'popular' | 'rating' | 'price_asc' | 'price_desc';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function StarRating({ rating, count }: { rating: string | null; count: number }) {
  if (!rating || count === 0) return <span className="text-label text-tertiary">No reviews</span>;
  const n = parseFloat(rating);
  return (
    <span className="flex items-center gap-1">
      <Star className="size-3 fill-warning text-warning" />
      <span className="text-label text-primary font-medium">{n.toFixed(1)}</span>
      <span className="text-label text-tertiary">({count})</span>
    </span>
  );
}

function PriceTag({ price }: { price: string }) {
  const n = parseFloat(price);
  if (n === 0) return <span className="text-gain font-semibold text-body-md">Free</span>;
  return (
    <span className="font-mono text-body-md text-primary font-semibold">${n.toFixed(2)}</span>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('newest');
  const [tag, setTag] = useState('');
  const [search, setSearch] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'my-purchases'>('browse');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: '24' });
      if (tag) params.set('tag', tag);
      const res = await fetch(`/api/v1/marketplace?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setListings(data.items);
        setTotal(data.total);
      } else {
        toast.error('Failed to load marketplace');
      }
    } catch {
      toast.error('Failed to load marketplace');
    }
    setLoading(false);
  }, [sort, tag]);

  useEffect(() => { load(); }, [load]);

  async function purchase(listing: Listing) {
    setPurchasing(listing.id);
    try {
      const res = await fetch(`/api/v1/marketplace/${listing.id}/purchase`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Strategy forked to your account! (${data.forkedStrategyId.slice(0, 8)}…)`);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Purchase failed');
      }
    } catch {
      toast.error('Purchase failed');
    }
    setPurchasing(null);
  }

  const filtered = search
    ? listings.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.strategy.name.toLowerCase().includes(search.toLowerCase()) ||
          l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : listings;

  const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest',
    popular: 'Most Popular',
    rating: 'Top Rated',
    price_asc: 'Price ↑',
    price_desc: 'Price ↓',
  };

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <Store className="size-6 text-accent-text" />
            Strategy Marketplace
          </h1>
          <p className="text-body-sm text-secondary mt-1">
            Buy proven trading strategies from top forecasters — get a private fork you can customize.
          </p>
        </div>
        <Button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-body-sm text-secondary hover:text-primary hover:border-strong transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-default">
        {(['browse', 'my-purchases'] as const).map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-body-md font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-accent text-accent-text'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t === 'browse' ? 'Browse' : 'My Purchases'}
          </Button>
        ))}
      </div>

      {tab === 'my-purchases' ? (
        <MyPurchases />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary pointer-events-none" />
              <Input
                type="text"
                placeholder="Search strategies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-default rounded-pf text-body-md text-primary placeholder-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-tertiary" />
              <div className="flex gap-1">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="ghost"
                    onClick={() => setSort(s)}
                    className={`px-3 py-1 rounded-full text-label font-medium border transition-colors ${
                      sort === s
                        ? 'bg-accent-subtle text-accent-text border-accent/30'
                        : 'bg-elevated text-secondary border-default hover:border-strong'
                    }`}
                  >
                    {SORT_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            <span className="ml-auto text-label text-tertiary">
              {loading ? 'Loading…' : `${total} listing${total !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-52 bg-elevated border border-default rounded-pf animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="size-10 text-tertiary mb-3" />
              <p className="text-secondary text-body-sm">No listings found.</p>
              <p className="text-tertiary text-label mt-1">
                Try a different filter or check back later.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  purchasing={purchasing === listing.id}
                  onPurchase={() => purchase(listing)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Listing Card ───────────────────────────────────────────────────── */

function ListingCard({
  listing,
  purchasing,
  onPurchase,
}: {
  listing: Listing;
  purchasing: boolean;
  onPurchase: () => void;
}) {
  return (
    <div className="flex flex-col bg-elevated border border-default rounded-pf p-4 hover:border-strong transition-colors">
      {/* Title + seller */}
      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-body-md font-semibold text-primary line-clamp-2">{listing.title}</p>
        <p className="text-label text-tertiary">
          by <span className="text-secondary">{listing.seller.name}</span>
        </p>
        {listing.description && (
          <p className="text-label text-secondary line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
        )}
      </div>

      {/* Tags */}
      {listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {listing.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="px-2 py-1 bg-surface border border-default rounded text-caption text-tertiary"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-default/50">
        <StarRating rating={listing.avgRating} count={listing.ratingCount} />
        <span className="flex items-center gap-1 text-label text-tertiary">
          <GitFork className="size-3" />
          {listing.forkCount}
        </span>
        <span className="flex items-center gap-1 text-label text-tertiary ml-auto">
          <ShoppingCart className="size-3" />
          {listing.purchaseCount}
        </span>
      </div>

      {/* Price + action */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-default/50">
        <PriceTag price={listing.priceUsdc} />
        <Button
          type="button"
          onClick={onPurchase}
          disabled={purchasing}
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-accent text-inverse text-label font-medium hover:bg-accent-text disabled:opacity-50 transition-colors"
        >
          {purchasing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {parseFloat(listing.priceUsdc) === 0 ? 'Fork Free' : 'Purchase'}
        </Button>
      </div>
    </div>
  );
}

/* ─── My Purchases tab ───────────────────────────────────────────────── */

interface Purchase {
  id: string;
  priceUsdc: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    priceUsdc: string;
    seller: { name: string };
  };
}

function MyPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/marketplace/my/purchases', { credentials: 'include' });
        if (res.ok) setPurchases(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-elevated border border-default rounded-pf animate-pulse" />
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShoppingCart className="size-10 text-tertiary mb-3" />
        <p className="text-secondary text-body-sm">No purchases yet.</p>
        <p className="text-tertiary text-label mt-1">Browse the marketplace to find strategies.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between px-4 py-3 bg-elevated border border-default rounded-pf"
        >
          <div>
            <p className="text-body-md text-primary font-medium">{p.listing.title}</p>
            <p className="text-label text-tertiary">
              by {p.listing.seller.name} · {new Date(p.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className="font-mono text-body-md text-primary">
            {parseFloat(p.priceUsdc) === 0 ? 'Free' : `$${parseFloat(p.priceUsdc).toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
