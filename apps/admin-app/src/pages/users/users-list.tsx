import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { Button, Input, Select } from '@polyforge/ui';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, X, Wifi, Shield, Users, AlertCircle, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';

interface UserRow {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  polymarketConnected: boolean;
  suspended: boolean;
  approved: boolean | null;
  createdAt: string;
  [key: string]: unknown;
}

function computeUserStatus(user: UserRow): string {
  if (user.suspended) return 'SUSPENDED';
  if (user.approved === false) return 'PENDING';
  if (user.polymarketConnected) return 'CONNECTED';
  if (user.emailVerified) return 'VERIFIED';
  return 'UNVERIFIED';
}

function isTestAccount(user: UserRow): boolean {
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
  const [users, setUsers] = useState<UserRow[]>([]);
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

  async function handleApprove(userId: string, username: string | undefined) {
    try {
      await adminApi.approveUser(userId);
      toast.success(`${username} approved for beta access`);
      load();
    } catch { toast.error('Failed to approve user'); }
  }

  async function handleReject(userId: string, username: string | undefined) {
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
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit,
        search: search || undefined,
      };
      // Map status filter to backend-supported query params
      if (statusFilter === 'SUSPENDED') {
        params.suspended = true;
      } else if (statusFilter === 'CONNECTED') {
        params.polymarketConnected = true;
      }
      const res = await adminApi.users(params);
      let data = (res.data ?? []) as unknown as UserRow[];
      if (statusFilter && statusFilter !== 'SUSPENDED' && statusFilter !== 'CONNECTED') {
        data = data.filter((u) => computeUserStatus(u) === statusFilter);
      }
      setUsers(data);
      const clientFiltered = statusFilter && statusFilter !== 'SUSPENDED' && statusFilter !== 'CONNECTED';
      setTotal(clientFiltered ? data.length : (res.total ?? 0));
      setTotalPages(clientFiltered ? 1 : (res.totalPages ?? 1));
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
    if (sortField !== field) return <span className="text-tertiary/40 ml-1"><ChevronUp className="inline w-3 h-3" /><ChevronDown className="inline w-3 h-3" /></span>;
    return <span className="ml-1 text-accent">{sortDir === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />}</span>;
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
        <h2 className="text-lg font-semibold text-primary">
          Users <span className="text-sm font-normal text-tertiary">({total})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-input-min-md max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
            aria-hidden="true"
          />
          <Input
            type="text"
            placeholder="Search users..."
            aria-label="Search users"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-sm border border-default bg-app text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="px-3 py-2 text-sm rounded-sm border border-default bg-app text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending approval</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="CONNECTED">Connected</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={hideTestAccounts}
            onChange={(e) => setHideTestAccounts((e.target as HTMLInputElement).checked)}
            className="accent-accent"
          />
          <EyeOff size={14} aria-hidden="true" />
          Hide test accounts
        </label>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-3 text-tertiary" size={40} aria-hidden="true" />
          <p className="text-secondary mb-4">Failed to load data</p>
          <Button type="button" variant="ghost" onClick={load} className="text-accent-text hover:text-accent-text text-sm rounded-sm px-2 py-1">
            Try again
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-elevated border border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">User accounts list</caption>
            <thead>
              <tr className="border-b border-default">
                <th scope="col" onClick={() => toggleSort('username')} role="columnheader" aria-sort={sortField === 'username' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary select-none transition-colors">Username{sortIndicator('username')}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Email</th>
                <th scope="col" onClick={() => toggleSort('status')} role="columnheader" aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary select-none transition-colors">Status{sortIndicator('status')}</th>
                <th scope="col" onClick={() => toggleSort('emailVerified')} role="columnheader" aria-sort={sortField === 'emailVerified' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-center px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary select-none transition-colors">Verified{sortIndicator('emailVerified')}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">2FA</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Connected</th>
                <th scope="col" onClick={() => toggleSort('createdAt')} role="columnheader" aria-sort={sortField === 'createdAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary select-none transition-colors">Created{sortIndicator('createdAt')}</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface rounded-sm animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Users className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-secondary font-medium">No users found</p>
                    <p className="text-tertiary text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                displayUsers.map((user) => (
                  <tr
                    key={user.id}
                    tabIndex={0}
                    onClick={() => navigate(`/users/${user.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/users/${user.id}`); } }}
                    className="border-b border-default last:border-0 hover:bg-app focus-visible:bg-accent/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-primary">
                      <Link
                        to={`/users/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-accent-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                      >
                        {user.username ?? ''}
                      </Link>
                      {user.suspended && (
                        <span className="ml-2 px-2 py-1 rounded-sm text-caption font-medium text-loss bg-loss/10">
                          SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary">{user.email ?? ''}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(computeUserStatus(user))}`}>
                        {computeUserStatus(user)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.emailVerified ? (
                        <><Check size={14} className="inline text-gain" aria-hidden="true" /><span className="sr-only">Yes</span></>
                      ) : (
                        <><X size={14} className="inline text-tertiary" aria-hidden="true" /><span className="sr-only">No</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.totpEnabled ? (
                        <><Shield size={14} className="inline text-gain" aria-hidden="true" /><span className="sr-only">Enabled</span></>
                      ) : (
                        <><X size={14} className="inline text-tertiary" aria-hidden="true" /><span className="sr-only">Disabled</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.polymarketConnected ? (
                        <><Wifi size={14} className="inline text-gain" aria-hidden="true" /><span className="sr-only">Connected</span></>
                      ) : (
                        <><X size={14} className="inline text-tertiary" aria-hidden="true" /><span className="sr-only">Not connected</span></>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tertiary">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {computeUserStatus(user) === 'PENDING' && (
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="success"
                            onClick={(e) => { e.stopPropagation(); handleApprove(user.id, user.username); }}
                            className="px-2 py-1 text-xs font-medium rounded-sm bg-gain/10 text-gain hover:bg-gain/20 transition-colors"
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={(e) => { e.stopPropagation(); handleReject(user.id, user.username); }}
                            className="px-2 py-1 text-xs font-medium rounded-sm bg-loss/10 text-loss hover:bg-loss/20 transition-colors"
                          >
                            Reject
                          </Button>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-default">
            <span className="text-xs text-tertiary">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-2 rounded-sm hover:bg-app text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-2 rounded-sm hover:bg-app text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
