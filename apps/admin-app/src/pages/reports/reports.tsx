import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Flag, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

export function Component() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.reports({
        status: statusFilter || undefined,
        page,
        limit,
      });
      setReports(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit]);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function handleResolve(id: string, status: 'REVIEWED' | 'DISMISSED') {
    try {
      const updated = await adminApi.resolveReport(id, status, adminNote || undefined);
      setReports((r) => r.map((rep) => (rep.id === id ? updated : rep)));
      setReviewingId(null);
      setAdminNote('');
      toast.success(`Report ${status.toLowerCase()}`);
    } catch {
      toast.error('Failed to resolve report');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">Content Reports</h2>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by report status"
          className="px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Content reports</caption>
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Reporter</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Target</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Reason</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Flag className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No reports found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Content reports will appear here</p>
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors">
                    <td className="px-4 py-3 text-[var(--color-pf-text)]">{r.reporterUsername}</td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--color-pf-text-secondary)]">
                        <span className="text-[11px] uppercase text-[var(--color-pf-text-tertiary)]">{r.targetType}</span>
                        {r.targetName && <span className="ml-1.5">{r.targetName}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)] max-w-[200px] truncate">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'PENDING' && (
                        <button type="button"
                          onClick={() => {
                            setReviewingId(r.id);
                            setAdminNote('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-pf-cyan-500)]/10 text-[var(--color-pf-cyan-500)] hover:bg-[var(--color-pf-cyan-500)]/20 cursor-pointer transition-colors"
                        >
                          <Flag size={12} />
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]">
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      {reviewingId && (
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)] mb-3">Review Report</h3>
          <label htmlFor="admin-note" className="block text-sm font-medium text-[var(--color-pf-text-secondary)] mb-2">Admin Note</label>
          <textarea
            id="admin-note"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Admin note (optional)..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] mb-3"
          />
          <div className="flex gap-3">
            <button type="button"
              onClick={() => handleResolve(reviewingId, 'REVIEWED')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-success/10 text-pf-success hover:bg-pf-success/20 cursor-pointer transition-colors"
            >
              <CheckCircle size={14} />
              Approve
            </button>
            <button type="button"
              onClick={() => handleResolve(reviewingId, 'DISMISSED')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)] cursor-pointer transition-colors"
            >
              <XCircle size={14} />
              Dismiss
            </button>
            <button type="button"
              onClick={() => setReviewingId(null)}
              className="px-3 py-1.5 text-sm rounded-pf-sm text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text-secondary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
