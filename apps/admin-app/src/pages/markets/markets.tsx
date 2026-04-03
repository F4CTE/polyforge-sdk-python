import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button, Input, Select } from '@polyforge/ui';
import {
  BarChart2,
  Star,
  Ban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface AdminMarket {
  id: string;
  slug: string;
  question: string;
  category: string;
  status: 'ACTIVE' | 'RESOLVED' | 'DELISTED' | 'PENDING';
  featured: boolean;
  volume24h: string;
  totalVolume: string;
  participantCount: number;
  yesPrice: string;
  noPrice: string;
  endDate: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionValue?: string;
}

interface MarketsResponse {
  data: AdminMarket[];
  total: number;
  totalPages: number;
}

const STATUS_TABS = ['All', 'Active', 'Resolved', 'Delisted', 'Pending'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const CATEGORIES = [
  'All',
  'Politics',
  'Sports',
  'Crypto',
  'Finance',
  'Entertainment',
  'Science',
  'Other',
] as const;

const LIMIT = 25;

function statusBadge(status: AdminMarket['status']) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-pf-sm text-pf-label font-semibold uppercase tracking-wide';
  switch (status) {
    case 'ACTIVE':
      return <span className={`${base} bg-green-500/15 text-green-400`}>Active</span>;
    case 'RESOLVED':
      return <span className={`${base} bg-blue-500/15 text-blue-400`}>Resolved</span>;
    case 'DELISTED':
      return <span className={`${base} bg-pf-text-tertiary/20 text-pf-text-tertiary`}>Delisted</span>;
    case 'PENDING':
      return <span className={`${base} bg-yellow-500/15 text-yellow-400`}>Pending</span>;
    default:
      return <span className={`${base} bg-pf-elevated text-pf-text-secondary`}>{status}</span>;
  }
}

function categoryBadge(category: string) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-pf-sm text-pf-label font-medium bg-pf-cyan-500/10 text-pf-cyan-500">
      {category}
    </span>
  );
}

function isClosingSoon(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < 3;
}

function isPast(endDate: string) {
  return new Date(endDate) < new Date();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatVolume(val: string) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-pf-border animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-pf-elevated" style={{ width: i === 0 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  );
}

