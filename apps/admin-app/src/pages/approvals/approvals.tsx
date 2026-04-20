import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import { Check, X, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface PendingUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  approved: boolean | null;
}

export function Component() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.users({ status: 'PENDING', page: p, limit: 25 });
      setUsers(res.data as unknown as PendingUser[]);
      setTotal(res.total);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      toast.error('Failed to load pending users');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  async function approve(id: string) {
    setActing(id);
    try {
      await adminApi.approveUser(id);
      toast.success('User approved');
      setUsers(prev => prev.filter(u => u.id !== id));
      setTotal(t => t - 1);
    } catch { toast.error('Failed to approve user'); }
    setActing(null);
  }

  async function reject(id: string) {
    setActing(id);
    try {
      await adminApi.rejectUser(id);
      toast.success('User rejected');
      setUsers(prev => prev.filter(u => u.id !== id));
      setTotal(t => t - 1);
    } catch { toast.error('Failed to reject user'); }
    setActing(null);
  }

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <UserCheck className="size-6 text-accent-text" />
            Approval Queue
          </h1>
          <p className="text-body-sm text-secondary mt-1">
            {loading ? '—' : `${total} user${total !== 1 ? 's' : ''} awaiting approval`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => load(page)}
          className="text-body-sm text-secondary hover:text-primary transition-colors"
        >
          Refresh
        </Button>
      </div>

      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        {loading ? (
          <div className="divide-y divide-subtle">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-3 bg-overlay rounded-sm flex-1 animate-pulse" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="size-10 text-gain mb-3" />
            <p className="text-body-sm font-medium text-primary">No pending approvals</p>
            <p className="text-label text-tertiary mt-1">All users have been reviewed.</p>
          </div>
        ) : (
          <table className="w-full text-body-sm" aria-label="Pending users">
            <thead>
              <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Verified</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Registered</th>
                <th scope="col" className="px-4 py-3 font-medium text-right w-28"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-body-sm font-medium text-primary">{u.username}</div>
                    <div className="text-label text-tertiary font-mono">{u.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 text-body-sm text-secondary">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                      u.emailVerified
                        ? 'bg-gain/10 text-gain'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {u.emailVerified ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-caption text-tertiary">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="success"
                        onClick={() => approve(u.id)}
                        disabled={acting === u.id}
                        title="Approve"
                        className="flex items-center gap-1 px-2 py-1 rounded-sm bg-gain/10 text-gain hover:bg-gain/20 text-label font-medium transition-colors disabled:opacity-50"
                      >
                        <Check className="size-3" /> Approve
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => reject(u.id)}
                        disabled={acting === u.id}
                        title="Reject"
                        className="flex items-center gap-1 px-2 py-1 rounded-sm bg-loss/10 text-loss hover:bg-loss/20 text-label font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="size-3" /> Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-caption font-mono text-secondary">{page} / {totalPages}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
