import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime, priorityColor } from '@/lib/utils';

export function Component() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.tickets({
        page,
        limit,
        status: statusFilter || undefined,
      });
      setTickets(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
          Tickets <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
        </h2>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-md border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
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
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <MessageSquare className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No tickets found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Support tickets will appear here</p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/tickets/${t.id}`); }}
                    className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-pf-text)]">{t.subject}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{t.username ?? t.userId?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status ?? 'UNKNOWN')}`}>
                        {t.status ?? 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[t.priority] ?? ''}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[var(--color-pf-cyan-500)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--color-pf-cyan-500)]">
                            {t.assignedToName?.[0]?.toUpperCase() ?? 'A'}
                          </div>
                          <span className="text-[var(--color-pf-text-secondary)] text-xs">
                            {t.assignedToName ?? t.assignedTo.slice(0, 8)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--color-pf-text-tertiary)] text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">{formatDateTime(t.createdAt)}</td>
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
