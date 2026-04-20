import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, Textarea } from '@polyforge/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Star,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Listing {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELISTED';
  featured: boolean;
  seller: { id: string; username: string; displayName: string | null };
  strategy: { id: string; name: string; winRate?: string; tradeCount?: number };
  createdAt: string;
  reviewedAt?: string;
  adminNote?: string;
  purchaseCount: number;
  forkCount: number;
  avgRating?: string;
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELISTED' | 'ALL';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Delisted', value: 'DELISTED' },
  { label: 'All', value: 'ALL' },
];

function statusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-warning/10 text-warning';
    case 'APPROVED': return 'bg-gain/10 text-gain';
    case 'REJECTED': return 'bg-loss/10 text-loss';
    case 'DELISTED': return 'bg-tertiary/10 text-tertiary';
    default: return 'bg-elevated text-secondary';
  }
}

function SkeletonCard() {
  return (
    <div className="bg-elevated border border-default rounded-pf p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-2/3 bg-surface rounded-sm" />
        <div className="h-5 w-20 bg-surface rounded-full" />
      </div>
      <div className="h-4 w-full bg-surface rounded-sm" />
      <div className="h-4 w-4/5 bg-surface rounded-sm" />
      <div className="h-4 w-1/2 bg-surface rounded-sm" />
      <div className="flex gap-4">
        <div className="h-4 w-16 bg-surface rounded-sm" />
        <div className="h-4 w-16 bg-surface rounded-sm" />
        <div className="h-4 w-16 bg-surface rounded-sm" />
      </div>
    </div>
  );
}

interface ListingCardProps {
  listing: Listing;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  onDelist: (id: string) => void;
  onToggleFeatured: (id: string, current: boolean) => void;
  actionLoading: string | null;
}

