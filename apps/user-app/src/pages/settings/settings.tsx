import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  User, Bell, Lock, Shield, Key, Loader2, Check, Copy, Ban, Eye, EyeOff, Fuel, Trash2, AlertTriangle, ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Tab = 'profile' | 'notifications' | 'password' | '2fa' | 'apikeys' | 'gas' | 'risk';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt?: string | null;
  revoked: boolean;
  key?: string;
}

interface GasUsageData {
  todayUsage: number;
  dailyLimit: number;
  remaining: number;
  sponsorEnabled: boolean;
}

interface TotpSetupData {
  secret: string;
  qrCode: string;       // data URL from API (was incorrectly named qrCodeUri)
  uri: string;
  backupCodes?: string[]; // only returned by /confirm, not /setup
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const TABS: { label: string; value: Tab; icon: React.ReactNode }[] = [
  { label: 'Profile', value: 'profile', icon: <User className="size-3.5" /> },
  { label: 'Notifications', value: 'notifications', icon: <Bell className="size-3.5" /> },
  { label: 'Password', value: 'password', icon: <Lock className="size-3.5" /> },
  { label: '2FA', value: '2fa', icon: <Shield className="size-3.5" /> },
  { label: 'API Keys', value: 'apikeys', icon: <Key className="size-3.5" /> },
  { label: 'Gas Usage', value: 'gas', icon: <Fuel className="size-3.5" /> },
  { label: 'Risk', value: 'risk', icon: <ShieldAlert className="size-3.5" /> },
];

const NOTIF_ITEMS = [
  { key: 'orderFilled', label: 'Order Filled', desc: 'When one of your orders is matched and filled' },
  { key: 'strategyError', label: 'Strategy Error', desc: 'When a strategy encounters a runtime error' },
  { key: 'backtestComplete', label: 'Backtest Complete', desc: 'When a backtest run finishes' },
  { key: 'priceAlert', label: 'Price Alert', desc: 'When a watched market crosses your price target' },
  { key: 'dailyLossLimit', label: 'Daily Loss Limit', desc: 'When you approach your configured daily loss limit' },
  { key: 'marketResolved', label: 'Market Resolved', desc: 'When a market you hold positions in resolves' },
  { key: 'follow', label: 'New Follower', desc: 'When someone follows your profile' },
] as const;

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { user, patchUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Update profile form when user changes
  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setBio(user?.bio ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
  }, [user]);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // 2FA
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);

  // Notifications — fetch from API on mount, fallback to defaults
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    orderFilled: true, strategyError: true, backtestComplete: true, priceAlert: false,
    dailyLossLimit: true, marketResolved: false, follow: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/settings/notifications', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNotifPrefs(prev => ({ ...prev, ...data })); })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState({ read: true, write: false, trade: false });
  const [newKeyExpiration, setNewKeyExpiration] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [apiKeysCreating, setApiKeysCreating] = useState(false);

  // Gas Usage
  const [gasUsage, setGasUsage] = useState<GasUsageData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);

  // Risk / Circuit Breaker
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskResetting, setRiskResetting] = useState(false);
  const [drawdownEnabled, setDrawdownEnabled] = useState(false);
  const [drawdownLookbackHours, setDrawdownLookbackHours] = useState(24);
  const [drawdownThresholdPct, setDrawdownThresholdPct] = useState(10);
  const [circuitBreakerTripped, setCircuitBreakerTripped] = useState(false);
  const [circuitBreakerTrippedAt, setCircuitBreakerTrippedAt] = useState<string | null>(null);

  async function loadGasUsage() {
    setGasLoading(true);
    try {
      const res = await fetch('/api/v1/settings/gas', { credentials: 'include' });
      if (res.ok) setGasUsage(await res.json());
    } catch { toast.error('Failed to load gas usage'); }
    setGasLoading(false);
  }

  async function loadRiskSettings() {
    setRiskLoading(true);
    try {
      const res = await fetch('/api/v1/settings/risk', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDrawdownEnabled(data.drawdownEnabled ?? false);
        setDrawdownLookbackHours(data.drawdownLookbackHours ?? 24);
        setDrawdownThresholdPct(Math.round((data.drawdownThresholdPct ?? 0.1) * 100));
        setCircuitBreakerTripped(data.circuitBreakerTripped ?? false);
        setCircuitBreakerTrippedAt(data.circuitBreakerTrippedAt ?? null);
      }
    } catch { toast.error('Failed to load risk settings'); }
    setRiskLoading(false);
  }

  async function saveRiskSettings() {
    if (riskSaving) return;
    setRiskSaving(true);
    try {
      const res = await fetch('/api/v1/settings/risk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          drawdownEnabled,
          drawdownLookbackHours,
          drawdownThresholdPct: drawdownThresholdPct / 100,
        }),
      });
      if (res.ok) {
        toast.success('Risk settings saved');
      } else {
        toast.error('Failed to save risk settings');
      }
    } catch { toast.error('Failed to save risk settings'); }
    setRiskSaving(false);
  }

  async function resetCircuitBreaker() {
    if (riskResetting) return;
    setRiskResetting(true);
    try {
      const res = await fetch('/api/v1/settings/risk/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCircuitBreakerTripped(false);
        setCircuitBreakerTrippedAt(null);
        toast.success('Circuit breaker reset — strategies can resume trading');
      } else {
        toast.error('Failed to reset circuit breaker');
      }
    } catch { toast.error('Failed to reset circuit breaker'); }
    setRiskResetting(false);
  }

  function handleTab(t: Tab) {
    setActiveTab(t);
    if (t === 'apikeys' && apiKeys.length === 0) loadApiKeys();
    if (t === 'gas' && !gasUsage) loadGasUsage();
    if (t === 'risk') loadRiskSettings();
  }

  // ── Profile ──
  async function saveProfile() {
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      const res = await fetch('/api/v1/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: displayName || undefined, bio: bio || undefined, avatarUrl: avatarUrl || undefined }),
      });
      if (res.ok) {
        patchUser({ displayName, bio, avatarUrl });
        toast.success('Profile saved');
      } else {
        toast.error('Failed to save profile');
      }
    } catch { toast.error('Failed to save profile'); }
    setProfileSaving(false);
  }

  // ── Password ──
  async function savePassword() {
    if (pwSaving) return;
    if (newPassword !== confirmPassword) return;
    setPwSaving(true);
    try {
      const res = await fetch('/api/v1/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Password changed');
      } else {
        toast.error('Failed to change password');
      }
    } catch { toast.error('Failed to change password'); }
    setPwSaving(false);
  }

  // ── TOTP ──
  async function startTotpSetup() {
    setTotpLoading(true);
    try {
      const res = await fetch('/auth/v1/totp/setup', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        setTotpSetupData(await res.json());
      } else {
        toast.error('Failed to start 2FA setup');
      }
    } catch { toast.error('Failed to start 2FA setup'); } finally { setTotpLoading(false); }
  }

  async function confirmTotp() {
    if (totpSaving || !totpCode) return;
    setTotpSaving(true);
    try {
      const res = await fetch('/auth/v1/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: totpCode }),
      });
      if (res.ok) {
        const data = await res.json();
        patchUser({ totpEnabled: true });
        // Keep setupData so we can show the backup codes returned by confirm
        setTotpSetupData(prev => prev ? { ...prev, backupCodes: data.backupCodes ?? [] } : null);
        setTotpCode('');
        toast.success('Two-factor authentication enabled! Save your backup codes.');
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.message ?? 'Invalid code. Please try again.');
      }
    } catch { toast.error('Failed to confirm 2FA'); }
    setTotpSaving(false);
  }

  async function disableTotp() {
    if (totpSaving || !totpDisablePassword) return;
    setTotpSaving(true);
    try {
      const res = await fetch('/auth/v1/totp', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: totpDisablePassword }),
      });
      if (res.ok) {
        patchUser({ totpEnabled: false });
        setTotpDisablePassword('');
        toast.success('Two-factor authentication disabled');
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.message ?? 'Failed to disable 2FA');
      }
    } catch { toast.error('Failed to disable 2FA'); }
    setTotpSaving(false);
  }

  // ── Notifications ──
  async function saveNotifications() {
    if (notifSaving) return;
    setNotifSaving(true);
    try {
      const res = await fetch('/api/v1/profile/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(notifPrefs),
      });
      if (res.ok) {
        toast.success('Notification preferences saved');
      } else {
        toast.error('Failed to save notification preferences');
      }
    } catch { toast.error('Failed to save notification preferences'); }
    setNotifSaving(false);
  }

  // ── API Keys ──
  async function loadApiKeys() {
    setApiKeysLoading(true);
    try {
      const res = await fetch('/api/v1/api-keys', { credentials: 'include' });
      if (res.ok) setApiKeys(await res.json());
    } catch { toast.error('Failed to load API keys'); }
    setApiKeysLoading(false);
  }

  async function createApiKey() {
    if (apiKeysCreating || !newKeyName.trim()) return;
    setApiKeysCreating(true);
    const scopes: string[] = [];
    if (newKeyScopes.read) scopes.push('READ');
    if (newKeyScopes.write) scopes.push('WRITE');
    if (newKeyScopes.trade) scopes.push('TRADE');
    try {
      const body: Record<string, unknown> = { name: newKeyName.trim(), scopes };
      if (newKeyExpiration) body.expiresAt = new Date(newKeyExpiration).toISOString();
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        setCreatedKey(created);
        setApiKeys(prev => [created, ...prev]);
        setNewKeyName('');
        setNewKeyScopes({ read: true, write: false, trade: false });
        setNewKeyExpiration('');
        toast.success('API key created');
      } else {
        toast.error('Failed to create API key');
      }
    } catch { toast.error('Failed to create API key'); }
    setApiKeysCreating(false);
  }

  async function revokeApiKey(id: string) {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setApiKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: true } : k));
        toast.success('API key revoked');
      }
    } catch { toast.error('Failed to revoke API key'); }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
  }

  // Delete Account
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (deleting || !deletePassword) return;
    setDeleting(true);
    try {
      const res = await fetch('/auth/v1/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        toast.success('Account deleted');
        navigate('/login');
      } else {
        const err = await res.json();
        toast.error(err?.message ?? 'Failed to delete account');
      }
    } catch { toast.error('Failed to delete account'); }
    setDeleting(false);
  }

  return (
    <div className="animate-fade-in p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Settings</h1>
        <div className="text-right">
          <Link
            to="/settings/trading-account"
            className="text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
          >
            Manage Trading Account &rarr;
          </Link>
          <p className="text-xs text-pf-text-muted mt-0.5">Connect or manage your Polymarket wallet</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button
            type="button"
            key={t.value}
            onClick={() => handleTab(t.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              activeTab === t.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Profile Tab ─── */}
      {activeTab === 'profile' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Public Profile</h2>
          <div>
            <label htmlFor="settings-display-name" className="text-xs text-pf-text-secondary mb-1.5 block">Display Name</label>
            <input id="settings-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name"
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
          </div>
          <div>
            <label htmlFor="settings-bio" className="text-xs text-pf-text-secondary mb-1.5 block">Bio</label>
            <textarea id="settings-bio" value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell others about yourself..."
              className="w-full px-3 py-2.5 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors resize-y" />
          </div>
          <div>
            <label htmlFor="settings-avatar-url" className="text-xs text-pf-text-secondary mb-1.5 block">Avatar URL</label>
            <div className="flex items-center gap-3">
              <input id="settings-avatar-url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..."
                className="flex-1 h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              {avatarUrl && <img src={avatarUrl} alt="Avatar preview" className="w-12 h-12 rounded-full object-cover border border-pf-border" />}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={saveProfile} disabled={profileSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
              {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Profile
            </button>
          </div>

          {/* ─── Danger Zone ─── */}
          <div className="mt-10 pt-6 border-t-2 border-pf-danger/20 bg-pf-elevated border border-pf-danger/20 rounded-pf-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-pf-danger uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Danger Zone
            </h2>
            <p className="text-sm text-pf-text-secondary">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 transition-colors"
            >
              <Trash2 className="size-4" />
              Delete Account
            </button>

            {deleteDialogOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onKeyDown={(e) => { if (e.key === 'Escape') { setDeleteDialogOpen(false); setDeletePassword(''); } }}>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 max-w-md w-full mx-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-pf-danger/10 flex items-center justify-center">
                      <AlertTriangle className="size-5 text-pf-danger" />
                    </div>
                    <div>
                      <h3 id="delete-dialog-title" className="text-base font-semibold text-pf-text">Delete Account</h3>
                      <p className="text-xs text-pf-text-muted">This cannot be undone</p>
                    </div>
                  </div>
                  <div className="bg-pf-danger/5 border border-pf-danger/10 rounded-pf p-3">
                    <p className="text-sm text-pf-danger">
                      This will permanently delete your account. All strategies will be stopped.
                      All API keys will be revoked. All data will be lost.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="settings-delete-password" className="text-xs text-pf-text-secondary mb-1.5 block">Enter your password to confirm</label>
                    <input
                      id="settings-delete-password"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-danger/50 transition-colors"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); }}
                      className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text rounded-pf hover:bg-pf-overlay transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting || !deletePassword}
                      className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger text-white text-sm font-medium hover:bg-pf-danger/80 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete My Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Notifications Tab ─── */}
      {activeTab === 'notifications' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-1">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider mb-4">Email & In-App Notifications</h2>
          {NOTIF_ITEMS.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-pf-border-subtle last:border-0">
              <div>
                <div className="text-sm font-medium text-pf-text">{item.label}</div>
                <div className="text-xs text-pf-text-secondary mt-0.5">{item.desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[item.key]}
                aria-label={`${item.label} notifications`}
                onClick={() => setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative w-10 h-5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated transition-colors ${notifPrefs[item.key] ? 'bg-pf-cyan-500' : 'bg-pf-overlay'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <button type="button" onClick={saveNotifications} disabled={notifSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
              {notifSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* ─── Password Tab ─── */}
      {activeTab === 'password' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Change Password</h2>
          <div>
            <label htmlFor="settings-current-password" className="text-xs text-pf-text-secondary mb-1.5 block">Current Password</label>
            <div className="relative">
              <input id="settings-current-password" type={showCurrentPw ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm" aria-label="Toggle password visibility">
                {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="settings-new-password" className="text-xs text-pf-text-secondary mb-1.5 block">New Password</label>
            <div className="relative">
              <input id="settings-new-password" type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm" aria-label="Toggle password visibility">
                {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="text-xs text-pf-text-secondary mb-1.5 block">Confirm New Password</label>
            <input id="settings-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="text-xs text-pf-danger mt-1 block">Passwords do not match</span>
            )}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={savePassword} disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
              {pwSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Change Password
            </button>
          </div>
        </div>
      )}

      {/* ─── 2FA Tab ─── */}
      {activeTab === '2fa' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Two-Factor Authentication (TOTP)</h2>

          {user?.totpEnabled && totpSetupData && (totpSetupData.backupCodes ?? []).length > 0 ? (
            /* Just confirmed — show backup codes before clearing */
            <>
              <p className="text-sm text-pf-success font-medium">2FA is now enabled!</p>
              <div className="bg-pf-surface rounded-pf p-4 border border-pf-warning/30">
                <div className="text-xs text-pf-warning mb-2 font-semibold uppercase tracking-wider">Save your backup codes — you won't see these again</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(totpSetupData.backupCodes ?? []).map(code => (
                    <span key={code} className="font-mono text-xs text-pf-text bg-pf-overlay px-2 py-1.5 rounded text-center border border-pf-border">{code}</span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setTotpSetupData(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors">
                <Check className="size-4" />
                I've saved my backup codes
              </button>
            </>
          ) : user?.totpEnabled ? (
            <>
              <p className="text-sm text-pf-text-secondary">
                2FA is currently <strong className="text-pf-success">enabled</strong>.
              </p>
              <div>
                <label htmlFor="settings-totp-disable-password" className="text-xs text-pf-text-secondary mb-1.5 block">Enter your password to disable 2FA</label>
                <input id="settings-totp-disable-password" type="password" value={totpDisablePassword} onChange={e => setTotpDisablePassword(e.target.value)} placeholder="Your password"
                  className="w-full max-w-[280px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              </div>
              <button type="button" onClick={disableTotp} disabled={totpSaving || !totpDisablePassword}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
                {totpSaving ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                Disable 2FA
              </button>
            </>
          ) : totpSetupData ? (
            <>
              <p className="text-sm text-pf-text-secondary">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
              <div className="flex justify-center py-4">
                <img src={totpSetupData.qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-pf-lg bg-white p-2" />
              </div>
              <div>
                <label htmlFor="settings-totp-code" className="text-xs text-pf-text-secondary mb-1.5 block">Verification Code</label>
                <input id="settings-totp-code" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="6-digit code" maxLength={6}
                  className="w-full max-w-[200px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              </div>
              {(totpSetupData.backupCodes ?? []).length > 0 && (
                <div className="bg-pf-surface rounded-pf p-4">
                  <div className="text-xs text-pf-text-secondary mb-2 font-medium">Backup Codes (save these!)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(totpSetupData.backupCodes ?? []).map(code => (
                      <span key={code} className="font-mono text-xs text-pf-text bg-pf-overlay px-2 py-1 rounded text-center">{code}</span>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={confirmTotp} disabled={totpSaving || !totpCode}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
                {totpSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirm & Enable 2FA
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-pf-text-secondary">
                2FA is currently <strong className="text-pf-text-muted">disabled</strong>. Add an extra layer of security to your account.
              </p>
              <button type="button" onClick={startTotpSetup} disabled={totpLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
                {totpLoading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                {totpLoading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── Gas Usage Tab ─── */}
      {activeTab === 'gas' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Gas Sponsorship</h2>
          <p className="text-sm text-pf-text-secondary">
            Polyforge absorbs Polygon gas fees so you can trade without worrying about network costs.
          </p>
          {gasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-pf-overlay rounded animate-pulse" />
              ))}
            </div>
          ) : gasUsage ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-pf-surface rounded-pf p-4 border border-pf-border-subtle">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Today's Usage</span>
                  <span className="block mt-1 text-lg font-mono font-semibold text-pf-text">
                    {gasUsage.todayUsage.toFixed(4)} MATIC
                  </span>
                </div>
                <div className="bg-pf-surface rounded-pf p-4 border border-pf-border-subtle">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Daily Limit</span>
                  <span className="block mt-1 text-lg font-mono font-semibold text-pf-text">
                    {gasUsage.dailyLimit.toFixed(4)} MATIC
                  </span>
                </div>
                <div className="bg-pf-surface rounded-pf p-4 border border-pf-border-subtle">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Remaining</span>
                  <span className={`block mt-1 text-lg font-mono font-semibold ${gasUsage.remaining > 0.1 ? 'text-pf-success' : 'text-pf-danger'}`}>
                    {gasUsage.remaining.toFixed(4)} MATIC
                  </span>
                </div>
              </div>

              {/* Usage bar */}
              <div>
                <div className="flex justify-between text-xs text-pf-text-secondary mb-1.5">
                  <span>Usage</span>
                  <span>{((gasUsage.todayUsage / gasUsage.dailyLimit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-pf-overlay rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      gasUsage.todayUsage / gasUsage.dailyLimit > 0.8 ? 'bg-pf-danger' : 'bg-pf-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, (gasUsage.todayUsage / gasUsage.dailyLimit) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${gasUsage.sponsorEnabled ? 'bg-pf-success' : 'bg-pf-danger'}`} />
                <span className="text-pf-text-secondary">
                  Gas sponsorship is currently {gasUsage.sponsorEnabled ? 'active' : 'inactive'}
                </span>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={loadGasUsage}
                  className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong transition-colors">
                  <Fuel className="size-4" />
                  Refresh
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Fuel className="size-8 text-pf-text-muted mb-2" />
              <p className="text-sm text-pf-text-muted">Unable to load gas usage data.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Risk Tab ─── */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          {/* Circuit Breaker Tripped Banner */}
          {circuitBreakerTripped && (
            <div className="flex items-start gap-3 p-4 rounded-pf-lg bg-pf-danger/10 border border-pf-danger/30">
              <ShieldAlert className="size-5 text-pf-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-pf-danger">Circuit Breaker Tripped</p>
                <p className="text-xs text-pf-text-secondary mt-0.5">
                  All running strategies were paused due to drawdown exceeding your threshold.
                  {circuitBreakerTrippedAt && (
                    <span> Triggered {new Date(circuitBreakerTrippedAt).toLocaleString()}.</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={resetCircuitBreaker}
                disabled={riskResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-pf bg-pf-danger text-white hover:bg-pf-danger/80 disabled:opacity-50 transition-colors shrink-0"
              >
                {riskResetting ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Reset
              </button>
            </div>
          )}

          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Drawdown Circuit Breaker</h2>
              {riskLoading && <Loader2 className="size-4 animate-spin text-pf-text-muted" />}
            </div>

            <p className="text-xs text-pf-text-secondary -mt-2">
              Automatically pauses all running strategies if your portfolio loses more than the
              configured percentage within the lookback window.
            </p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pf-text font-medium">Enable Circuit Breaker</p>
                <p className="text-xs text-pf-text-muted mt-0.5">Pause all strategies when drawdown threshold is hit</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={drawdownEnabled}
                onClick={() => setDrawdownEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  drawdownEnabled ? 'bg-pf-cyan-500' : 'bg-pf-surface border border-pf-border'
                }`}
              >
                <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  drawdownEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Lookback window */}
            <div>
              <label htmlFor="settings-lookback" className="text-xs text-pf-text-secondary mb-1.5 block">
                Lookback Window
              </label>
              <select
                id="settings-lookback"
                value={drawdownLookbackHours}
                onChange={e => setDrawdownLookbackHours(Number(e.target.value))}
                disabled={!drawdownEnabled}
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
            </div>

            {/* Threshold */}
            <div>
              <label htmlFor="settings-threshold" className="text-xs text-pf-text-secondary mb-1.5 block">
                Loss Threshold: <span className="font-mono text-pf-danger">{drawdownThresholdPct}%</span>
              </label>
              <input
                id="settings-threshold"
                type="range"
                min={1}
                max={50}
                step={1}
                value={drawdownThresholdPct}
                onChange={e => setDrawdownThresholdPct(Number(e.target.value))}
                disabled={!drawdownEnabled}
                className="w-full accent-pf-danger disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-pf-text-muted mt-1">
                <span>1%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-pf-border">
              <button
                type="button"
                onClick={saveRiskSettings}
                disabled={riskSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {riskSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save Risk Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── API Keys Tab ─── */}
      {activeTab === 'apikeys' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6">
          {/* Generate section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Generate API Key</h2>
            <div>
              <label htmlFor="settings-key-name" className="text-xs text-pf-text-secondary mb-1.5 block">Key Name</label>
              <input id="settings-key-name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="My Integration"
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <div>
              <span className="text-xs text-pf-text-secondary mb-1.5 block" id="settings-scopes-label">Scopes</span>
              <div className="flex gap-4 mt-1" role="group" aria-labelledby="settings-scopes-label">
                {(['read', 'write', 'trade'] as const).map(scope => (
                  <label key={scope} className="flex items-center gap-1.5 cursor-pointer text-sm text-pf-text-secondary">
                    <input type="checkbox" checked={newKeyScopes[scope]}
                      onChange={e => setNewKeyScopes(prev => ({ ...prev, [scope]: e.target.checked }))}
                      className="rounded border-pf-border" />
                    {scope.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="settings-key-expiration" className="text-xs text-pf-text-secondary mb-1.5 block">Expiration (optional)</label>
              <input id="settings-key-expiration" type="date" lang="en" value={newKeyExpiration} onChange={e => setNewKeyExpiration(e.target.value)}
                className="w-full max-w-[220px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <button type="button" onClick={createApiKey} disabled={apiKeysCreating || !newKeyName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
              {apiKeysCreating ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              Generate API Key
            </button>
          </div>

          {/* Newly created key */}
          {createdKey?.key && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-warning/10 text-pf-warning text-xs" role="alert">
                <Shield className="size-3.5 shrink-0" />
                Copy this key now -- it won't be shown again!
              </div>
              <div className="flex items-center gap-2 bg-pf-surface rounded-pf p-3 border border-pf-border">
                <code className="flex-1 text-xs font-mono text-pf-text break-all">{createdKey.key}</code>
                <button type="button" onClick={() => copyKey(createdKey.key!)} aria-label="Copy API key" className="p-1.5 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text">
                  <Copy className="size-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => setCreatedKey(null)}
                className="text-xs text-pf-text-muted hover:text-pf-text transition-colors">Got it</button>
            </div>
          )}

          {/* Keys table */}
          <div className="border-t border-pf-border-subtle pt-6">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider mb-4">Your API Keys</h2>
            {apiKeysLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-pf-overlay rounded animate-pulse" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Key className="size-8 text-pf-text-muted mb-2" />
                <p className="text-sm text-pf-text-muted">No API keys yet. Generate one to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="API keys">
                  <thead>
                    <tr className="text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border-subtle">
                      <th scope="col" className="pb-2 font-medium">Name</th>
                      <th scope="col" className="pb-2 font-medium">Key Prefix</th>
                      <th scope="col" className="pb-2 font-medium">Scopes</th>
                      <th scope="col" className="pb-2 font-medium">Created</th>
                      <th scope="col" className="pb-2 font-medium">Last Used</th>
                      <th scope="col" className="pb-2 font-medium hidden sm:table-cell">Expires</th>
                      <th scope="col" className="pb-2 font-medium">Status</th>
                      <th scope="col" className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border-subtle">
                    {apiKeys.map(key => (
                      <tr key={key.id}>
                        <td className="py-2 text-pf-text">{key.name}</td>
                        <td className="py-2 font-mono text-xs text-pf-text-secondary">{key.prefix}...</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            {key.scopes.map(scope => (
                              <span key={scope} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                scope === 'READ' ? 'bg-pf-success/10 text-pf-success' :
                                scope === 'WRITE' ? 'bg-pf-info/10 text-pf-info' :
                                'bg-pf-warning/10 text-pf-warning'
                              }`}>{scope}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 font-mono text-xs text-pf-text-muted">{formatDate(key.createdAt)}</td>
                        <td className="py-2 font-mono text-xs text-pf-text-muted">{key.lastUsedAt ? formatDate(key.lastUsedAt) : '\u2014'}</td>
                        <td className="py-2 font-mono text-xs text-pf-text-muted hidden sm:table-cell">
                          {key.expiresAt ? (
                            <span className={new Date(key.expiresAt) < new Date() ? 'text-pf-danger' : ''}>
                              {formatDate(key.expiresAt)}
                            </span>
                          ) : '\u2014'}
                        </td>
                        <td className="py-2">
                          {key.revoked ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-danger/10 text-pf-danger">Revoked</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-success/10 text-pf-success">Active</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => revokeApiKey(key.id)}
                            disabled={key.revoked}
                            aria-label={`Revoke API key ${key.name}`}
                            className="flex items-center gap-1 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                          >
                            <Ban className="size-3" /> Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