export function Component() {
  const [markets, setMarkets] = useState<AdminMarket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('All');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDelist, setConfirmDelist] = useState<string | null>(null);

  // Summary stats derived from current page data
  const activeCount = markets.filter((m) => m.status === 'ACTIVE').length;
  const resolvedCount = markets.filter((m) => m.status === 'RESOLVED').length;
  const totalVolume = markets.reduce((sum, m) => sum + (parseFloat(m.totalVolume) || 0), 0);
  const avgParticipants =
    markets.length > 0
      ? Math.round(markets.reduce((sum, m) => sum + m.participantCount, 0) / markets.length)
      : 0;

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        statusTab === 'All' ? '' : statusTab.toUpperCase();
      const categoryParam = category === 'All' ? '' : category;
      const res = await adminApi.markets({
        page,
        limit: LIMIT,
        q,
        status: statusParam,
        category: categoryParam,
      });
      setMarkets(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages ?? Math.ceil(res.total / LIMIT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, [page, q, statusTab, category]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleToggleFeatured(market: AdminMarket) {
    setUpdatingId(market.id);
    try {
      await adminApi.updateMarket(market.id, { featured: !market.featured });
      toast.success(market.featured ? 'Removed from featured' : 'Marked as featured');
      setMarkets((prev) =>
        prev.map((m) => (m.id === market.id ? { ...m, featured: !m.featured } : m)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelist(market: AdminMarket) {
    setConfirmDelist(null);
    setUpdatingId(market.id);
    try {
      await adminApi.updateMarket(market.id, { status: 'DELISTED' });
      toast.success('Market delisted');
      setMarkets((prev) =>
        prev.map((m) => (m.id === market.id ? { ...m, status: 'DELISTED' } : m)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delist failed');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRestore(market: AdminMarket) {
    setUpdatingId(market.id);
    try {
      await adminApi.updateMarket(market.id, { status: 'ACTIVE' });
      toast.success('Market restored to active');
      setMarkets((prev) =>
        prev.map((m) => (m.id === market.id ? { ...m, status: 'ACTIVE' } : m)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-pf-text">Markets</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-pf-full text-xs font-semibold bg-pf-elevated text-pf-text-secondary border border-pf-border">
            {total.toLocaleString()}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={fetchMarkets}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-pf-sm border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-pf border border-pf-border bg-pf-surface p-4">
          <div className="text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary mb-1">
            Active Markets
          </div>
          <div className="text-2xl font-bold text-pf-text">{activeCount}</div>
        </div>
        <div className="rounded-pf border border-pf-border bg-pf-surface p-4">
          <div className="text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary mb-1">
            Resolved (page)
          </div>
          <div className="text-2xl font-bold text-pf-text">{resolvedCount}</div>
        </div>
        <div className="rounded-pf border border-pf-border bg-pf-surface p-4">
          <div className="text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary mb-1">
            Total Volume
          </div>
          <div className="text-2xl font-bold text-pf-text">{formatVolume(String(totalVolume))}</div>
        </div>
        <div className="rounded-pf border border-pf-border bg-pf-surface p-4">
          <div className="text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary mb-1">
            Avg Participants
          </div>
          <div className="text-2xl font-bold text-pf-text">{avgParticipants.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-pf-sm border border-pf-border bg-pf-elevated text-pf-text text-sm placeholder:text-pf-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
        />

        {/* Status tabs + Category */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-pf-elevated rounded-pf-sm border border-pf-border p-0.5">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab}
                type="button"
                variant="ghost"
                onClick={() => { setStatusTab(tab); setPage(1); }}
                className={`px-3 py-1 rounded-pf-sm text-sm font-medium transition-colors ${
                  statusTab === tab
                    ? 'bg-pf-cyan-500 text-pf-text-contrast'
                    : 'text-pf-text-secondary hover:text-pf-text'
                }`}
              >
                {tab}
              </Button>
            ))}
          </div>

          <Select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-pf-sm border border-pf-border bg-pf-elevated text-sm text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-pf border border-pf-border overflow-x-auto bg-pf-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border">
              <th className="px-4 py-3 text-left text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Question
              </th>
              <th className="px-4 py-3 text-left text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Category
              </th>
              <th className="px-4 py-3 text-left text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Status
              </th>
              <th className="px-4 py-3 text-right text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Volume
              </th>
              <th className="px-4 py-3 text-right text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Participants
              </th>
              <th className="px-4 py-3 text-right text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                YES / NO
              </th>
              <th className="px-4 py-3 text-left text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                End Date
              </th>
              <th className="px-4 py-3 text-right text-pf-label font-semibold uppercase tracking-wider text-pf-text-tertiary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            ) : markets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-pf-text-tertiary">
                    <BarChart2 size={32} />
                    <span className="text-sm">No markets found</span>
                  </div>
                </td>
              </tr>
            ) : (
              markets.map((market) => {
                const past = isPast(market.endDate);
                const soon = !past && isClosingSoon(market.endDate);
                const isUpdating = updatingId === market.id;

                return (
                  <tr
                    key={market.id}
                    className="border-b border-pf-border hover:bg-pf-elevated/50 transition-colors"
                  >
                    {/* Question */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-pf-text line-clamp-2 text-xs leading-relaxed">
                          {market.question}
                        </span>
                        <a
                          href={`https://polymarket.com/event/${market.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-pf-text-tertiary hover:text-pf-cyan-500 transition-colors mt-0.5"
                          title="View on Polymarket"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {categoryBadge(market.category)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusBadge(market.status)}
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="text-pf-text font-medium">{formatVolume(market.volume24h)}</div>
                      <div className="text-pf-label text-pf-text-tertiary">{formatVolume(market.totalVolume)} total</div>
                    </td>

                    {/* Participants */}
                    <td className="px-4 py-3 text-right whitespace-nowrap text-pf-text">
                      {market.participantCount.toLocaleString()}
                    </td>

                    {/* YES / NO */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="text-green-400 font-medium">{(parseFloat(market.yesPrice) * 100).toFixed(0)}¢</div>
                      <div className="text-red-400 font-medium">{(parseFloat(market.noPrice) * 100).toFixed(0)}¢</div>
                    </td>

                    {/* End Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          past || soon ? 'text-red-400 font-medium' : 'text-pf-text-secondary'
                        }
                      >
                        {formatDate(market.endDate)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Star toggle */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggleFeatured(market)}
                          disabled={isUpdating}
                          title={market.featured ? 'Remove from featured' : 'Mark as featured'}
                          className={`p-1.5 rounded-pf-sm transition-colors disabled:opacity-40 ${
                            market.featured
                              ? 'text-yellow-400 hover:text-yellow-300'
                              : 'text-pf-text-tertiary hover:text-yellow-400'
                          }`}
                        >
                          <Star size={14} fill={market.featured ? 'currentColor' : 'none'} />
                        </Button>

                        {/* Delist (ACTIVE only) */}
                        {market.status === 'ACTIVE' && (
                          confirmDelist === market.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => handleDelist(market)}
                                disabled={isUpdating}
                                className="px-2 py-1 rounded-pf-sm text-pf-label font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                              >
                                Confirm
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmDelist(null)}
                                className="px-2 py-1 rounded-pf-sm text-pf-label text-pf-text-secondary hover:text-pf-text transition-colors"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setConfirmDelist(market.id)}
                              disabled={isUpdating}
                              title="Delist market"
                              className="flex items-center gap-1 px-2 py-1 rounded-pf-sm text-pf-label font-medium text-pf-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              <Ban size={12} />
                              Delist
                            </Button>
                          )
                        )}

                        {/* Restore (DELISTED only) */}
                        {market.status === 'DELISTED' && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleRestore(market)}
                            disabled={isUpdating}
                            className="flex items-center gap-1 px-2 py-1 rounded-pf-sm text-pf-label font-medium text-pf-text-tertiary hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm text-pf-text-secondary">
            Page {page} of {totalPages} &mdash; {total.toLocaleString()} markets
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-pf-sm border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Prev
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-pf-sm border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated transition-colors disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
