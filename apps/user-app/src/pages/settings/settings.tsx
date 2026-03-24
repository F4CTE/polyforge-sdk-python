import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  User, Bell, Lock, Shield, Key, Loader2, Check, Copy, Ban, Eye, EyeOff, Fuel, Trash2, AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Tab = 'profile' | 'notifications' | 'password' | '2fa' | 'apikeys' | 'gas';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
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
  qrCodeUri: string;
  backupCodes: string[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const TABS: { label: string; value: Tab; icon: React.ReactNode }[] = [
  { label: 'Profile', value: 'profile', icon: <User className="size-3.5" /> },
  { label: 'Notifications', value: 'notifications', icon: <Bell className="size-3.5" /> },
  { label: 'Password', value: 'password', icon: <Lock className="size-3.5" /> },
  { label: '2FA', value: '2fa', icon: <Shield className="size-3.5" /> },
  { label: 'API Keys', value: 'apikeys', icon: <Key className="size-3.5" /> },
  { label: 'Gas Usage', value: 'gas', icon: <Fuel className="size-3.5" /> },
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
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    orderFilled: true, strategyError: true, backtestComplete: true, priceAlert: false,
    dailyLossLimit: true, marketResolved: false, follow: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

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

  async function loadGasUsage() {
    setGasLoading(true);
    try {
      const res = await fetch('/api/v1/settings/gas', { credentials: 'include' });
      if (res.ok) setGasUsage(await res.json());
    } catch { toast.error('Failed to load gas usage'); }
    setGasLoading(false);
  }

  function handleTab(t: Tab) {
    setActiveTab(t);
    if (t === 'apikeys' && apiKeys.length === 0) loadApiKeys();
    if (t === 'gas' && !gasUsage) loadGasUsage();
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
        patchUser({ totpEnabled: true });
        setTotpSetupData(null);
        setTotpCode('');
        toast.success('Two-factor authentication enabled');
      } else {
        toast.error('Failed to confirm 2FA');
      }
    } catch { toast.error('Failed to confirm 2FA'); }
    setTotpSaving(false);
  }

  async function disableTotp() {
    if (totpSaving || !totpCode) return;
    setTotpSaving(true);
    try {
      const res = await fetch('/auth/v1/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: totpCode }),
      });
      if (res.ok) {
        patchUser({ totpEnabled: false });
        setTotpCode('');
        toast.success('Two-factor authentication disabled');
      } else {
        toast.error('Failed to disable 2FA');
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
        <Link
          to="/settings/trading-account"
          className="text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
        >
          Trading Account &rarr;
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button
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
            <label className="text-xs text-pf-text-secondary mb-1.5 block">Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name"
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary mb-1.5 block">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell others about yourself..."
              className="w-full px-3 py-2.5 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors resize-y" />
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary mb-1.5 block">Avatar URL</label>
            <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..."
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
          </div>
          <div className="flex justify-end">
            <button onClick={saveProfile} disabled={profileSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors">
              {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Profile
            </button>
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
                role="switch"
                aria-checked={notifPrefs[item.key]}
                onClick={() => setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${notifPrefs[item.key] ? 'bg-pf-cyan-500' : 'bg-pf-overlay'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <button onClick={saveNotifications} disabled={notifSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors">
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
            <label className="text-xs text-pf-text-secondary mb-1.5 block">Current Password</label>
            <div className="relative">
              <input type={showCurrentPw ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text">
                {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary mb-1.5 block">New Password</label>
            <div className="relative">
              <input type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text">
                {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary mb-1.5 block">Confirm New Password</label>
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="text-xs text-pf-danger mt-1 block">Passwords do not match</span>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={savePassword} disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors">
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

          {user?.totpEnabled ? (
            <>
              <p className="text-sm text-pf-text-secondary">
                2FA is currently <strong className="text-pf-success">enabled</strong>.
              </p>
              <div>
                <label className="text-xs text-pf-text-secondary mb-1.5 block">Enter your TOTP code to disable</label>
                <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="6-digit code" maxLength={6}
                  className="w-full max-w-[200px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              </div>
              <button onClick={disableTotp} disabled={totpSaving || !totpCode}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 disabled:opacity-50 transition-colors">
                {totpSaving ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                Disable 2FA
              </button>
            </>
          ) : totpSetupData ? (
            <>
              <p className="text-sm text-pf-text-secondary">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
              <div className="flex justify-center py-4">
                <img src={totpSetupData.qrCodeUri} alt="TOTP QR Code" className="w-48 h-48 rounded-pf-lg bg-white p-2" />
              </div>
              <div>
                <label className="text-xs text-pf-text-secondary mb-1.5 block">Verification Code</label>
                <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="6-digit code" maxLength={6}
                  className="w-full max-w-[200px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
              </div>
              {totpSetupData.backupCodes.length > 0 && (
                <div className="bg-pf-surface rounded-pf p-4">
                  <div className="text-xs text-pf-text-secondary mb-2 font-medium">Backup Codes (save these!)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {totpSetupData.backupCodes.map(code => (
                      <span key={code} className="font-mono text-xs text-pf-text bg-pf-overlay px-2 py-1 rounded text-center">{code}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={confirmTotp} disabled={totpSaving || !totpCode}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors">
                {totpSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirm & Enable 2FA
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-pf-text-secondary">
                2FA is currently <strong className="text-pf-text-muted">disabled</strong>. Add an extra layer of security to your account.
              </p>
              <button onClick={startTotpSetup} disabled={totpLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 transition-colors">
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
                <button onClick={loadGasUsage}
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

      {/* ─── Danger Zone ─── */}
      <div className="bg-pf-elevated border border-pf-danger/20 rounded-pf-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-pf-danger uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="size-4" />
          Danger Zone
        </h2>
        <p className="text-sm text-pf-text-secondary">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setDeleteDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 transition-colors"
        >
          <Trash2 className="size-4" />
          Delete Account
        </button>

        {deleteDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 max-w-md w-full mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-pf-danger/10 flex items-center justify-center">
                  <AlertTriangle className="size-5 text-pf-danger" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-pf-text">Delete Account</h3>
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
                <label className="text-xs text-pf-text-secondary mb-1.5 block">Enter your password to confirm</label>
                <input
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
                  onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); }}
                  className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text rounded-pf hover:bg-pf-overlay transition-colors"
                >
                  Cancel
                </button>
                <button
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

      {/* ─── API Keys Tab ─── */}
      {activeTab === 'apikeys' && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6">
          {/* Generate section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Generate API Key</h2>
            <div>
              <label className="text-xs text-pf-text-secondary mb-1.5 block">Key Name</label>
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="My Integration"
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-pf-text-secondary mb-1.5 block">Scopes</label>
              <div className="flex gap-4 mt-1">
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
              <label className="text-xs text-pf-text-secondary mb-1.5 block">Expiration (optional)</label>
              <input type="date" value={newKeyExpiration} onChange={e => setNewKeyExpiration(e.target.value)}
                className="w-full max-w-[220px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <button onClick={createApiKey} disabled={apiKeysCreating || !newKeyName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors">
              {apiKeysCreating ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              Generate API Key
            </button>
          </div>

          {/* Newly created key */}
          {createdKey?.key && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-warning/10 text-pf-warning text-xs">
                <Shield className="size-3.5 shrink-0" />
                Copy this key now -- it won't be shown again!
              </div>
              <div className="flex items-center gap-2 bg-pf-surface rounded-pf p-3 border border-pf-border">
                <code className="flex-1 text-xs font-mono text-pf-text break-all">{createdKey.key}</code>
                <button onClick={() => copyKey(createdKey.key!)} className="p-1.5 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text">
                  <Copy className="size-3.5" />
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border-subtle">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Key Prefix</th>
                      <th className="pb-2 font-medium">Scopes</th>
                      <th className="pb-2 font-medium">Created</th>
                      <th className="pb-2 font-medium">Last Used</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Actions</th>
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
                                scope === 'WRITE' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-pf-warning/10 text-pf-warning'
                              }`}>{scope}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 font-mono text-xs text-pf-text-muted">{formatDate(key.createdAt)}</td>
                        <td className="py-2 font-mono text-xs text-pf-text-muted">{key.lastUsedAt ? formatDate(key.lastUsedAt) : '\u2014'}</td>
                        <td className="py-2">
                          {key.revoked ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-danger/10 text-pf-danger">Revoked</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-success/10 text-pf-success">Active</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => revokeApiKey(key.id)}
                            disabled={key.revoked}
                            className="flex items-center gap-1 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-30 transition-colors"
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
