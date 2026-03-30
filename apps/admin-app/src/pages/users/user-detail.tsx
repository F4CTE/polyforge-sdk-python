import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Ban, CheckCircle, Key, Trash2, Target } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate, formatDateTime } from '@/lib/utils';

interface UserDetail {
  id: string;
  username: string;
  email: string;
  status: string;
  suspended: boolean;
  suspendReason?: string | null;
  createdAt: string;
  lastSeen: string;
  strategyCount: number;
  orderCount: number;
  limits?: {
    maxStrategies: number;
    maxOrdersPerMinute: number;
    maxPositionSizeUsdc: number;
    maxDailyLossUsdc: number;
  };
  [key: string]: unknown;
}

interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  revoked: boolean;
  [key: string]: unknown;
}

interface AccuracyData {
  brierScore: number | null;
  totalPredictions: number;
  correctPredictions: number;
  winRate: string;
  calibration: { bucket: string; frequency: number; count: number }[];
  byCategory: unknown;
}

type ActiveTab = 'overview' | 'accuracy';

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [accuracyLoaded, setAccuracyLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [userRes, keysRes] = await Promise.all([
          adminApi.user(id!),
          adminApi.userApiKeys(id!),
        ]);
        setUser(userRes as unknown as UserDetail);
        setApiKeys((keysRes?.data ?? []) as unknown as ApiKeyView[]);
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
      setUser((u) => u ? ({ ...u, suspended: true, suspendReason }) : u);
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
      setUser((u) => u ? ({ ...u, suspended: false, suspendReason: null }) : u);
      toast.success('User unsuspended');
    } catch {
      toast.error('Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  }

  async function loadAccuracy() {
    if (!id || accuracyLoaded) return;
    setAccuracyLoading(true);
    try {
      const res = await adminApi.userAccuracy(id);
      setAccuracy(res as unknown as AccuracyData);
    } catch {
      toast.error('Failed to load accuracy data');
    } finally {
      setAccuracyLoading(false);
      setAccuracyLoaded(true);
    }
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === 'accuracy' && !accuracyLoaded) {
      loadAccuracy();
    }
  }

  const [confirmRevokeKeyId, setConfirmRevokeKeyId] = useState<string | null>(null);

  async function revokeKey(keyId: string) {
    if (!id) return;
    setConfirmRevokeKeyId(null);
    try {
      await adminApi.revokeUserApiKey(id, keyId);
      setApiKeys((keys) => keys.map((k): ApiKeyView => (k.id === keyId ? { ...k, revoked: true } : k)));
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke key');
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" role="status" aria-label="Loading user details">
        <div className="h-4 bg-pf-elevated rounded w-32" />
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
          <div className="h-5 bg-pf-base rounded w-48" />
          <div className="h-4 bg-pf-base rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-pf-base rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-pf-text-secondary">User not found</p>
        <button
          type="button"
          onClick={() => navigate('/users')}
          className="mt-4 text-sm text-pf-cyan-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded"
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
        className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-pf-sm"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to users
      </button>

      {/* User Info */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-pf-text">
              {user.username}
              {user.suspended && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium text-pf-danger bg-pf-danger/10">
                  SUSPENDED
                </span>
              )}
            </h2>
            <p className="text-sm text-pf-text-secondary mt-0.5">{user.email}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(user.status)}`}>
            {user.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-pf-text-tertiary text-xs mb-0.5">Created</div>
            <div className="text-pf-text">{formatDate(user.createdAt)}</div>
          </div>
          <div>
            <div className="text-pf-text-tertiary text-xs mb-0.5">Last Seen</div>
            <div className="text-pf-text">{formatDateTime(user.lastSeen)}</div>
          </div>
          <div>
            <div className="text-pf-text-tertiary text-xs mb-0.5">Strategies</div>
            <div className="text-pf-text">{user.strategyCount}</div>
          </div>
          <div>
            <div className="text-pf-text-tertiary text-xs mb-0.5">Orders</div>
            <div className="text-pf-text">{user.orderCount}</div>
          </div>
        </div>

        {user.limits && (
          <div className="mt-4 pt-4 border-t border-pf-border">
            <h3 className="text-xs font-semibold text-pf-text-tertiary uppercase tracking-wider mb-2">
              Limits
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-pf-text-tertiary text-xs">Max Strategies</div>
                <div className="text-pf-text font-medium">{user.limits.maxStrategies}</div>
              </div>
              <div>
                <div className="text-pf-text-tertiary text-xs">Orders/min</div>
                <div className="text-pf-text font-medium">{user.limits.maxOrdersPerMinute}</div>
              </div>
              <div>
                <div className="text-pf-text-tertiary text-xs">Max Position</div>
                <div className="text-pf-text font-medium">${user.limits.maxPositionSizeUsdc}</div>
              </div>
              <div>
                <div className="text-pf-text-tertiary text-xs">Daily Loss Limit</div>
                <div className="text-pf-text font-medium">${user.limits.maxDailyLossUsdc}</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-pf-border flex gap-3">
          {user.suspended ? (
            <button
             type="button"
              onClick={handleUnsuspend}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-success/10 text-pf-success hover:bg-pf-success/20 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success"
            >
              <CheckCircle size={14} aria-hidden="true" />
              Unsuspend
            </button>
          ) : (
            <button
             type="button"
              onClick={() => setShowSuspendDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
            >
              <Ban size={14} aria-hidden="true" />
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
              className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text placeholder:text-pf-text-tertiary focus:outline-none focus:ring-1 focus:ring-pf-danger mb-3"
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
                className="px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-base cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-pf-border mb-4" role="tablist" aria-label="User sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-t-pf-sm -mb-px border-b-2 ${
              activeTab === 'overview'
                ? 'border-pf-cyan-500 text-pf-cyan-500'
                : 'border-transparent text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            API Keys
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accuracy'}
            onClick={() => handleTabChange('accuracy')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-t-pf-sm -mb-px border-b-2 ${
              activeTab === 'accuracy'
                ? 'border-pf-cyan-500 text-pf-cyan-500'
                : 'border-transparent text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            <Target size={14} aria-hidden="true" />
            Accuracy
          </button>
        </div>

        {/* Accuracy Tab */}
        {activeTab === 'accuracy' && (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            {accuracyLoading ? (
              <div className="animate-pulse space-y-4" role="status" aria-label="Loading accuracy data">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-pf-base rounded" />)}
                </div>
              </div>
            ) : accuracy && accuracy.totalPredictions === 0 ? (
              <div className="text-center py-10">
                <Target className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={36} aria-hidden="true" />
                <p className="text-pf-text-secondary font-medium">No resolved predictions yet</p>
                <p className="text-pf-text-tertiary text-xs mt-1">Accuracy stats will appear once predictions resolve.</p>
              </div>
            ) : accuracy ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                    <div className="text-pf-text-tertiary text-xs mb-1">Brier Score</div>
                    <div className="text-2xl font-bold text-pf-text">
                      {accuracy.brierScore !== null ? accuracy.brierScore.toFixed(3) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                    <div className="text-pf-text-tertiary text-xs mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-pf-success">{accuracy.winRate}</div>
                  </div>
                  <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                    <div className="text-pf-text-tertiary text-xs mb-1">Total Predictions</div>
                    <div className="text-2xl font-bold text-pf-text">{accuracy.totalPredictions.toLocaleString()}</div>
                  </div>
                  <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                    <div className="text-pf-text-tertiary text-xs mb-1">Correct</div>
                    <div className="text-2xl font-bold text-pf-text">{accuracy.correctPredictions.toLocaleString()}</div>
                  </div>
                </div>

                {Array.isArray(accuracy.calibration) && accuracy.calibration.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-pf-text-tertiary uppercase tracking-wider mb-2">
                      Calibration
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">Calibration buckets</caption>
                        <thead>
                          <tr className="border-b border-pf-border">
                            <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Bucket</th>
                            <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Frequency</th>
                            <th scope="col" className="text-right px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accuracy.calibration.map((row, i) => (
                            <tr key={i} className="border-b border-pf-border last:border-0">
                              <td className="px-3 py-2 text-pf-text font-mono">{row.bucket}</td>
                              <td className="px-3 py-2 text-right text-pf-text-secondary">{row.frequency}</td>
                              <td className="px-3 py-2 text-right text-pf-text-secondary">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <Target className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={36} aria-hidden="true" />
                <p className="text-pf-text-secondary font-medium">No resolved predictions yet</p>
                <p className="text-pf-text-tertiary text-xs mt-1">Accuracy stats will appear once predictions resolve.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Keys */}
      {activeTab === 'overview' && (
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-pf-cyan-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-pf-text">API Keys</h3>
        </div>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-pf-text-tertiary">No API keys</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">User API keys</caption>
              <thead>
                <tr className="border-b border-pf-border">
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Name</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Prefix</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Scopes</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Created</th>
                  <th scope="col" className="text-left px-3 py-2 text-xs font-medium text-pf-text-tertiary uppercase">Status</th>
                  <th scope="col" className="text-right px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-pf-border last:border-0">
                    <td className="px-3 py-2.5 text-pf-text">{key.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-pf-text-secondary">
                      {key.prefix}...
                    </td>
                    <td className="px-3 py-2.5 text-pf-text-secondary">
                      {key.scopes.join(', ')}
                    </td>
                    <td className="px-3 py-2.5 text-pf-text-tertiary">
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
                            <button type="button" onClick={() => setConfirmRevokeKeyId(null)} className="px-2 py-0.5 rounded bg-pf-elevated text-pf-text-secondary hover:bg-pf-base cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500">Cancel</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeKeyId(key.id)}
                            className="p-1 rounded hover:bg-pf-danger/10 text-pf-text-tertiary hover:text-pf-danger cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
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
      )}
    </div>
  );
}
