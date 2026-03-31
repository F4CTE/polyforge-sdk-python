import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  User, Bell, Lock, Shield, Key, Loader2, Check, Copy, Ban, Eye, EyeOff, Fuel, Trash2, AlertTriangle, ShieldAlert,
  Webhook, Send, Plus, ShieldCheck, ShieldOff, Download, KeyRound, RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Tab = 'profile' | 'notifications' | 'password' | '2fa' | 'apikeys' | 'gas' | 'risk' | 'webhooks';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;       // legacy field kept for compatibility
  keyPrefix: string;    // e.g. "pfk_live_abc123..."
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt?: string | null;
  usageCount: number;
  active: boolean;
  revoked: boolean;
  key?: string;
  token?: string;
  secret?: string;
}

const SCOPES = [
  { value: 'READ',     label: 'Read',     desc: 'View portfolio, orders, strategies' },
  { value: 'TRADE',    label: 'Trade',    desc: 'Place and cancel orders' },
  { value: 'STRATEGY', label: 'Strategy', desc: 'Create and manage strategies' },
  { value: 'WEBHOOK',  label: 'Webhook',  desc: 'Manage webhooks' },
] as const;

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  failureCount: number;
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
  { label: 'Webhooks', value: 'webhooks', icon: <Webhook className="size-3.5" /> },
];

interface NotificationPreference {
  event: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

type EmailDigest = 'INSTANT' | 'DAILY' | 'WEEKLY' | 'NONE';

const NOTIFICATION_EVENTS = [
  { event: 'ORDER_FILLED', label: 'Order Filled', desc: 'When your order is matched and filled', category: 'Trading' },
  { event: 'ORDER_REJECTED', label: 'Order Rejected', desc: 'When an order fails or is rejected', category: 'Trading' },
  { event: 'POSITION_CLOSED', label: 'Position Closed', desc: 'When a market resolves and your position closes', category: 'Trading' },
  { event: 'STRATEGY_ERROR', label: 'Strategy Error', desc: 'When a strategy encounters an error', category: 'Strategies' },
  { event: 'STRATEGY_PAUSED', label: 'Strategy Paused', desc: 'When a strategy is automatically paused', category: 'Strategies' },
  { event: 'BACKTEST_COMPLETE', label: 'Backtest Complete', desc: 'When a backtest finishes running', category: 'Strategies' },
  { event: 'PRICE_ALERT', label: 'Price Alert', desc: 'When a market hits your set price target', category: 'Alerts' },
  { event: 'WHALE_TRADE', label: 'Whale Trade', desc: 'Large trades detected in watched markets', category: 'Alerts' },
  { event: 'MARKET_RESOLVED', label: 'Market Resolved', desc: 'When a market you traded resolves', category: 'Markets' },
  { event: 'NEWS_SIGNAL', label: 'News Signal', desc: 'News articles matching your markets', category: 'Markets' },
  { event: 'COPY_TRADE', label: 'Copy Trade Executed', desc: 'When a copy trade is placed on your behalf', category: 'Copy Trading' },
  { event: 'DAILY_LOSS_LIMIT', label: 'Daily Loss Limit Hit', desc: 'When your daily loss limit is reached', category: 'Risk' },
  { event: 'FOLLOWER_NEW', label: 'New Follower', desc: 'When someone follows your profile', category: 'Social' },
  { event: 'REVIEW_RECEIVED', label: 'Strategy Review', desc: 'When someone reviews your marketplace strategy', category: 'Social' },
] as const;

const EMAIL_DIGEST_OPTIONS: { value: EmailDigest; label: string }[] = [
  { value: 'INSTANT', label: 'Instant' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'NONE', label: 'None' },
];

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

  // Sync 2FA view with user.totpEnabled when in a stable state (disabled or enabled)
  useEffect(() => {
    setTwoFaView(prev => {
      if (prev === 'setup' || prev === 'backup') return prev;
      return user?.totpEnabled ? 'enabled' : 'disabled';
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.totpEnabled]);

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
  // New 2FA state machine
  type TwoFaView = 'disabled' | 'setup' | 'backup' | 'enabled';
  const [twoFaView, setTwoFaView] = useState<TwoFaView>(
    () => (user?.totpEnabled ? 'enabled' : 'disabled')
  );
  const [twoFaSetupSecret, setTwoFaSetupSecret] = useState('');
  const [twoFaQrCodeUrl, setTwoFaQrCodeUrl] = useState('');
  const [twoFaVerifyToken, setTwoFaVerifyToken] = useState('');
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaVerifying, setTwoFaVerifying] = useState(false);
  const [twoFaSetupLoading, setTwoFaSetupLoading] = useState(false);
  const [twoFaDisableToken, setTwoFaDisableToken] = useState('');
  const [twoFaDisabling, setTwoFaDisabling] = useState(false);
  const [twoFaShowDisableForm, setTwoFaShowDisableForm] = useState(false);
  const [twoFaRegenCodes, setTwoFaRegenCodes] = useState<string[]>([]);
  const [twoFaRegenLoading, setTwoFaRegenLoading] = useState(false);
  const [twoFaCopied, setTwoFaCopied] = useState(false);

  // Notifications — granular per-event preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference[]>([]);
  const [emailDigest, setEmailDigest] = useState<EmailDigest>('DAILY');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<Set<string>>(new Set(['READ']));
  const [newKeyExpiration, setNewKeyExpiration] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [apiKeysCreating, setApiKeysCreating] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // Gas Usage
  const [gasUsage, setGasUsage] = useState<GasUsageData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);

