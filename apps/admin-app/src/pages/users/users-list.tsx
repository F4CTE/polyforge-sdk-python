import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Check, X, Wifi, Shield, Users, AlertCircle, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';

function computeUserStatus(user: Record<string, unknown>): string {
  if (user.suspended) return 'SUSPENDED';
  if (user.approved === false) return 'PENDING';
  if (user.polymarketConnected) return 'CONNECTED';
  if (user.emailVerified) return 'VERIFIED';
  return 'UNVERIFIED';
}

function isTestAccount(user: Record<string, unknown>): boolean {
  const email = (user.email ?? '').toLowerCase();
  const username = (user.username ?? '').toLowerCase();
  if (email.endsWith('@e2e.dev.local') || email.includes('e2e.')) return true;
  const testPrefixes = ['cred', 'reset', 'dup', 'verify', 'reg'];
  if (testPrefixes.some((p) => username.startsWith(p) && /\d/.test(username))) return true;
  return false;
}

type SortField = 'username' | 'status' | 'emailVerified' | 'createdAt';
type SortDir = 'asc' | 'desc';

export function Component() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hideTestAccounts, setHideTestAccounts] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const limit = 20;

  async function handleApprove(userId: string, username: string) {
    try {
      await adminApi.approveUser(userId);
      toast.success(`${username} approved for beta access`);
      load();
    } catch { toast.error('Failed to approve user'); }
  }

  async function handleReject(userId: string, username: string) {
    if (!window.confirm(`Are you sure you want to reject ${username}?`)) return;
    try {
      await adminApi.rejectUser(userId);
      toast.success(`${username} rejected`);
      load();
    } catch { toast.error('Failed to reject user'); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, unknown> = {
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
        data = data.filter((u: Record<string, unknown>) => computeUserStatus(u) === statusFilter);
      }
      setUsers(data);
      setTotal(statusFilter && statusFilter !== 'SUSPENDED' ? data.length : (res.total ?? 0));
      setTotalPages(statusFilter && statusFilter !== 'SUSPENDED' ? 1 : (res.totalPages ?? 1));
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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  function handleSearch(value: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return <span className="text-[var(--color-pf-text-tertiary)]/40 ml-1">{'▲▼'}</span>;
    return <span className="ml-1 text-[var(--color-pf-cyan-500)]">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  const displayUsers = useMemo(() => {
    let list = hideTestAccounts ? users.filter((u) => !isTestAccount(u)) : users;
    list = [...list].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortField) {
        case 'username': av = (a.username ?? '').toLowerCase(); bv = (b.username ?? '').toLowerCase(); break;
        case 'status': av = computeUserStatus(a); bv = computeUserStatus(b); break;
        case 'emailVerified': av = a.emailVerified ? 1 : 0; bv = b.emailVerified ? 1 : 0; break;
        case 'createdAt': av = a.createdAt ?? ''; bv = b.createdAt ?? ''; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [users, hideTestAccounts, sortField, sortDir]);

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
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search users..."
            aria-label="Search users"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending approval</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="CONNECTED">Connected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--color-pf-text-secondary)] cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={hideTestAccounts}
            onChange={(e) => setHideTestAccounts((e.target as HTMLInputElement).checked)}
            className="accent-[var(--color-pf-cyan-500)]"
          />
          <EyeOff size={14} aria-hidden="true" />
          Hide test accounts
        </label>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)]" size={40} aria-hidden="true" />
          <p className="text-[var(--color-pf-text-secondary)] mb-4">Failed to load data</p>
          <button type="button" onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)] rounded-pf-sm px-2 py-1">
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">User accounts list</caption>
            <thead>
              <tr className="border-b border-[var(--color-pf-border)]">
                <th scope="col" onClick={() => toggleSort('username')} role="columnheader" aria-sort={sortField === 'username' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-pf-text-secondary)] select-none transition-colors">Username{sortIndicator('username')}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Email</th>
                <th scope="col" onClick={() => toggleSort('status')} role="columnheader" aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-pf-text-secondary)] select-none transition-colors">Status{sortIndicator('status')}</th>
                <th scope="col" onClick={() => toggleSort('emailVerified')} role="columnheader" aria-sort={sortField === 'emailVerified' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-pf-text-secondary)] select-none transition-colors">Verified{sortIndicator('emailVerified')}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">2FA</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Connected</th>
                <th scope="col" onClick={() => toggleSort('createdAt')} role="columnheader" aria-sort={sortField === 'createdAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-pf-text-secondary)] select-none transition-colors">Created{sortIndicator('createdAt')}</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider">Actions</th>
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
              ) : displayUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Users className="mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40" size={40} aria-hidden="true" />
                    <p className="text-[var(--color-pf-text-secondary)] font-medium">No users found</p>
                    <p className="text-[var(--color-pf-text-tertiary)] text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                displayUsers.map((user) => (
                  <tr
                    key={user.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/users/${user.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/users/${user.id}`); } }}
                    className="border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] focus-visible:bg-[var(--color-pf-cyan-500)]/5 cursor-pointer transition-colors"
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
                        <><Check size={14} className="inline text-pf-success" aria-hidden="true" /><span className="sr-only">Yes</span></>
                      ) : (
                        <><X size={14} className="inline text-[var(--color-pf-text-tertiary)]" aria-hidden="true" /><span className="sr-only">No</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.totpEnabled ? (
                        <><Shield size={14} className="inline text-pf-success" aria-hidden="true" /><span className="sr-only">Enabled</span></>
                      ) : (
                        <><X size={14} className="inline text-[var(--color-pf-text-tertiary)]" aria-hidden="true" /><span className="sr-only">Disabled</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.polymarketConnected ? (
                        <><Wifi size={14} className="inline text-pf-success" aria-hidden="true" /><span className="sr-only">Connected</span></>
                      ) : (
                        <><X size={14} className="inline text-[var(--color-pf-text-tertiary)]" aria-hidden="true" /><span className="sr-only">Not connected</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-pf-text-tertiary)]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {computeUserStatus(user) === 'PENDING' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleApprove(user.id, user.username); }}
                            className="px-2 py-1 text-xs font-medium rounded bg-pf-success/10 text-pf-success hover:bg-pf-success/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleReject(user.id, user.username); }}
                            className="px-2 py-1 text-xs font-medium rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
                          >
                            Reject
                          </button>
                        </div>
                      )}
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
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]"
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
