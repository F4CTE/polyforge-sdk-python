import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Ban, CheckCircle, Key, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate, formatDateTime } from '@/lib/utils';

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [userRes, keysRes] = await Promise.all([
          adminApi.user(id!),
          adminApi.userApiKeys(id!),
        ]);
        setUser(userRes);
        setApiKeys(keysRes?.data ?? []);
      } catch {
        toast.error('Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSuspend() {
    if (!id || !suspendReason.trim()) return;
    setActionLoading(true);
    try {
      await adminApi.suspendUser(id, suspendReason);
      setUser((u: any) => ({ ...u, suspended: true, suspendReason }));
      setShowSuspendDialog(false);
      setSuspendReason('');
      toast.success('User suspended');
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsuspend() {
    if (!id) return;
    setActionLoading(true);
    try {
      await adminApi.unsuspendUser(id);
      setUser((u: any) => ({ ...u, suspended: false, suspendReason: null }));
      toast.success('User unsuspended');
    } catch {
      toast.error('Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  }

  const [confirmRevokeKeyId, setConfirmRevokeKeyId] = useState<string | null>(null);

  async function revokeKey(keyId: string) {
    if (!id) return;
    setConfirmRevokeKeyId(null);
    try {
      await adminApi.revokeUserApiKey(id, keyId);
      setApiKeys((keys) => keys.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)));
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke key');
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-4 bg-[var(--color-pf-elevated)] rounded w-32" />
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 space-y-4">
          <div className="h-5 bg-[var(--color-pf-bg)] rounded w-48" />
          <div className="h-4 bg-[var(--color-pf-bg)] rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[var(--color-pf-bg)] rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-pf-text-secondary)]">User not found</p>
        <button
          type="button"
          onClick={() => navigate('/users')}
          className="mt-4 text-sm text-[var(--color-pf-cyan-500)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)] rounded"
        >
          Back to users
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/users')}
        className="flex items-center gap-1.5 text-sm text-[var(--color-pf-text-secondary)] hover:text-[var(--color-pf-text)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)] rounded-pf-sm"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to users
      </button>

      {/* User Info */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-pf-text)]">
              {user.username}
              {user.suspended && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium text-pf-danger bg-pf-danger/10">
                  SUSPENDED
                </span>
              )}
            </h2>
            <p className="text-sm text-[var(--color-pf-text-secondary)] mt-0.5">{user.email}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(user.status)}`}>
            {user.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--color-pf-text-tertiary)] text-xs mb-0.5">Created</div>
            <div className="text-[var(--color-pf-text)]">{formatDate(user.createdAt)}</div>
          </div>
          <div>
            <div className="text-[var(--color-pf-text-tertiary)] text-xs mb-0.5">Last Seen</div>
            <div className="text-[var(--color-pf-text)]">{formatDateTime(user.lastSeen)}</div>
          </div>
          <div>
            <div className="text-[var(--color-pf-text-tertiary)] text-xs mb-0.5">Strategies</div>
            <div className="text-[var(--color-pf-text)]">{user.strategyCount}</div>
          </div>
          <div>
            <div className="text-[var(--color-pf-text-tertiary)] text-xs mb-0.5">Orders</div>
            <div className="text-[var(--color-pf-text)]">{user.orderCount}</div>
          </div>
        </div>

        {user.limits && (
          <div className="mt-4 pt-4 border-t border-[var(--color-pf-border)]">
            <h3 className="text-xs font-semibold text-[var(--color-pf-text-tertiary)] uppercase tracking-wider mb-2">
              Limits
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-[var(--color-pf-text-tertiary)] text-xs">Max Strategies</div>
                <div className="text-[var(--color-pf-text)] font-medium">{user.limits.maxStrategies}</div>
              </div>
              <div>
                <div className="text-[var(--color-pf-text-tertiary)] text-xs">Orders/min</div>
                <div className="text-[var(--color-pf-text)] font-medium">{user.limits.maxOrdersPerMinute}</div>
              </div>
              <div>
                <div className="text-[var(--color-pf-text-tertiary)] text-xs">Max Position</div>
                <div className="text-[var(--color-pf-text)] font-medium">${user.limits.maxPositionSizeUsdc}</div>
              </div>
              <div>
                <div className="text-[var(--color-pf-text-tertiary)] text-xs">Daily Loss Limit</div>
                <div className="text-[var(--color-pf-text)] font-medium">${user.limits.maxDailyLossUsdc}</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-[var(--color-pf-border)] flex gap-3">
          {user.suspended ? (
            <button
             type="button"
              onClick={handleUnsuspend}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-success/10 text-pf-success hover:bg-pf-success/20 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success"
            >
              <CheckCircle size={14} />
              Unsuspend
            </button>
          ) : (
            <button
             type="button"
              onClick={() => setShowSuspendDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
            >
              <Ban size={14} />
              Suspend
            </button>
          )}
        </div>

        {/* Suspend Dialog */}
        {showSuspendDialog && (
          <div className="mt-4 p-4 rounded-pf-sm border border-pf-danger/20 bg-pf-danger/5">
            <h4 className="text-sm font-medium text-pf-danger mb-2">Suspend User</h4>
            <label htmlFor="suspend-reason" className="sr-only">Reason for suspension</label>
            <textarea
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-danger)] mb-3"
            />
            <div className="flex gap-2">
              <button
               type="button"
                onClick={handleSuspend}
                disabled={actionLoading || !suspendReason.trim()}
                className="px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/80 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
              >
                Confirm Suspend
              </button>
              <button
               type="button"
                onClick={() => setShowSuspendDialog(false)}
                className="px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-[var(--color-pf-cyan-500)]" />
          <h3 className="text-sm font-semibold text-[var(--color-pf-text)]">API Keys</h3>
        </div>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-[var(--color-pf-text-tertiary)]">No API keys</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">User API keys</caption>
              <thead>
                <tr className="border-b border-[var(--color-pf-border)]">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Name</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Prefix</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Scopes</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Created</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase">Status</th>
                  <th scope="col" className="text-right px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-[var(--color-pf-border)] last:border-0">
                    <td className="px-3 py-2.5 text-[var(--color-pf-text)]">{key.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-pf-text-secondary)]">
                      {key.prefix}...
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-pf-text-secondary)]">
                      {key.scopes.join(', ')}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-pf-text-tertiary)]">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      {key.revoked ? (
                        <span className="text-xs text-pf-danger">Revoked</span>
                      ) : (
                        <span className="text-xs text-pf-success">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!key.revoked && (
                        confirmRevokeKeyId === key.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-xs">
                            <button type="button" onClick={() => revokeKey(key.id)} className="px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger">Revoke</button>
                            <button type="button" onClick={() => setConfirmRevokeKeyId(null)} className="px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-pf-cyan-500)]">Cancel</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeKeyId(key.id)}
                            className="p-1 rounded hover:bg-pf-danger/10 text-[var(--color-pf-text-tertiary)] hover:text-pf-danger cursor-pointer transition-colors"
                            aria-label="Revoke key"
                            title="Revoke key"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
