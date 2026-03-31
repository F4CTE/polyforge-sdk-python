import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  Ban,
  AlertTriangle,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { adminApi, type Report } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type StatusFilter = 'PENDING' | 'RESOLVED' | 'DISMISSED' | '';
type ReportAction = 'DISMISS' | 'REMOVE_CONTENT' | 'WARN_USER' | 'BAN_USER';

const CONTENT_TYPE_BADGE: Record<Report['contentType'], string> = {
  STRATEGY: 'bg-blue-500/10 text-blue-400',
  REVIEW: 'bg-purple-500/10 text-purple-400',
  USER: 'bg-orange-500/10 text-orange-400',
  COMMENT: 'bg-pf-elevated text-pf-text-secondary',
};

const STATUS_BADGE: Record<Report['status'], string> = {
  PENDING: 'text-pf-warning bg-pf-warning/10',
  RESOLVED: 'text-pf-success bg-pf-success/10',
  DISMISSED: 'text-pf-text-secondary bg-pf-elevated',
};

interface SummaryStats {
  totalPending: number;
  resolvedToday: number;
  bannedUsers: number;
  removedContent: number;
}

const TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: '' },
];

export function Component() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<SummaryStats>({
    totalPending: 0,
    resolvedToday: 0,
    bannedUsers: 0,
    removedContent: 0,
  });
  const [actingOn, setActingOn] = useState<string | null>(null);
  const limit = 20;

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.reports({
        status: statusFilter || undefined,
        page,
        limit,
      });
      const data = (res.data ?? []) as Report[];
      setReports(data);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? Math.max(1, Math.ceil((res.total ?? 0) / limit)));
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  // Load summary stats from the PENDING list independently
  const loadStats = useCallback(async () => {
    try {
      const [pendingRes, resolvedRes] = await Promise.all([
        adminApi.reports({ status: 'PENDING', page: 1, limit: 1 }),
        adminApi.reports({ status: 'RESOLVED', page: 1, limit: 100 }),
      ]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resolvedData = (resolvedRes.data ?? []) as Report[];
      const resolvedToday = resolvedData.filter(
        (r) => r.resolvedAt && new Date(r.resolvedAt) >= today,
      ).length;
      const bannedUsers = resolvedData.filter((r) => r.adminNote?.includes('BAN_USER')).length;
      const removedContent = resolvedData.filter((r) =>
        r.adminNote?.includes('REMOVE_CONTENT'),
      ).length;
      setStats({
        totalPending: pendingRes.total ?? 0,
        resolvedToday,
        bannedUsers,
        removedContent,
      });
    } catch {
      // stats are non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleAction(report: Report, action: ReportAction) {
    const isDestructive = action === 'REMOVE_CONTENT' || action === 'BAN_USER';
    const actionLabel =
      action === 'DISMISS'
        ? 'Dismiss'
        : action === 'REMOVE_CONTENT'
          ? 'Remove content'
          : action === 'WARN_USER'
            ? 'Warn user'
            : 'Ban user';

    if (isDestructive) {
      const confirmed = window.confirm(
        `Are you sure you want to "${actionLabel}" for report by @${report.reporter.username}?`,
      );
      if (!confirmed) return;
    }

    // Optimistic update
    setActingOn(report.id);
    const optimisticStatus: Report['status'] =
      action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
    setReports((prev) =>
      prev.map((r) =>
        r.id === report.id ? { ...r, status: optimisticStatus } : r,
      ),
    );

    try {
      await adminApi.actionReport(report.id, action);
      toast.success(`${actionLabel} applied successfully`);
      loadStats();
    } catch {
      // Revert optimistic update
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? report : r)),
      );
      toast.error(`Failed to apply action`);
    } finally {
      setActingOn(null);
    }
  }

  function handleTabChange(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-pf-text">Reports</h2>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-pf-warning/10 text-pf-warning">
          {stats.totalPending} pending
        </span>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-pf-elevated border border-pf-border rounded-pf-sm px-4 py-3">
          <p className="text-xs text-pf-text-tertiary mb-1">Total Pending</p>
          <p className="text-xl font-semibold text-pf-warning">{stats.totalPending}</p>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-sm px-4 py-3">
          <p className="text-xs text-pf-text-tertiary mb-1">Resolved Today</p>
          <p className="text-xl font-semibold text-pf-success">{stats.resolvedToday}</p>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-sm px-4 py-3">
          <p className="text-xs text-pf-text-tertiary mb-1">Banned Users</p>
          <p className="text-xl font-semibold text-pf-danger">{stats.bannedUsers}</p>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-sm px-4 py-3">
          <p className="text-xs text-pf-text-tertiary mb-1">Removed Content</p>
          <p className="text-xl font-semibold text-pf-text">{stats.removedContent}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-pf-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 ${
              statusFilter === tab.value
                ? 'border-pf-cyan-500 text-pf-cyan-500'
                : 'border-transparent text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Content reports moderation queue</caption>
            <thead>
              <tr className="border-b border-pf-border">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Reported At
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Reporter
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Reported User
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Reason
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Content Preview
                </th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} {...(i === 0 ? { role: 'status' as const, 'aria-live': 'polite' as const, 'aria-label': 'Loading reports' } : {})}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Flag className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-pf-text-secondary font-medium">No reports</p>
                    <p className="text-pf-text-tertiary text-xs mt-1">
                      {statusFilter ? `No ${statusFilter.toLowerCase()} reports` : 'All clear'}
                    </p>
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isActing = actingOn === r.id;
                  const truncatedReason =
                    r.reason.length > 60 ? r.reason.slice(0, 57) + '…' : r.reason;
                  const truncatedPreview = r.contentPreview
                    ? r.contentPreview.length > 60
                      ? r.contentPreview.slice(0, 57) + '…'
                      : r.contentPreview
                    : null;

                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-pf-border last:border-0 transition-colors ${
                        isActing ? 'opacity-50' : 'hover:bg-pf-base'
                      }`}
                    >
                      {/* Reported At */}
                      <td className="px-4 py-3 text-pf-text-tertiary text-xs whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CONTENT_TYPE_BADGE[r.contentType]}`}
                        >
                          {r.contentType}
                        </span>
                      </td>

                      {/* Reporter */}
                      <td className="px-4 py-3 text-pf-text-secondary text-xs">
                        <span title={r.reporter.displayName ?? r.reporter.username}>
                          @{r.reporter.username}
                        </span>
                      </td>

                      {/* Reported User */}
                      <td className="px-4 py-3 text-pf-text-secondary text-xs">
                        <span title={r.reported.displayName ?? r.reported.username}>
                          @{r.reported.username}
                        </span>
                      </td>

                      {/* Reason */}
                      <td
                        className="px-4 py-3 text-pf-text-secondary text-xs max-w-[160px] truncate"
                        title={r.reason}
                      >
                        {truncatedReason}
                      </td>

                      {/* Content Preview */}
                      <td className="px-4 py-3 text-xs max-w-[180px]">
                        {truncatedPreview ? (
                          <span
                            className="font-mono text-pf-text-secondary truncate block"
                            title={r.contentPreview}
                          >
                            {truncatedPreview}
                          </span>
                        ) : (
                          <span className="text-pf-text-tertiary italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {r.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Dismiss */}
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleAction(r, 'DISMISS')}
                              title="Dismiss report"
                              aria-label={`Dismiss report from @${r.reporter.username}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-elevated border border-pf-border text-pf-text-secondary hover:bg-pf-base hover:text-pf-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
                            >
                              <CheckCircle size={11} aria-hidden="true" />
                              Dismiss
                            </button>

                            {/* Remove Content */}
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleAction(r, 'REMOVE_CONTENT')}
                              title="Remove reported content"
                              aria-label={`Remove content reported by @${r.reporter.username}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
                            >
                              <Trash2 size={11} aria-hidden="true" />
                              Remove
                            </button>

                            {/* Warn User */}
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleAction(r, 'WARN_USER')}
                              title="Warn reported user"
                              aria-label={`Warn @${r.reported.username}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-warning/10 text-pf-warning hover:bg-pf-warning/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-warning"
                            >
                              <AlertTriangle size={11} aria-hidden="true" />
                              Warn
                            </button>

                            {/* Ban User */}
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleAction(r, 'BAN_USER')}
                              title="Ban reported user"
                              aria-label={`Ban @${r.reported.username}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-pf-danger text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
                            >
                              <Ban size={11} aria-hidden="true" />
                              Ban
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            {r.resolvedAt && (
                              <span className="text-xs text-pf-text-tertiary">
                                {formatDateTime(r.resolvedAt)}
                              </span>
                            )}
                            {r.adminNote && (
                              <p className="text-xs text-pf-text-tertiary mt-0.5 italic max-w-[160px] truncate" title={r.adminNote}>
                                {r.adminNote}
                              </p>
                            )}
                          </div>
                        )}
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-pf-border">
            <span className="text-xs text-pf-text-tertiary">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
