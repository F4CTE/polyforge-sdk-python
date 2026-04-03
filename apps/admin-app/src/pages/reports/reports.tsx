'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Textarea } from '@polyforge/ui';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Flag,
  MessageSquare,
  Search,
  Star,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategyReview {
  id: string;
  strategyId: string;
  strategyName: string;
  authorId: string;
  authorUsername: string;
  rating: number; // 1–5
  title?: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  flagReason?: string;
  reportCount: number;
  createdAt: string;
  verifiedPurchase: boolean;
}

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
type ReviewAction = 'approve' | 'reject' | 'flag';
type MinReports = 0 | 1 | 3 | 5;

interface ReviewsState {
  data: StrategyReview[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < rating ? 'text-pf-warning' : 'text-pf-text-muted'}
          aria-hidden
        >
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-pf-warning/15 text-pf-warning border border-pf-warning/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-pf-success/15 text-pf-success border border-pf-success/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-pf-border/20 text-pf-text-muted border border-pf-border',
  },
  flagged: {
    label: 'Flagged',
    className: 'bg-pf-danger/15 text-pf-danger border border-pf-danger/30',
  },
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const { label, className } = STATUS_BADGE[status];
  return (
    <span
      className={[
        'inline-flex items-center rounded-pf-full px-2 py-1 text-xs font-medium',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Card border per status
// ---------------------------------------------------------------------------

const CARD_BORDER: Record<ReviewStatus, string> = {
  pending: 'border-pf-warning/30',
  approved: 'border-pf-success/30',
  rejected: 'border-pf-border opacity-60',
  flagged: 'border-pf-danger/30',
};

// ---------------------------------------------------------------------------
// Review card
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  review: StrategyReview;
  onAction: (id: string, action: ReviewAction, reason?: string) => Promise<void>;
}

function ReviewCard({ review, onAction }: ReviewCardProps) {
  const [flagging, setFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [acting, setActing] = useState<ReviewAction | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAction = useCallback(
    async (action: ReviewAction, reason?: string) => {
      setActing(action);
      try {
        await onAction(review.id, action, reason);
      } finally {
        setActing(null);
      }
    },
    [onAction, review.id],
  );

  const handleApprove = () => {
    setFlagging(false);
    handleAction('approve');
  };

  const handleReject = () => {
    setFlagging(false);
    handleAction('reject');
  };

  const handleFlagToggle = () => {
    setFlagging((prev) => !prev);
    setFlagReason('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleFlagSubmit = () => {
    if (!flagReason.trim()) {
      toast.error('Flag reason is required');
      textareaRef.current?.focus();
      return;
    }
    handleAction('flag', flagReason.trim()).then(() => {
      setFlagging(false);
      setFlagReason('');
    });
  };

  const busy = acting !== null;

  return (
    <article
      className={[
        'rounded-pf-lg border bg-pf-elevated p-5 space-y-3 transition-opacity',
        CARD_BORDER[review.status],
        busy ? 'opacity-70 pointer-events-none' : '',
      ].join(' ')}
    >
      {/* Top row: rating, strategy, author, time */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarDisplay rating={review.rating} />
        <span className="text-xs text-pf-text-muted">({review.rating}/5)</span>
        <span className="text-sm font-medium text-pf-text">
          Strategy:{' '}
          <span className="text-pf-cyan-400">&ldquo;{review.strategyName}&rdquo;</span>
        </span>
        <span className="text-xs text-pf-text-muted">
          @{review.authorUsername}
        </span>
        <span className="ml-auto text-xs text-pf-text-muted tabular-nums">
          {formatRelativeTime(review.createdAt)}
        </span>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={review.status} />

        {review.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 rounded-pf-full border border-pf-success/30 bg-pf-success/10 px-2 py-1 text-xs font-medium text-pf-success">
            <Check className="h-3 w-3" aria-hidden />
            Verified Purchase
          </span>
        )}

        {review.reportCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-pf-full border border-pf-danger/30 bg-pf-danger/10 px-2 py-1 text-xs font-medium text-pf-danger">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {review.reportCount} {review.reportCount === 1 ? 'report' : 'reports'}
          </span>
        )}

        {review.status === 'flagged' && review.flagReason && (
          <span className="text-xs text-pf-text-muted italic">
            Reason: {review.flagReason}
          </span>
        )}
      </div>

      {/* Review content */}
      <div className="space-y-1">
        {review.title && (
          <p className="text-sm font-semibold text-pf-text">&ldquo;{review.title}&rdquo;</p>
        )}
        <p className="text-sm text-pf-text-secondary leading-relaxed">{review.body}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="success"
          onClick={handleApprove}
          disabled={busy}
          className={[
            'inline-flex items-center gap-2 rounded-pf-sm border px-3 py-2 text-xs font-medium transition-colors',
            review.status === 'approved'
              ? 'border-pf-success/40 bg-pf-success/10 text-pf-success'
              : 'border-pf-border bg-pf-surface text-pf-text-secondary hover:border-pf-success/40 hover:text-pf-success',
          ].join(' ')}
          aria-pressed={review.status === 'approved'}
        >
          <Check className="h-4 w-4" aria-hidden />
          Approve
        </Button>

        <Button
          type="button"
          variant="danger"
          onClick={handleReject}
          disabled={busy}
          className={[
            'inline-flex items-center gap-2 rounded-pf-sm border px-3 py-2 text-xs font-medium transition-colors',
            review.status === 'rejected'
              ? 'border-pf-border/60 bg-pf-border/10 text-pf-text-muted'
              : 'border-pf-border bg-pf-surface text-pf-text-secondary hover:border-pf-danger/40 hover:text-pf-danger',
          ].join(' ')}
          aria-pressed={review.status === 'rejected'}
        >
          <X className="h-4 w-4" aria-hidden />
          Reject
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={handleFlagToggle}
          disabled={busy}
          className={[
            'inline-flex items-center gap-2 rounded-pf-sm border px-3 py-2 text-xs font-medium transition-colors',
            review.status === 'flagged' || flagging
              ? 'border-pf-danger/40 bg-pf-danger/10 text-pf-danger'
              : 'border-pf-border bg-pf-surface text-pf-text-secondary hover:border-pf-danger/40 hover:text-pf-danger',
          ].join(' ')}
          aria-pressed={flagging}
          aria-expanded={flagging}
        >
          <Flag className="h-4 w-4" aria-hidden />
          Flag
        </Button>

        <a
          href={`/strategies/${review.strategyId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'ml-auto inline-flex items-center gap-2 rounded-pf-sm border border-pf-border px-3 py-2 text-xs font-medium text-pf-text-secondary',
            'hover:text-pf-cyan-400 hover:border-pf-cyan-400/40 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40',
          ].join(' ')}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          View Strategy
        </a>
      </div>

      {/* Inline flag reason textarea */}
      {flagging && (
        <div className="space-y-2 rounded-pf-sm border border-pf-danger/30 bg-pf-danger/5 p-3">
          <label
            htmlFor={`flag-reason-${review.id}`}
            className="block text-xs font-medium text-pf-danger"
          >
            Flag reason <span aria-hidden>*</span>
          </label>
          <Textarea
            id={`flag-reason-${review.id}`}
            ref={textareaRef}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            rows={3}
            placeholder="Describe the policy violation or reason for flagging…"
            className={[
              'w-full resize-y rounded-pf-sm border border-pf-border bg-pf-surface px-3 py-2',
              'text-xs text-pf-text placeholder:text-pf-text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40',
            ].join(' ')}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setFlagging(false); setFlagReason(''); }}
              className="rounded-pf-sm border border-pf-border px-3 py-2 text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleFlagSubmit}
              disabled={!flagReason.trim() || busy}
              className={[
                'inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all',
                flagReason.trim()
                  ? ''
                  : 'bg-pf-elevated border border-pf-border text-pf-text-muted cursor-not-allowed opacity-50',
              ].join(' ')}
            >
              <Flag className="h-3 w-3" aria-hidden />
              Submit Flag
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Skeleton cards
// ---------------------------------------------------------------------------

function ReviewCardSkeleton() {
  return (
    <div className="rounded-pf-lg border border-pf-border bg-pf-elevated p-5 space-y-3 animate-shimmer">
      <div className="flex items-center gap-3">
        <div className="h-4 w-24 rounded-pf-sm bg-pf-border" />
        <div className="h-4 w-40 rounded-pf-sm bg-pf-border" />
        <div className="ml-auto h-3 w-16 rounded-pf-sm bg-pf-border" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-pf-full bg-pf-border" />
        <div className="h-5 w-24 rounded-pf-full bg-pf-border" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded-pf-sm bg-pf-border" />
        <div className="h-3 w-full rounded-pf-sm bg-pf-border" />
        <div className="h-3 w-5/6 rounded-pf-sm bg-pf-border" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-7 w-20 rounded-pf-sm bg-pf-border" />
        <div className="h-7 w-20 rounded-pf-sm bg-pf-border" />
        <div className="h-7 w-16 rounded-pf-sm bg-pf-border" />
        <div className="ml-auto h-7 w-28 rounded-pf-sm bg-pf-border" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

interface ReviewSummaryStats {
  totalPending: number;
  totalFlagged: number;
  avgRating: number;
  totalThisWeek: number;
}

interface StatTileProps {
  label: string;
  value: string | number;
  accent?: boolean;
  danger?: boolean;
}

function StatTile({ label, value, accent, danger }: StatTileProps) {
  const valueClass = danger
    ? 'text-pf-danger'
    : accent
      ? 'text-pf-warning'
      : 'text-pf-text';

  return (
    <div className="rounded-pf-lg border border-pf-border bg-pf-elevated px-4 py-3 space-y-1">
      <p className="text-pf-label font-semibold uppercase tracking-wider text-pf-text-muted">
        {label}
      </p>
      <p className={['text-2xl font-bold tabular-nums', valueClass].join(' ')}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ status }: { status: ReviewStatus }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-pf-lg border border-pf-border bg-pf-elevated py-16 text-center">
      <MessageSquare className="h-10 w-10 text-pf-text-muted" aria-hidden />
      <p className="text-sm font-medium text-pf-text-secondary">
        No {status} reviews
      </p>
      <p className="text-xs text-pf-text-muted max-w-xs">
        {status === 'pending'
          ? 'All reviews have been moderated.'
          : `There are currently no ${status} reviews to display.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews tab
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'flagged', label: 'Flagged' },
];

const MIN_REPORTS_OPTIONS: Array<{ value: MinReports; label: string }> = [
  { value: 0, label: 'All reports' },
  { value: 1, label: 'Reported 1+' },
  { value: 3, label: 'Reported 3+' },
  { value: 5, label: 'Reported 5+' },
];

const PAGE_SIZE = 10;

function ReviewsTab() {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [minReports, setMinReports] = useState<MinReports>(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [reviews, setReviews] = useState<StrategyReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [stats, setStats] = useState<ReviewSummaryStats | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setReviews([]);
  }, [status, minReports, debouncedSearch]);

  // Fetch reviews
  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;

    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    adminApi
      .strategyReviews({
        status,
        page,
        limit: PAGE_SIZE,
        minReports: minReports > 0 ? minReports : undefined,
        search: debouncedSearch || undefined,
      })
      .then((result: ReviewsState) => {
        if (cancelled) return;
        setReviews((prev) =>
          isFirstPage ? result.data : [...prev, ...result.data],
        );
        setTotal(result.total);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load reviews');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => { cancelled = true; };
  }, [status, minReports, debouncedSearch, page]);

  // Fetch summary stats once on mount
  useEffect(() => {
    let cancelled = false;
    adminApi
      .reviewStats()
      .then((s: ReviewSummaryStats) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        // stats are non-critical — silently skip
      });
    return () => { cancelled = true; };
  }, []);

  const hasMore = reviews.length < total;

  const handleAction = useCallback(
    async (id: string, action: ReviewAction, reason?: string) => {
      await adminApi.reviewAction(id, action, reason);

      const label =
        action === 'approve'
          ? 'Review approved'
          : action === 'reject'
            ? 'Review rejected'
            : 'Review flagged';
      toast.success(label);

      // Update card in place
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status:
                  action === 'approve'
                    ? 'approved'
                    : action === 'reject'
                      ? 'rejected'
                      : 'flagged',
                flagReason: action === 'flag' ? reason : r.flagReason,
              }
            : r,
        ),
      );
    },
    [],
  );

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Pending" value={stats.totalPending} accent />
          <StatTile label="Flagged" value={stats.totalFlagged} danger />
          <StatTile
            label="Avg Rating"
            value={`${stats.avgRating.toFixed(1)} ★`}
          />
          <StatTile label="This Week" value={stats.totalThisWeek} />
        </div>
      )}

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Status pills */}
        <div
          role="tablist"
          aria-label="Filter by review status"
          className="flex flex-wrap gap-2"
        >
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              role="tab"
              aria-selected={status === tab.value}
              type="button"
              variant="ghost"
              onClick={() => setStatus(tab.value)}
              className={[
                'rounded-pf-sm px-3 py-2 text-xs font-medium transition-colors',
                status === tab.value
                  ? 'bg-pf-elevated border border-pf-border text-pf-text'
                  : 'text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated/50',
              ].join(' ')}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Min reports dropdown */}
          <Select
            value={minReports}
            onChange={(e) => setMinReports(Number(e.target.value) as MinReports)}
            aria-label="Minimum report count filter"
            className={[
              'rounded-pf-sm border border-pf-border bg-pf-surface px-3 py-2 text-xs text-pf-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40',
            ].join(' ')}
          >
            {MIN_REPORTS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search strategy or author…"
              aria-label="Search reviews by strategy name or author"
              className={[
                'w-full rounded-pf-sm border border-pf-border bg-pf-surface py-2 pl-8 pr-3 text-xs text-pf-text',
                'placeholder:text-pf-text-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40',
              ].join(' ')}
            />
          </div>

          {total > 0 && (
            <span className="ml-auto text-xs text-pf-text-muted tabular-nums">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Review list */}
      <div role="feed" aria-label="Strategy reviews" aria-busy={loading} className="space-y-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <ReviewCardSkeleton key={i} />)}

        {!loading &&
          reviews.length > 0 &&
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onAction={handleAction} />
          ))}

        {!loading && reviews.length === 0 && <EmptyState status={status} />}
      </div>

      {/* Load more */}
      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPage((p) => p + 1)}
            disabled={loadingMore}
            className={[
              'rounded-pf px-5 py-2 text-sm font-medium transition-all',
              loadingMore
                ? 'bg-pf-elevated border border-pf-border text-pf-text-muted cursor-not-allowed'
                : 'bg-pf-elevated border border-pf-border text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong',
            ].join(' ')}
          >
            {loadingMore ? 'Loading…' : `Load more (${total - reviews.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions (extensible — add more moderation tabs here later)
// ---------------------------------------------------------------------------

type TabId = 'reviews';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'reviews',
    label: 'Reviews',
    icon: <Star className="h-4 w-4" aria-hidden />,
  },
];

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function Component() {
  const [activeTab, setActiveTab] = useState<TabId>('reviews');

  return (
    <div className="min-h-screen bg-pf-surface animate-fade-in">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-pf-lg bg-pf-elevated border border-pf-border">
            <MessageSquare className="h-5 w-5 text-pf-cyan-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-pf-text leading-tight">
              Content Moderation
            </h1>
            <p className="text-xs text-pf-text-muted mt-1">
              Moderate strategy marketplace reviews and ratings
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Moderation sections"
          className="flex gap-1 border-b border-pf-border"
        >
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              type="button"
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors -mb-px border-b-2 rounded-t-pf-sm',
                activeTab === tab.id
                  ? 'border-pf-cyan-400 text-pf-text'
                  : 'border-transparent text-pf-text-secondary hover:text-pf-text hover:border-pf-border',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id="tabpanel-reviews"
          aria-labelledby="tab-reviews"
          hidden={activeTab !== 'reviews'}
        >
          {activeTab === 'reviews' && <ReviewsTab />}
        </div>

      </div>
    </div>
  );
}
