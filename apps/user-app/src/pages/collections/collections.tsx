import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Library, ChevronRight } from 'lucide-react';
import { Button } from '@polyforge/ui';

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

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CollectionSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-5 space-y-3 animate-shimmer">
      <div className="flex items-center gap-3 mb-2">
        <div className="size-10 bg-overlay rounded-lg" />
        <div className="h-4 bg-overlay rounded w-[45%]" />
      </div>
      <div className="h-3 bg-overlay rounded w-[90%]" />
      <div className="h-3 bg-overlay rounded w-[70%]" />
      <div className="h-3 bg-overlay rounded w-[80%] mt-1" />
      <div className="flex gap-2 mt-2">
        <div className="h-5 w-20 bg-overlay rounded-full" />
        <div className="h-5 w-20 bg-overlay rounded-full" />
        <div className="h-5 w-20 bg-overlay rounded-full" />
      </div>
      <div className="h-8 bg-overlay rounded mt-2" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/marketplace/collections', {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setCollections(Array.isArray(json) ? json : (json.data ?? []));
        }
      } catch {
        // silently ignore — empty state will render
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Library className="size-6 text-accent-text" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Strategy Collections</h1>
          <p className="text-body-sm text-tertiary mt-1">Curated strategy bundles from the PolyForge team</p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => <CollectionSkeleton key={i} />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
          <Library className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">No collections yet</p>
          <p className="text-body-sm text-tertiary mt-1">The PolyForge team hasn't curated any collections yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {collections.map(col => (
            <div
              key={col.id}
              className="bg-elevated border border-default rounded-xl p-5 hover:border-strong transition-all duration-panel hover:shadow-sm flex flex-col"
            >
              {/* Emoji + Title */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl leading-none" role="img" aria-label={col.title}>
                  {col.emoji}
                </span>
                <div className="text-base font-semibold text-primary truncate">{col.title}</div>
              </div>

              {/* Description */}
              <p className="text-body-sm text-tertiary line-clamp-2 mb-3">{col.description}</p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-label text-secondary mb-3">
                <span>{col.listingCount} strategies</span>
                <span className="text-strong">|</span>
                <span>Avg win rate {col.avgWinRate}%</span>
                <span className="text-strong">|</span>
                <span>${col.totalVolume} total volume</span>
              </div>

              {/* Cover listing chips */}
              {col.coverListings.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {col.coverListings.slice(0, 3).map(listing => (
                    <span
                      key={listing.id}
                      className="px-2 py-1 rounded-full text-label bg-overlay text-secondary border border-default truncate max-w-[140px]"
                      title={listing.title}
                    >
                      {listing.title}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <Button
                type="button"
                onClick={() => navigate(`/collections/${col.id}`)}
                className="mt-auto flex items-center justify-center gap-2 w-full py-2 rounded-sm text-body-md font-medium border border-accent/40 text-accent-text hover:bg-accent/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
              >
                Browse Collection
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