function ListingCard({ listing, onApprove, onReject, onDelist, onToggleFeatured, actionLoading }: ListingCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const isBusy = actionLoading === listing.id;

  const price = parseFloat(listing.priceUsdc ?? '0').toFixed(2);
  const winRate = listing.strategy.winRate ? `${parseFloat(listing.strategy.winRate).toFixed(1)}%` : '—';
  const tradeCount = listing.strategy.tradeCount ?? '—';
  const avgRating = listing.avgRating ? parseFloat(listing.avgRating).toFixed(1) : '—';

  function handleRejectConfirm() {
    onReject(listing.id, adminNote);
    setRejectOpen(false);
    setAdminNote('');
  }

  return (
    <div className="bg-elevated border border-default rounded-pf p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFeatured(listing.id, listing.featured)}
            disabled={isBusy}
            aria-label={listing.featured ? `Remove featured from ${listing.title}` : `Feature listing ${listing.title}`}
            aria-pressed={listing.featured}
            className="shrink-0 p-1 rounded-sm transition-colors hover:bg-app disabled:opacity-50"
          >
            <Star
              size={15}
              aria-hidden="true"
              className={listing.featured ? 'text-warning fill-warning' : 'text-tertiary'}
            />
          </Button>
          <span className="font-semibold text-primary truncate">{listing.title}</span>
        </div>
        <span className="shrink-0 text-label font-medium bg-accent/10 text-accent-text px-2 py-1 rounded-full whitespace-nowrap">
          ${price} USDC
        </span>
      </div>

      {/* Description */}
      <p className="text-body-sm text-secondary line-clamp-2">{listing.description}</p>

      {/* Meta row */}
      <div className="text-label text-tertiary flex flex-wrap gap-x-4 gap-y-1">
        <span>Seller: <span className="text-secondary">@{listing.seller.username}</span></span>
        <span>Strategy: <span className="text-secondary">{listing.strategy.name}</span></span>
        <span>Win Rate: <span className="text-secondary">{winRate}</span></span>
        <span>Trades: <span className="text-secondary">{tradeCount}</span></span>
      </div>

      {/* Stats row */}
      <div className="text-label text-tertiary flex gap-4">
        <span>{listing.purchaseCount} purchases</span>
        <span>{listing.forkCount} forks</span>
        <span className="flex items-center gap-1">
          <Star size={11} className="text-warning fill-warning" aria-hidden="true" />
          {avgRating}
        </span>
      </div>

      {/* Status + date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-label font-medium px-2 py-1 rounded-full ${statusColor(listing.status)}`}>
          {listing.status}
        </span>
        <span className="text-caption text-tertiary">{formatDate(listing.createdAt)}</span>
      </div>

      {/* Admin note (read-only for non-PENDING) */}
      {listing.adminNote && listing.status !== 'PENDING' && (
        <p className="text-label text-tertiary italic border-l-2 border-default pl-2">{listing.adminNote}</p>
      )}

      {/* Actions */}
      {listing.status === 'PENDING' && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="success"
              disabled={isBusy}
              onClick={() => onApprove(listing.id)}
              className="flex items-center gap-2 px-3 py-2 text-label rounded-sm bg-gain/10 text-gain hover:bg-gain/20 transition-colors disabled:opacity-50"
            >
              <Check size={13} aria-hidden="true" />
              Approve
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isBusy}
              onClick={() => setRejectOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 text-label rounded-sm border border-loss/40 text-loss hover:bg-loss/10 transition-colors disabled:opacity-50"
            >
              <X size={13} aria-hidden="true" />
              Reject
            </Button>
          </div>
          {rejectOpen && (
            <div className="space-y-2">
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Reason for rejection (optional)"
                rows={2}
                className="w-full text-label bg-app border border-default rounded-sm px-2 py-2 text-primary placeholder:text-tertiary resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-loss/40"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  disabled={isBusy}
                  onClick={handleRejectConfirm}
                  className="px-3 py-1 text-label transition-opacity disabled:opacity-50"
                >
                  Confirm Reject
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setRejectOpen(false); setAdminNote(''); }}
                  className="px-3 py-1 text-label rounded-sm border border-default text-secondary hover:bg-app transition-colors"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {listing.status === 'APPROVED' && (
        <div className="pt-1">
          <Button
            type="button"
            variant="danger"
            disabled={isBusy}
            onClick={() => onDelist(listing.id)}
            className="flex items-center gap-2 px-3 py-2 text-label rounded-sm border border-loss/40 text-loss hover:bg-loss/10 transition-colors disabled:opacity-50"
          >
            <X size={13} aria-hidden="true" />
            Delist
          </Button>
        </div>
      )}
    </div>
  );
}

export function Component() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelist, setConfirmDelist] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);

      const params: Record<string, string | number> = { page: currentPage, limit };
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await adminApi.listings(params);
      setListings((res.data ?? []) as unknown as Listing[]);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);

      // Always fetch pending count for the badge
      if (statusFilter !== 'PENDING') {
        const pendingRes = await adminApi.listings({ status: 'PENDING', page: 1, limit: 1 });
        setPendingCount(pendingRes.total ?? 0);
      } else {
        setPendingCount(res.total ?? 0);
      }
    } catch {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function handleTabChange(tab: StatusFilter) {
    setStatusFilter(tab);
    setPage(1);
  }

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await adminApi.reviewListing(id, { status: 'APPROVED' });
      toast.success('Listing approved');
      load(true);
    } catch {
      toast.error('Failed to approve listing');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string, adminNote: string) {
    setActionLoading(id);
    try {
      await adminApi.reviewListing(id, { status: 'REJECTED', ...(adminNote ? { adminNote } : {}) });
      toast.success('Listing rejected');
      load(true);
    } catch {
      toast.error('Failed to reject listing');
    } finally {
      setActionLoading(null);
    }
  }

  function handleDelist(id: string) {
    setConfirmDelist(id);
  }

  async function doDelist(id: string) {
    setActionLoading(id);
    try {
      await adminApi.reviewListing(id, { status: 'DELISTED' });
      toast.success('Listing delisted');
      load(true);
    } catch {
      toast.error('Failed to delist listing');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleFeatured(id: string, current: boolean) {
    const next = !current;
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, featured: next } : l));
    try {
      await adminApi.reviewListing(id, { featured: next } as unknown as { status: 'APPROVED' });
      toast.success(next ? 'Listing featured' : 'Feature removed');
    } catch {
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, featured: current } : l));
      toast.error('Failed to update featured status');
    }
  }

  return (
    <>
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-primary">Marketplace Listings</h2>
          {pendingCount > 0 && (
            <span className="flex items-center justify-center min-w-6 h-5 px-2 rounded-full bg-warning text-caption font-semibold text-inverse" aria-label={`${pendingCount} pending listings`}>
              {pendingCount}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-label rounded-sm border border-default text-secondary hover:bg-elevated hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-default" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={statusFilter === tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-3 py-2 text-body-sm font-medium border-b-2 -mb-px transition-colors rounded-t-sm ${
              statusFilter === tab.value
                ? 'border-accent text-accent-text'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
            {tab.value === 'PENDING' && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-warning text-caption font-semibold text-inverse">
                {pendingCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-label text-tertiary">
          {total} listing{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingBag size={40} className="text-tertiary opacity-40 mb-3" aria-hidden="true" />
          <p className="text-secondary font-medium">No listings in this status</p>
          <p className="text-tertiary text-label mt-1">
            {statusFilter === 'PENDING' ? 'All caught up!' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelist={handleDelist}
              onToggleFeatured={handleToggleFeatured}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-caption text-tertiary">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="p-2 rounded-sm hover:bg-elevated text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="p-2 rounded-sm hover:bg-elevated text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>

    <ConfirmDialog
      open={confirmDelist !== null}
      title="Delist this listing?"
      description="The listing will be removed from the marketplace."
      confirmationText="delist"
      destructiveLabel="Delist listing"
      onConfirm={() => { const id = confirmDelist!; setConfirmDelist(null); doDelist(id); }}
      onCancel={() => setConfirmDelist(null)}
    />
    </>
  );
}
