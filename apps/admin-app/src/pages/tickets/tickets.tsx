import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';

const priorityColor: Record<string, string> = {
  LOW: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
  MEDIUM: 'text-amber-400 bg-amber-400/10',
  HIGH: 'text-orange-400 bg-orange-400/10',
  URGENT: 'text-red-400 bg-red-400/10',
};

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
    <div className="space-y-4">
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

      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-lg overflow-hidden">
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
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">Loading...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-pf-text-tertiary)]">No tickets found</td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-pf-text)]">{t.subject}</td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{t.username ?? t.userId?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                        {t.status}
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
