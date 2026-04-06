import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { Library, GitFork, Star, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Collection {
  id: string;
  title: string;
  description: string;
  emoji: string;
  listingCount: number;
  totalVolume: string;
  avgWinRate: string;
  createdAt: string;
  coverListings: Array<{ id: string; title: string; seller: { username: string } }>;
}

interface Listing {
  id: string;
  title: string;
  description?: string;
  priceUsdc: string;
  winRate?: number;
  tradeCount?: number;
  forkCount: number;
  likeCount: number;
  seller: {
    username: string;
    displayName?: string;
  };
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function ListingSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="h-4 bg-pf-overlay rounded w-[60%]" />
      <div className="h-3 bg-pf-overlay rounded w-[90%]" />
      <div className="h-3 bg-pf-overlay rounded w-[75%]" />
      <div className="flex gap-2 mt-2">
        <div className="h-7 flex-1 bg-pf-overlay rounded" />
        <div className="h-7 flex-1 bg-pf-overlay rounded" />
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/v1/marketplace/collections/${id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setCollection(json.collection ?? null);
          setListings(json.listings ?? []);
        } else {
          toast.error('Failed to load collection');
        }
      } catch {
        toast.error('Failed to load collection');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        to="/collections"
        className="inline-flex items-center gap-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        All Collections
      </Link>

      {/* Header */}
      {loading ? (
        <div className="space-y-3 animate-shimmer">
          <div className="flex items-center gap-4">
            <div className="size-14 bg-pf-overlay rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-pf-overlay rounded w-[40%]" />
              <div className="h-4 bg-pf-overlay rounded w-[60%]" />
            </div>
          </div>
        </div>
      ) : collection ? (
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <span className="text-5xl leading-none shrink-0" role="img" aria-label={collection.title}>
            {collection.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-pf-text">{collection.title}</h1>
            <p className="text-sm text-pf-text-muted mt-1 max-w-prose">{collection.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-pf-text-secondary mt-3">
              <span className="flex items-center gap-1">
                <Library className="size-4" aria-hidden="true" />
                {collection.listingCount} strategies
              </span>
              <span className="flex items-center gap-1">
                <Star className="size-4" aria-hidden="true" />
                Avg win rate {collection.avgWinRate}%
              </span>
              <span>${collection.totalVolume} total volume</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
          <Library className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">Collection not found</p>
          <Link to="/collections" className="text-sm text-pf-cyan-400 hover:text-pf-cyan-300 mt-2">
            Back to all collections
          </Link>
        </div>
      )}

      {/* Strategy grid */}
      {(loading || listings.length > 0) && (
        <>
          <div className="border-t border-pf-border" />
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => <ListingSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(listing => (
                <div
                  key={listing.id}
                  className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-1 transition-all duration-pf-normal flex flex-col"
                >
                  {/* Seller */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-6 rounded-pf-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center text-pf-caption font-bold text-pf-cyan-400">
                      {(listing.seller.displayName ?? listing.seller.username).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-pf-text-secondary truncate">
                      {listing.seller.displayName ?? listing.seller.username}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-pf-text">
                      {Number(listing.priceUsdc) === 0 ? 'Free' : `$${Number(listing.priceUsdc).toFixed(2)}`}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="text-sm font-semibold text-pf-text mb-1 truncate">{listing.title}</div>

                  {/* Description */}
                  {listing.description && (
                    <div className="text-xs text-pf-text-muted line-clamp-2 mb-3">{listing.description}</div>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-2 text-pf-label text-pf-text-secondary mb-3">
                    {listing.winRate != null && <span>{listing.winRate}% win</span>}
                    {listing.tradeCount != null && <span>{listing.tradeCount} trades</span>}
                    <span className="flex items-center gap-1 ml-auto">
                      <GitFork className="size-3" aria-hidden="true" /> {listing.forkCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="size-3" aria-hidden="true" /> {listing.likeCount}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <Link
                      to={`/marketplace/${listing.id}`}
                      className="flex-1 text-center py-2 rounded-pf-sm text-xs font-medium border border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text transition-colors"
                    >
                      View
                    </Link>
                    <Link
                      to={`/marketplace/${listing.id}?action=fork`}
                      className="flex-1 text-center py-2 rounded-pf-sm text-xs font-medium border border-pf-cyan-500/40 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors flex items-center justify-center gap-1"
                    >
                      <GitFork className="size-3" aria-hidden="true" /> Fork
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && collection && listings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
          <Library className="size-9 text-pf-text-muted mb-3" aria-hidden="true" />
          <p className="text-pf-text font-medium">No strategies in this collection yet</p>
        </div>
      )}
    </div>
  );
}
