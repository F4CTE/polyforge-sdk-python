import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Check, X, Wifi, Shield, Users, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';

function computeUserStatus(user: any): string {
  if (user.suspended) return 'SUSPENDED';
  if (user.polymarketConnected) return 'CONNECTED';
  if (user.emailVerified) return 'VERIFIED';
  return 'UNVERIFIED';
}

export function Component() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, any> = {
        page,
        limit,
        search: search || undefined,
      };
      // Map status filter to backend-supported query params
      if (statusFilter === 'SUSPENDED') {
        params.suspended = true;
      }
      const res = await adminApi.users(params);
      let data = res.data ?? [];
      // Client-side filtering for statuses not supported by backend
      if (statusFilter && statusFilter !== 'SUSPENDED') {
        data = data.filter((u: any) => computeUserStatus(u) === statusFilter);
      }
      setUsers(data);
      setTotal(statusFilter && statusFilter !== 'SUSPENDED' ? data.length : (res.total ?? 0));
      setTotalPages(statusFilter && statusFilter !== 'SUSPENDED' ? 1 : (res.pages ?? 1));
    } catch {
      setError(true);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  function handleSearch(value: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
          Users <span className="text-sm font-normal text-[var(--color-pf-text-tertiary)]">({total})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-pf-text-tertiary)]"
          />
          <input
            type="text"
            placeholder="Search users..."
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
        >
          <option value="">All statuses</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="CONNECTED">Connected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)]" size={40} />
          <p className="text-[var(--color-pf-text-secondary)] mb-4">Failed to load data</p>
          <button onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm">
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Username</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Verified</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">2FA</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Connected</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Users className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No users found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/users/${user.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/users/${user.id}`); }}
                    className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-pf-text)]">
                      {user.username ?? ''}
                      {user.suspended && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-pf-danger bg-pf-danger/10">
                          SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-secondary)]">{user.email ?? ''}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(computeUserStatus(user))}`}>
                        {computeUserStatus(user)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.emailVerified ? (
                        <Check size={14} className="inline text-pf-success" />
                      ) : (
                        <X size={14} className="inline text-[var(--color-pf-text-tertiary)]" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.totpEnabled ? (
                        <Shield size={14} className="inline text-pf-success" />
                      ) : (
                        <X size={14} className="inline text-[var(--color-pf-text-tertiary)]" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.polymarketConnected ? (
                        <Wifi size={14} className="inline text-pf-success" />
                      ) : (
                        <X size={14} className="inline text-[var(--color-pf-text-tertiary)]" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]">
            <span className="text-xs text-[var(--color-pf-text-tertiary)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
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
