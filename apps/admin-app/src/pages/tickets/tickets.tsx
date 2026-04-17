import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Select } from '@polyforge/ui';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime, priorityColor } from '@/lib/utils';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  username?: string;
  userId?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  [key: string]: unknown;
}

export function Component() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
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
      setTickets((res.data ?? []) as unknown as TicketRow[]);
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
        <h2 className="text-lg font-semibold text-primary">
          Tickets <span className="text-body-sm font-normal text-tertiary">({total})</span>
        </h2>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by ticket status"
          className="px-3 py-2 text-body-sm rounded-sm border border-default bg-app text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      <div className="bg-elevated border border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <caption className="sr-only">Support tickets</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Subject</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">User</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Status</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Priority</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Assigned To</th>
                <th scope="col" className="text-left px-4 py-3 text-label font-medium text-tertiary uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} {...(i === 0 ? { role: 'status' as const, 'aria-live': 'polite' as const, 'aria-label': 'Loading tickets' } : {})}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <MessageSquare className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-secondary font-medium">No tickets found</p>
                    <p className="text-tertiary text-label mt-1">Support tickets will appear here</p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    aria-label={`View ticket: ${t.subject}`}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/tickets/${t.id}`); } }}
                    className="border-b border-default last:border-0 hover:bg-app cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <td className="px-4 py-3 font-medium text-primary">{t.subject}</td>
                    <td className="px-4 py-3 text-secondary">{t.username ?? (t.userId ? t.userId.slice(0, 8) : '')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-label font-medium ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-label font-medium ${priorityColor[t.priority] ?? ''}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-caption font-semibold text-accent">
                            {t.assignedToName?.[0]?.toUpperCase() ?? 'A'}
                          </div>
                          <span className="text-secondary text-label">
                            {t.assignedToName ?? (t.assignedTo ? t.assignedTo.slice(0, 8) : '')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-tertiary text-label">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tertiary">{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-caption text-tertiary">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={16} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