  // Webhooks
  const WEBHOOK_EVENTS = [
    'ORDER_FILLED', 'STRATEGY_ERROR', 'WHALE_TRADE', 'NEWS_SIGNAL',
    'BACKTEST_COMPLETE', 'DAILY_LOSS_LIMIT', 'MARKET_RESOLVED', 'PRICE_ALERT',
  ] as const;
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookAdding, setWebhookAdding] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState<string | null>(null);

  // Risk / Circuit Breaker
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskResetting, setRiskResetting] = useState(false);
  const [drawdownEnabled, setDrawdownEnabled] = useState(false);
  const [drawdownLookbackHours, setDrawdownLookbackHours] = useState(24);
  const [drawdownThresholdPct, setDrawdownThresholdPct] = useState(10);
  const [circuitBreakerTripped, setCircuitBreakerTripped] = useState(false);
  const [circuitBreakerTrippedAt, setCircuitBreakerTrippedAt] = useState<string | null>(null);

  // Daily Loss Limit (user risk settings)
  const [dlEnabled, setDlEnabled] = useState(false);
  const [dlLimit, setDlLimit] = useState<string>('');
  const [dlMaxPositionSize, setDlMaxPositionSize] = useState<string>('');
  const [dlMaxOpenPositions, setDlMaxOpenPositions] = useState<string>('');
  const [dlLoading, setDlLoading] = useState(false);
  const [dlSaving, setDlSaving] = useState(false);

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

  async function loadDailyLossSettings() {
    setDlLoading(true);
    try {
      const res = await fetch('/api/v1/users/me/risk-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDlEnabled(data.enabled ?? false);
        setDlLimit(data.dailyLossLimit != null ? String(data.dailyLossLimit) : '');
        setDlMaxPositionSize(data.maxPositionSize != null ? String(data.maxPositionSize) : '');
        setDlMaxOpenPositions(data.maxOpenPositions != null ? String(data.maxOpenPositions) : '');
      }
    } catch { toast.error('Failed to load daily loss settings'); }
    setDlLoading(false);
  }

  async function saveDailyLossSettings() {
    if (dlSaving) return;
    setDlSaving(true);
    try {
      const res = await fetch('/api/v1/users/me/risk-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: dlEnabled,
          dailyLossLimit: dlLimit !== '' ? parseFloat(dlLimit) : null,
          maxPositionSize: dlMaxPositionSize !== '' ? parseFloat(dlMaxPositionSize) : null,
          maxOpenPositions: dlMaxOpenPositions !== '' ? parseInt(dlMaxOpenPositions, 10) : null,
        }),
      });
      if (res.ok) {
        toast.success('Risk settings saved');
      } else {
        toast.error('Failed to save risk settings');
      }
    } catch { toast.error('Failed to save risk settings'); }
    setDlSaving(false);
  }

  async function loadWebhooks() {
    setWebhooksLoading(true);
    try {
      const res = await fetch('/api/v1/webhooks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.data ?? data);
      }
    } catch { toast.error('Failed to load webhooks'); }
    setWebhooksLoading(false);
  }

  async function addWebhook() {
    if (webhookAdding) return;
    if (!webhookUrl.startsWith('https://')) {
      toast.error('URL must start with https://');
      return;
    }
    if (webhookEvents.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    setWebhookAdding(true);
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: webhookUrl, events: webhookEvents }),
      });
      if (res.ok) {
        const created = await res.json();
        setWebhooks(prev => [created, ...prev]);
        setWebhookUrl('');
        setWebhookEvents([]);
        toast.success('Webhook added');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to add webhook');
      }
    } catch { toast.error('Failed to add webhook'); }
    setWebhookAdding(false);
  }

  async function deleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== id));
        toast.success('Webhook deleted');
      } else {
        toast.error('Failed to delete webhook');
      }
    } catch { toast.error('Failed to delete webhook'); }
  }

  async function testWebhook(id: string) {
    if (webhookTesting === id) return;
    setWebhookTesting(id);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        toast.success('Test payload sent');
      } else {
        toast.error('Test delivery failed');
      }
    } catch { toast.error('Test delivery failed'); }
    setWebhookTesting(null);
  }

  function handleTab(t: Tab) {
    setActiveTab(t);
    if (t === 'notifications') loadNotifPrefs();
    if (t === 'apikeys' && apiKeys.length === 0) loadApiKeys();
    if (t === 'gas' && !gasUsage) loadGasUsage();
    if (t === 'risk') { loadRiskSettings(); loadDailyLossSettings(); }
    if (t === 'webhooks') loadWebhooks();
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
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? 'Failed to change password');
      }
    } catch { toast.error('Failed to change password'); }
    setPwSaving(false);
  }

  // ── TOTP (legacy — kept for reference, superseded by new 2FA flow below) ──
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

  // ── New 2FA TOTP flow ──
  async function twoFaStartSetup() {
    setTwoFaSetupLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/setup', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTwoFaSetupSecret(data.secret ?? '');
        setTwoFaQrCodeUrl(data.qrCodeUrl ?? '');
        setTwoFaBackupCodes(data.backupCodes ?? []);
        setTwoFaVerifyToken('');
        setTwoFaView('setup');
      } else {
        toast.error('Failed to start 2FA setup');
      }
    } catch { toast.error('Failed to start 2FA setup'); }
    setTwoFaSetupLoading(false);
  }

  async function twoFaEnable() {
    if (twoFaVerifying || twoFaVerifyToken.length !== 6) return;
    setTwoFaVerifying(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: twoFaVerifyToken }),
      });
      if (res.ok) {
        const data = await res.json();
        patchUser({ totpEnabled: true });
        setTwoFaBackupCodes(data.backupCodes ?? twoFaBackupCodes);
        setTwoFaVerifyToken('');
        setTwoFaView('backup');
      } else {
        toast.error('Invalid code, try again');
      }
    } catch { toast.error('Failed to enable 2FA'); }
    setTwoFaVerifying(false);
  }

  async function twoFaDisable() {
    if (twoFaDisabling || twoFaDisableToken.length !== 6) return;
    setTwoFaDisabling(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: twoFaDisableToken }),
      });
      if (res.ok) {
        patchUser({ totpEnabled: false });
        setTwoFaDisableToken('');
        setTwoFaShowDisableForm(false);
        setTwoFaRegenCodes([]);
        setTwoFaView('disabled');
        toast.success('Two-factor authentication has been disabled');
      } else {
        toast.error('Invalid code, try again');
      }
    } catch { toast.error('Failed to disable 2FA'); }
    setTwoFaDisabling(false);
  }

  async function twoFaRegenBackupCodes() {
    setTwoFaRegenLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/backup-codes', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTwoFaRegenCodes(data.backupCodes ?? []);
        toast.success('New backup codes generated');
      } else {
        toast.error('Failed to regenerate backup codes');
      }
    } catch { toast.error('Failed to regenerate backup codes'); }
    setTwoFaRegenLoading(false);
  }

  function twoFaDownloadCodes(codes: string[], filename = 'polyforge-backup-codes.txt') {
    const text = codes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function twoFaCopyAll(codes: string[]) {
    navigator.clipboard.writeText(codes.join('\n'))
      .then(() => { setTwoFaCopied(true); setTimeout(() => setTwoFaCopied(false), 2000); })
      .catch(() => toast.error('Copy failed'));
  }

  // ── Notifications ──
  function buildDefaultPrefs(): NotificationPreference[] {
    return NOTIFICATION_EVENTS.map(e => ({ event: e.event, inApp: true, email: false, push: false }));
  }

  async function loadNotifPrefs() {
    setNotifLoading(true);
    try {
      const res = await fetch('/api/v1/users/me/notification-preferences', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const apiPrefs: NotificationPreference[] = data.preferences ?? [];
        const merged = NOTIFICATION_EVENTS.map(e => {
          const found = apiPrefs.find(p => p.event === e.event);
          return found ?? { event: e.event, inApp: true, email: false, push: false };
        });
        setNotifPrefs(merged);
        setEmailDigest(data.emailDigest ?? 'DAILY');
      } else {
        setNotifPrefs(buildDefaultPrefs());
      }
    } catch {
      setNotifPrefs(buildDefaultPrefs());
    }
    setNotifLoading(false);
  }

  function toggleNotifField(event: string, field: 'inApp' | 'email' | 'push') {
    setNotifPrefs(prev => prev.map(p => p.event === event ? { ...p, [field]: !p[field] } : p));
  }

  async function saveNotifications() {
    if (notifSaving) return;
    setNotifSaving(true);
    try {
      const res = await fetch('/api/v1/users/me/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: notifPrefs, emailDigest }),
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
    if (apiKeysCreating || !newKeyName.trim() || newKeyScopes.size === 0) return;
    setApiKeysCreating(true);
    const scopes = Array.from(newKeyScopes);
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
        setRotatedSecret(null);
        setSecretCopied(false);
        setApiKeys(prev => [created, ...prev]);
        setNewKeyName('');
        setNewKeyScopes(new Set(['READ']));
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
        setApiKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: true, active: false } : k));
        toast.success('API key revoked');
      }
    } catch { toast.error('Failed to revoke API key'); }
  }

  async function rotateApiKey(id: string) {
    if (!window.confirm('Rotate this API key? The current secret will be invalidated.')) return;
    setRotatingKeyId(id);
    try {
      const res = await fetch(`/api/v1/api-keys/${id}/rotate`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRotatedSecret({ id, secret: data.secret });
        setCreatedKey(null);
        setSecretCopied(false);
        toast.warning("Save the new secret — it won't be shown again");
      } else {
        toast.error('Failed to rotate API key');
      }
    } catch { toast.error('Failed to rotate API key'); }
    setRotatingKeyId(null);
  }

  function copyKeyPrefix(id: string, prefix: string) {
    navigator.clipboard.writeText(prefix)
      .then(() => {
        setCopiedKeyId(id);
        setTimeout(() => setCopiedKeyId(null), 2000);
      })
      .catch(() => toast.error('Copy failed'));
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret)
      .then(() => setSecretCopied(true))
      .catch(() => toast.error('Copy failed'));
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => toast.success('Copied!')).catch(() => toast.error('Copy failed'));
  }

  function daysAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never used';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
  }

  function scopeBadgeClass(scope: string): string {
    if (scope === 'READ') return 'bg-pf-info/10 text-pf-info';
    if (scope === 'TRADE') return 'bg-pf-warning/10 text-pf-warning';
    if (scope === 'STRATEGY') return 'bg-pf-success/10 text-pf-success';
    if (scope === 'WEBHOOK') return 'bg-pf-cyan-500/10 text-pf-cyan-400';
    return 'bg-pf-overlay text-pf-text-secondary';
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6">
          <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Notification Preferences</h2>

          {/* Email Digest Frequency */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-pf-text-secondary uppercase tracking-wider">Email Digest Frequency</div>
            <p className="text-xs text-pf-text-muted">How often to receive email summaries of your activity</p>
            <div className="flex gap-2 flex-wrap mt-2">
              {EMAIL_DIGEST_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEmailDigest(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    emailDigest === opt.value
                      ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                      : 'bg-pf-surface text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-pf-border" />

          {/* Per-event preferences */}
          {notifLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 animate-pulse">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-pf-overlay" />
                    <div className="h-3 w-52 rounded bg-pf-overlay/60" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-14 rounded-full bg-pf-overlay" />
                    <div className="h-6 w-14 rounded-full bg-pf-overlay" />
                    <div className="h-6 w-14 rounded-full bg-pf-overlay" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Column headers */}
              <div className="flex items-center justify-between pb-1">
                <div />
                <div className="flex gap-2 text-[10px] font-medium text-pf-text-muted uppercase tracking-wider">
                  <span className="w-14 text-center">In-App</span>
                  <span className="w-14 text-center">Email</span>
                  <span className="w-14 text-center">Push</span>
                </div>
              </div>
              {(['Trading', 'Strategies', 'Alerts', 'Markets', 'Copy Trading', 'Risk', 'Social'] as const).map(category => {
                const events = NOTIFICATION_EVENTS.filter(e => e.category === category);
                if (events.length === 0) return null;
                return (
                  <div key={category} className="space-y-1">
                    <div className="text-[10px] font-semibold text-pf-text-muted uppercase tracking-widest pb-1 border-b border-pf-border-subtle">
                      {category}
                    </div>
                    {events.map(evtDef => {
                      const pref = notifPrefs.find(p => p.event === evtDef.event) ?? { event: evtDef.event, inApp: true, email: false, push: false };
                      return (
                        <div key={evtDef.event} className="flex items-center justify-between py-2.5">
                          <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-pf-text">{evtDef.label}</div>
                            <div className="text-xs text-pf-text-muted mt-0.5">{evtDef.desc}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {(['inApp', 'email', 'push'] as const).map(field => (
                              <button
                                key={field}
                                type="button"
                                role="switch"
                                aria-checked={pref[field]}
                                aria-label={`${evtDef.label} ${field} notification`}
                                onClick={() => toggleNotifField(evtDef.event, field)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium w-14 transition-colors ${
                                  pref[field]
                                    ? 'bg-pf-cyan-500 text-white'
                                    : 'bg-pf-overlay text-pf-text-muted'
                                }`}
                              >
                                {pref[field] ? 'On' : 'Off'}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-pf-border">
            <button type="button" onClick={saveNotifications} disabled={notifSaving || notifLoading}
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

          {/* View A: 2FA Disabled */}
          {twoFaView === 'disabled' && (
            <div className="space-y-5">
              <div className="flex items-start gap-4 p-4 rounded-pf bg-pf-surface border border-pf-border">
                <Shield className="size-8 text-pf-text-muted shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-pf-text">Protect your account with an authenticator app</p>
                  <p className="text-xs text-pf-text-secondary">
                    Two-factor authentication adds a second layer of security. Each time you sign in,
                    you'll need your password plus a 6-digit code from your authenticator app (e.g. Google
                    Authenticator, Authy, 1Password).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={twoFaStartSetup}
                disabled={twoFaSetupLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {twoFaSetupLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {twoFaSetupLoading ? 'Generating...' : 'Enable Two-Factor Authentication'}
              </button>
            </div>
          )}

          {/* View B: Setup Flow */}
          {twoFaView === 'setup' && (
            <div className="space-y-6">
              {/* Step 1: QR Code */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pf-cyan-500 text-black text-xs font-bold">1</span>
                  <h3 className="text-sm font-semibold text-pf-text">Scan QR Code</h3>
                </div>
                <p className="text-xs text-pf-text-secondary ml-7">
                  Open your authenticator app and scan the QR code below, or enter the secret key manually.
                </p>
                <div className="ml-7 space-y-3">
                  {twoFaQrCodeUrl.startsWith('data:') ? (
                    <div className="inline-block bg-white p-3 rounded-pf-lg border border-pf-border">
                      <img src={twoFaQrCodeUrl} alt="TOTP QR Code" className="w-44 h-44" />
                    </div>
                  ) : (
                    <div className="p-4 bg-pf-surface border border-pf-border rounded-pf text-xs text-pf-text-secondary">
                      <p className="mb-1">Open your authenticator app and add account manually using:</p>
                      <p className="font-mono text-pf-text break-all">{twoFaQrCodeUrl}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-pf-text-secondary mb-1">Or enter this secret manually:</p>
                    <code className="block font-mono text-sm text-pf-text bg-pf-surface border border-pf-border rounded-pf px-3 py-2 tracking-widest break-all">
                      {twoFaSetupSecret}
                    </code>
                  </div>
                </div>
              </div>

              {/* Step 2: Verify */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pf-cyan-500 text-black text-xs font-bold">2</span>
                  <h3 className="text-sm font-semibold text-pf-text">Enter verification code</h3>
                </div>
                <div className="ml-7 space-y-3">
                  <input
                    id="2fa-verify-token"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={twoFaVerifyToken}
                    onChange={e => setTwoFaVerifyToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-40 h-12 text-2xl font-mono tracking-widest text-center rounded-pf bg-pf-surface border border-pf-border text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={twoFaEnable}
                      disabled={twoFaVerifying || twoFaVerifyToken.length !== 6}
                      className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {twoFaVerifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                      Verify & Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTwoFaView('disabled'); setTwoFaVerifyToken(''); setTwoFaSetupSecret(''); setTwoFaQrCodeUrl(''); }}
                      className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors underline underline-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View C: Backup Codes (shown once after enable) */}
          {twoFaView === 'backup' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-pf bg-pf-success/10 border border-pf-success/30">
                <ShieldCheck className="size-5 text-pf-success shrink-0" />
                <p className="text-sm font-medium text-pf-success">2FA enabled successfully!</p>
              </div>
              <div className="p-4 bg-pf-warning/5 border border-pf-warning/30 rounded-pf space-y-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="size-4 text-pf-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-pf-warning font-medium">
                    Save these backup codes somewhere safe. Each can only be used once. If you lose access to
                    your authenticator, you can use a backup code to sign in.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {twoFaBackupCodes.map(code => (
                    <span key={code} className="font-mono text-sm bg-pf-surface px-3 py-2 rounded border border-pf-border text-center text-pf-text">
                      {code}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => twoFaDownloadCodes(twoFaBackupCodes)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-border-strong transition-colors"
                  >
                    <Download className="size-3.5" />
                    Download Backup Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => twoFaCopyAll(twoFaBackupCodes)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-border-strong transition-colors"
                  >
                    {twoFaCopied ? <Check className="size-3.5 text-pf-success" /> : <Copy className="size-3.5" />}
                    {twoFaCopied ? 'Copied!' : 'Copy All'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTwoFaView('enabled')}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors"
              >
                <Check className="size-4" />
                Done
              </button>
            </div>
          )}

          {/* View D: 2FA Enabled */}
          {twoFaView === 'enabled' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-pf bg-pf-success/10 border border-pf-success/30">
                <ShieldCheck className="size-5 text-pf-success shrink-0" />
                <p className="text-sm font-medium text-pf-success">Two-factor authentication is active</p>
              </div>

              {/* Regenerate backup codes */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-pf-text">Backup Codes</p>
                  <p className="text-xs text-pf-text-secondary mt-0.5">
                    Generate a new set of backup codes. Your old codes will be invalidated immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={twoFaRegenBackupCodes}
                  disabled={twoFaRegenLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {twoFaRegenLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Regenerate Backup Codes
                </button>

                {twoFaRegenCodes.length > 0 && (
                  <div className="p-4 bg-pf-warning/5 border border-pf-warning/30 rounded-pf space-y-3">
                    <p className="text-xs text-pf-warning font-medium flex items-center gap-1.5">
                      <KeyRound className="size-3.5" />
                      New backup codes — save these now, they won't be shown again
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {twoFaRegenCodes.map(code => (
                        <span key={code} className="font-mono text-sm bg-pf-surface px-3 py-2 rounded border border-pf-border text-center text-pf-text">
                          {code}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => twoFaDownloadCodes(twoFaRegenCodes)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-border-strong transition-colors"
                      >
                        <Download className="size-3.5" />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => twoFaCopyAll(twoFaRegenCodes)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-border-strong transition-colors"
                      >
                        {twoFaCopied ? <Check className="size-3.5 text-pf-success" /> : <Copy className="size-3.5" />}
                        {twoFaCopied ? 'Copied!' : 'Copy All'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Disable 2FA */}
              <div className="pt-4 border-t border-pf-border space-y-3">
                {!twoFaShowDisableForm ? (
                  <button
                    type="button"
                    onClick={() => setTwoFaShowDisableForm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/30 text-sm font-medium hover:bg-pf-danger/20 transition-colors"
                  >
                    <ShieldOff className="size-4" />
                    Disable 2FA
                  </button>
                ) : (
                  <div className="space-y-3 p-4 bg-pf-surface border border-pf-danger/20 rounded-pf">
                    <p className="text-sm font-medium text-pf-text">Enter your current authenticator code to disable 2FA</p>
                    <input
                      id="2fa-disable-token"
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={twoFaDisableToken}
                      onChange={e => setTwoFaDisableToken(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-40 h-12 text-2xl font-mono tracking-widest text-center rounded-pf bg-pf-elevated border border-pf-border text-pf-text focus:outline-none focus:border-pf-danger/50 transition-colors"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={twoFaDisable}
                        disabled={twoFaDisabling || twoFaDisableToken.length !== 6}
                        className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger text-white text-sm font-medium hover:bg-pf-danger/80 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                      >
                        {twoFaDisabling ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
                        Confirm Disable
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTwoFaShowDisableForm(false); setTwoFaDisableToken(''); }}
                        className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
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

          {/* Daily Loss Limit card */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Daily Loss Limit</h2>
              {dlLoading && <Loader2 className="size-4 animate-spin text-pf-text-muted" />}
            </div>

            <p className="text-xs text-pf-text-secondary -mt-2">
              Set a hard cap on how much you can lose in a single trading day. When hit, all new trades are paused automatically.
            </p>

            {/* Enable risk controls toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pf-text font-medium">Enable Risk Controls</p>
                <p className="text-xs text-pf-text-muted mt-0.5">When off, all limits below are ignored</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dlEnabled}
                onClick={() => setDlEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dlEnabled ? 'bg-pf-cyan-500' : 'bg-pf-surface border border-pf-border'
                }`}
              >
                <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  dlEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Daily Loss Limit input */}
            <div>
              <label htmlFor="settings-dl-limit" className="text-xs text-pf-text-secondary mb-1.5 block">
                Daily Loss Limit (USDC)
              </label>
              <input
                id="settings-dl-limit"
                type="number"
                min={0}
                step={0.01}
                placeholder="100.00"
                value={dlLimit}
                onChange={e => setDlLimit(e.target.value)}
                disabled={!dlEnabled}
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-pf-text-muted mt-1.5">
                Trading is paused automatically if your daily P&amp;L drops below this threshold.
              </p>
            </div>

            {/* Max Position Size input */}
            <div>
              <label htmlFor="settings-dl-position" className="text-xs text-pf-text-secondary mb-1.5 block">
                Max Position Size (USDC)
              </label>
              <input
                id="settings-dl-position"
                type="number"
                min={0}
                step={0.01}
                placeholder="500.00"
                value={dlMaxPositionSize}
                onChange={e => setDlMaxPositionSize(e.target.value)}
                disabled={!dlEnabled}
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-pf-text-muted mt-1.5">Maximum size for any single position.</p>
            </div>

            {/* Max Open Positions input */}
            <div>
              <label htmlFor="settings-dl-open" className="text-xs text-pf-text-secondary mb-1.5 block">
                Max Open Positions
              </label>
              <input
                id="settings-dl-open"
                type="number"
                min={1}
                max={50}
                step={1}
                placeholder="10"
                value={dlMaxOpenPositions}
                onChange={e => setDlMaxOpenPositions(e.target.value)}
                disabled={!dlEnabled}
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-pf-text-muted mt-1.5">Maximum number of concurrent open positions (1–50).</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-pf-border">
              <button
                type="button"
                onClick={saveDailyLossSettings}
                disabled={dlSaving || dlLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {dlSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
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
              <span className="text-xs text-pf-text-secondary mb-2 block" id="settings-scopes-label">
                Scopes <span className="text-pf-danger">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-labelledby="settings-scopes-label">
                {SCOPES.map(scope => {
                  const checked = newKeyScopes.has(scope.value);
                  return (
                    <label key={scope.value} className={`flex items-start gap-2.5 p-2.5 rounded-pf border cursor-pointer transition-colors ${
                      checked ? 'border-pf-cyan-500/50 bg-pf-cyan-500/5' : 'border-pf-border bg-pf-surface hover:border-pf-border-muted'
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setNewKeyScopes(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(scope.value); else next.delete(scope.value);
                          return next;
                        })}
                        className="mt-0.5 rounded border-pf-border shrink-0"
                      />
                      <div>
                        <span className={`text-xs font-medium block ${scopeBadgeClass(scope.value).split(' ')[1]}`}>{scope.label}</span>
                        <span className="text-[11px] text-pf-text-muted">{scope.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              {newKeyScopes.size === 0 && (
                <p className="text-[11px] text-pf-danger mt-1">Select at least one scope.</p>
              )}
            </div>
            <div>
              <label htmlFor="settings-key-expiration" className="text-xs text-pf-text-secondary mb-1.5 block">Expiration (optional)</label>
              <input id="settings-key-expiration" type="date" lang="en" value={newKeyExpiration} onChange={e => setNewKeyExpiration(e.target.value)}
                className="w-full max-w-[220px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <button type="button" onClick={createApiKey} disabled={apiKeysCreating || !newKeyName.trim() || newKeyScopes.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors">
              {apiKeysCreating ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              Generate API Key
            </button>
          </div>

          {/* One-time secret display — key creation */}
          {(createdKey?.secret || createdKey?.key || createdKey?.token) && (
            <div className="space-y-2">
              <div className="bg-pf-warning/10 border border-pf-warning/30 rounded-pf p-3 space-y-2">
                <p className="text-xs text-pf-warning font-medium flex items-center gap-1.5">
                  <Shield className="size-3.5 shrink-0" />
                  Copy this secret now — it won&apos;t be shown again
                </p>
                <code className="block font-mono text-sm text-pf-warning break-all">
                  {createdKey.secret ?? createdKey.token ?? createdKey.key}
                </code>
                <div className="flex items-center gap-2 pt-1">
                  <button type="button"
                    onClick={() => copyKey((createdKey.secret ?? createdKey.token ?? createdKey.key)!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-warning/20 text-pf-warning text-xs font-medium hover:bg-pf-warning/30 transition-colors">
                    <Copy className="size-3" /> Copy Secret
                  </button>
                  <button type="button" onClick={() => setCreatedKey(null)}
                    className="px-3 py-1.5 rounded-pf text-xs text-pf-text-muted border border-pf-border hover:text-pf-text transition-colors">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* One-time secret display — key rotation */}
          {rotatedSecret && (
            <div className="space-y-2">
              <div className="bg-pf-warning/10 border border-pf-warning/30 rounded-pf p-3 space-y-2">
                <p className="text-xs text-pf-warning font-medium flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 shrink-0" />
                  New secret — copy it now, it won&apos;t be shown again
                </p>
                <code className="block font-mono text-sm text-pf-warning break-all">{rotatedSecret.secret}</code>
                <div className="flex items-center gap-2 pt-1">
                  <button type="button"
                    onClick={() => copySecret(rotatedSecret.secret)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-warning/20 text-pf-warning text-xs font-medium hover:bg-pf-warning/30 transition-colors">
                    {secretCopied ? <><Check className="size-3" /> Copied!</> : <><Copy className="size-3" /> Copy Secret</>}
                  </button>
                  <button type="button" onClick={() => { setRotatedSecret(null); setSecretCopied(false); }}
                    className="px-3 py-1.5 rounded-pf text-xs text-pf-text-muted border border-pf-border hover:text-pf-text transition-colors">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keys table */}
          <div className="border-t border-pf-border-subtle pt-6">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider mb-4">Your API Keys</h2>
            {apiKeysLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-pf-overlay rounded animate-pulse" />
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
                      <th scope="col" className="pb-2 pr-4 font-medium">Name</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Key Prefix</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Scopes</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Created</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Last Used</th>
                      <th scope="col" className="pb-2 pr-4 font-medium hidden sm:table-cell">Expires</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Status</th>
                      <th scope="col" className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border-subtle">
                    {apiKeys.map(key => {
                      const displayPrefix = key.keyPrefix ?? (key.prefix ? `${key.prefix}...` : '—');
                      return (
                        <tr key={key.id} className="align-top">
                          <td className="py-3 pr-4 text-pf-text font-medium">{key.name}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs text-pf-text-secondary">{displayPrefix}</code>
                              <button
                                type="button"
                                onClick={() => copyKeyPrefix(key.id, displayPrefix)}
                                aria-label={`Copy key prefix for ${key.name}`}
                                className="p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text shrink-0"
                              >
                                {copiedKeyId === key.id
                                  ? <Check className="size-3 text-pf-success" />
                                  : <Copy className="size-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map(scope => (
                                <span key={scope} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${scopeBadgeClass(scope)}`}>
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-pf-text-muted whitespace-nowrap">{formatDate(key.createdAt)}</td>
                          <td className="py-3 pr-4 text-xs text-pf-text-muted whitespace-nowrap">
                            <div>{daysAgo(key.lastUsedAt)}</div>
                            {typeof key.usageCount === 'number' && (
                              <div className="text-[10px] text-pf-text-muted">{key.usageCount.toLocaleString()} requests</div>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-pf-text-muted hidden sm:table-cell whitespace-nowrap">
                            {key.expiresAt ? (
                              <span className={new Date(key.expiresAt) < new Date() ? 'text-pf-danger' : ''}>
                                {formatDate(key.expiresAt)}
                              </span>
                            ) : '\u2014'}
                          </td>
                          <td className="py-3 pr-4">
                            {key.revoked || key.active === false ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-danger/10 text-pf-danger">Revoked</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-success/10 text-pf-success">Active</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => rotateApiKey(key.id)}
                                disabled={key.revoked || key.active === false || rotatingKeyId === key.id}
                                aria-label={`Rotate API key ${key.name}`}
                                title="Rotate key"
                                className="p-1.5 rounded hover:bg-pf-overlay text-pf-text-muted hover:text-pf-text disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              >
                                {rotatingKeyId === key.id
                                  ? <Loader2 className="size-3.5 animate-spin" />
                                  : <RotateCcw className="size-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => revokeApiKey(key.id)}
                                disabled={key.revoked || key.active === false}
                                aria-label={`Revoke API key ${key.name}`}
                                title="Revoke key"
                                className="p-1.5 rounded hover:bg-pf-danger/10 text-pf-text-muted hover:text-pf-danger disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ─── Webhooks Tab ─── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {/* Add Webhook Form */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Add Webhook</h2>
            <div>
              <label htmlFor="webhook-url" className="text-xs text-pf-text-secondary mb-1.5 block">HTTPS URL</label>
              <input
                id="webhook-url"
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
              />
              {webhookUrl && !webhookUrl.startsWith('https://') && (
                <span className="text-xs text-pf-danger mt-1 block">URL must start with https://</span>
              )}
            </div>
            <div>
              <div className="text-xs text-pf-text-secondary mb-2">Events (select at least 1)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEBHOOK_EVENTS.map(event => {
                  const checked = webhookEvents.includes(event);
                  return (
                    <button
                      key={event}
                      type="button"
                      onClick={() => setWebhookEvents(prev =>
                        checked ? prev.filter(e => e !== event) : [...prev, event]
                      )}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-pf text-xs font-medium border transition-colors text-left ${
                        checked
                          ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                          : 'bg-pf-surface text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
                      }`}
                    >
                      <span className={`size-3 rounded-sm border flex items-center justify-center shrink-0 ${checked ? 'bg-pf-cyan-500 border-pf-cyan-500' : 'border-pf-border'}`}>
                        {checked && <Check className="size-2 text-black" />}
                      </span>
                      {event.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addWebhook}
                disabled={webhookAdding || !webhookUrl || webhookEvents.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {webhookAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add Webhook
              </button>
            </div>
          </div>

          {/* Webhooks List */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-3">
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Your Webhooks</h2>

            {webhooksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-pf bg-pf-surface animate-pulse" />
                ))}
              </div>
            ) : webhooks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Webhook className="size-8 text-pf-text-muted" />
                <div>
                  <p className="text-sm font-medium text-pf-text">No webhooks yet</p>
                  <p className="text-xs text-pf-text-muted mt-1">Add a webhook above to receive real-time event notifications</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {webhooks.map(wh => (
                  <div key={wh.id} className="flex items-center gap-3 px-4 py-3 rounded-pf bg-pf-surface border border-pf-border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-pf-text font-mono truncate" title={wh.url}>
                        {wh.url.length > 50 ? `${wh.url.slice(0, 47)}…` : wh.url}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-overlay text-pf-text-secondary border border-pf-border">
                          {wh.events.length} event{wh.events.length !== 1 ? 's' : ''}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${wh.active ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-overlay text-pf-text-muted'}`}>
                          {wh.active ? 'Active' : 'Inactive'}
                        </span>
                        {wh.failureCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-danger/10 text-pf-danger">
                            {wh.failureCount} failure{wh.failureCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => testWebhook(wh.id)}
                        disabled={webhookTesting === wh.id}
                        aria-label={`Test webhook ${wh.url}`}
                        className="flex items-center gap-1 text-xs text-pf-text-secondary hover:text-pf-cyan-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                      >
                        {webhookTesting === wh.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWebhook(wh.id)}
                        aria-label={`Delete webhook ${wh.url}`}
                        className="text-pf-danger hover:text-pf-danger/70 cursor-pointer transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
