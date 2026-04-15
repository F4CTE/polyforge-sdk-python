import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Input, Select, Textarea } from '@polyforge/ui';
import {
  User, Bell, Lock, Shield, Key, Loader2, Check, Copy, Ban, Eye, EyeOff, Fuel, Trash2, AlertTriangle, ShieldAlert,
  Webhook, Send, Plus, ShieldCheck, ShieldOff, Download, KeyRound, RotateCcw,
  History, RefreshCw, ChevronDown, ChevronUp, X, Code,
  Monitor, Smartphone, MapPin, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Tab = 'profile' | 'notifications' | 'password' | '2fa' | 'apikeys' | 'gas' | 'risk' | 'webhooks' | 'sessions';

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

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  responseTimeMs: number | null;
  requestBody: string;
  responseBody: string | null;
  attemptedAt: string;
  error?: string;
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

interface Session {
  id: string;
  deviceName: string;
  ipAddress: string;
  location?: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const TABS: { label: string; value: Tab; icon: React.ReactNode }[] = [
  { label: 'Profile', value: 'profile', icon: <User className="size-4" /> },
  { label: 'Notifications', value: 'notifications', icon: <Bell className="size-4" /> },
  { label: 'Password', value: 'password', icon: <Lock className="size-4" /> },
  { label: '2FA', value: '2fa', icon: <Shield className="size-4" /> },
  { label: 'API Keys', value: 'apikeys', icon: <Key className="size-4" /> },
  { label: 'Gas Usage', value: 'gas', icon: <Fuel className="size-4" /> },
  { label: 'Risk', value: 'risk', icon: <ShieldAlert className="size-4" /> },
  { label: 'Webhooks', value: 'webhooks', icon: <Webhook className="size-4" /> },
  { label: 'Sessions', value: 'sessions', icon: <Monitor className="size-4" /> },
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
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<Record<string, boolean>>({});
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

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

  async function loadDeliveries(id: string) {
    setLoadingDeliveries(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/deliveries?limit=20`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDeliveries(prev => ({ ...prev, [id]: data.data ?? data }));
      } else {
        toast.error('Failed to load deliveries');
      }
    } catch { toast.error('Failed to load deliveries'); }
    setLoadingDeliveries(prev => ({ ...prev, [id]: false }));
  }

  async function retryDelivery(webhookId: string, deliveryId: string) {
    try {
      const res = await fetch(`/api/v1/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Retrying…');
        await loadDeliveries(webhookId);
      } else {
        toast.error('Failed to retry delivery');
      }
    } catch { toast.error('Failed to retry delivery'); }
  }

  function toggleWebhookDeliveries(id: string) {
    if (expandedWebhookId === id) {
      setExpandedWebhookId(null);
      setExpandedDeliveryId(null);
    } else {
      setExpandedWebhookId(id);
      setExpandedDeliveryId(null);
      if (!deliveries[id]) loadDeliveries(id);
    }
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ── Sessions ──
  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list: Session[] = (data.data ?? []).map((s: Session) => ({
          ...s,
          isCurrent: s.id === data.current,
        }));
        list.sort((a, b) => {
          if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
          return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
        });
        setSessions(list);
      } else {
        toast.error('Failed to load sessions');
      }
    } catch { toast.error('Failed to load sessions'); }
    setSessionsLoading(false);
  }

  async function revokeSession(id: string) {
    if (!window.confirm('Revoke this session? That device will be logged out.')) return;
    setRevokingSessionId(id);
    try {
      const res = await fetch(`/api/v1/auth/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        toast.success('Session revoked');
      } else {
        toast.error('Failed to revoke session');
      }
    } catch { toast.error('Failed to revoke session'); }
    setRevokingSessionId(null);
  }

  async function revokeAllSessions() {
    if (!window.confirm('Revoke all other sessions? You will remain logged in on this device.')) return;
    setRevokingAll(true);
    try {
      const res = await fetch('/api/v1/auth/sessions', { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.isCurrent));
        toast.success('All other sessions revoked');
      } else {
        toast.error('Failed to revoke sessions');
      }
    } catch { toast.error('Failed to revoke sessions'); }
    setRevokingAll(false);
  }

  function isMobileDevice(deviceName: string): boolean {
    return /mobile|smartphone|iphone|android|ipad|tablet/i.test(deviceName);
  }

  function sessionRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s} seconds ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }

  function handleTab(t: Tab) {
    setActiveTab(t);
    if (t === 'notifications') loadNotifPrefs();
    if (t === 'apikeys' && apiKeys.length === 0) loadApiKeys();
    if (t === 'gas' && !gasUsage) loadGasUsage();
    if (t === 'risk') { loadRiskSettings(); loadDailyLossSettings(); }
    if (t === 'webhooks') loadWebhooks();
    if (t === 'sessions') loadSessions();
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
    if (scope === 'READ') return 'bg-info/10 text-info';
    if (scope === 'TRADE') return 'bg-warning/10 text-warning';
    if (scope === 'STRATEGY') return 'bg-gain/10 text-gain';
    if (scope === 'WEBHOOK') return 'bg-accent/10 text-accent-text';
    return 'bg-overlay text-secondary';
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
        <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        <div className="text-right">
          <Link
            to="/settings/trading-account"
            className="text-sm text-accent-text hover:text-accent-text transition-colors"
          >
            Manage Trading Account &rarr;
          </Link>
          <p className="text-xs text-tertiary mt-1">Connect or manage your Polymarket wallet</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <Button
            type="button"
            key={t.value}
            role="tab"
            aria-selected={activeTab === t.value}
            variant={activeTab === t.value ? 'default' : 'secondary'}
            size="sm"
            onClick={() => handleTab(t.value)}
            className="flex items-center gap-2 whitespace-nowrap rounded-pf-full"
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      {/* ─── Profile Tab ─── */}
      {activeTab === 'profile' && (
        <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Public Profile</h2>
          <div>
            <label htmlFor="settings-display-name" className="text-xs text-secondary mb-2 block">Display Name</label>
            <Input id="settings-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" className="w-full" />
          </div>
          <div>
            <label htmlFor="settings-bio" className="text-xs text-secondary mb-2 block">Bio</label>
            <Textarea id="settings-bio" value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell others about yourself..." className="w-full resize-y" />
          </div>
          <div>
            <label htmlFor="settings-avatar-url" className="text-xs text-secondary mb-2 block">Avatar URL</label>
            <div className="flex items-center gap-3">
              <Input id="settings-avatar-url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="flex-1" />
              {avatarUrl && <img src={avatarUrl} alt="Avatar preview" className="w-12 h-12 rounded-pf-full object-cover border border-default" />}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="default" onClick={saveProfile} disabled={profileSaving} className="flex items-center gap-2">
              {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Profile
            </Button>
          </div>

          {/* ─── Danger Zone ─── */}
          <div className="mt-10 pt-6 border-t-2 border-loss/20 bg-elevated border border-loss/20 rounded-pf-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-loss uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Danger Zone
            </h2>
            <p className="text-sm text-secondary">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="size-4" />
              Delete Account
            </Button>

            {deleteDialogOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onKeyDown={(e) => { if (e.key === 'Escape') { setDeleteDialogOpen(false); setDeletePassword(''); } }}>
                <div className="bg-elevated border border-default rounded-pf-lg p-6 max-w-md w-full mx-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-pf-full bg-loss/10 flex items-center justify-center">
                      <AlertTriangle className="size-5 text-loss" />
                    </div>
                    <div>
                      <h3 id="delete-dialog-title" className="text-base font-semibold text-primary">Delete Account</h3>
                      <p className="text-xs text-tertiary">This cannot be undone</p>
                    </div>
                  </div>
                  <div className="bg-loss/5 border border-loss/10 rounded-pf p-3">
                    <p className="text-sm text-loss">
                      This will permanently delete your account. All strategies will be stopped.
                      All API keys will be revoked. All data will be lost.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="settings-delete-password" className="text-xs text-secondary mb-2 block">Enter your password to confirm</label>
                    <Input
                      id="settings-delete-password"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDeleteAccount}
                      disabled={deleting || !deletePassword}
                      className="flex items-center gap-2"
                    >
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete My Account
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Notifications Tab ─── */}
      {activeTab === 'notifications' && (
        <div data-testid="notifications-panel" className="bg-elevated border border-default rounded-pf-lg p-6 space-y-6">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Notification Preferences</h2>

          {/* Email Digest Frequency */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-secondary uppercase tracking-wider">Email Digest Frequency</div>
            <p className="text-xs text-tertiary">How often to receive email summaries of your activity</p>
            <div className="flex gap-2 flex-wrap mt-2">
              {EMAIL_DIGEST_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={emailDigest === opt.value ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setEmailDigest(opt.value)}
                  className="rounded-pf-full"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-default" />

          {/* Per-event preferences */}
          {notifLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-overlay" />
                    <div className="h-3 w-52 rounded bg-overlay/60" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-14 rounded-pf-full bg-overlay" />
                    <div className="h-6 w-14 rounded-pf-full bg-overlay" />
                    <div className="h-6 w-14 rounded-pf-full bg-overlay" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Column headers */}
              <div className="flex items-center justify-between pb-1">
                <div />
                <div className="flex gap-2 text-pf-caption font-medium text-tertiary uppercase tracking-wider">
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
                    <div className="text-pf-caption font-semibold text-tertiary uppercase tracking-widest pb-1 border-b border-subtle">
                      {category}
                    </div>
                    {events.map(evtDef => {
                      const pref = notifPrefs.find(p => p.event === evtDef.event) ?? { event: evtDef.event, inApp: true, email: false, push: false };
                      return (
                        <div key={evtDef.event} className="flex items-center justify-between py-3">
                          <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-primary">{evtDef.label}</div>
                            <div className="text-xs text-tertiary mt-1">{evtDef.desc}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {(['inApp', 'email', 'push'] as const).map(field => (
                              <Button
                                key={field}
                                type="button"
                                variant="ghost"
                                role="switch"
                                aria-checked={pref[field]}
                                aria-label={`${evtDef.label} ${field} notification`}
                                onClick={() => toggleNotifField(evtDef.event, field)}
                                className={`px-3 py-1 rounded-pf-full text-pf-caption font-medium w-14 transition-colors cursor-pointer ${
                                  pref[field]
                                    ? 'bg-accent text-primary'
                                    : 'bg-overlay text-tertiary'
                                }`}
                              >
                                {pref[field] ? 'On' : 'Off'}
                              </Button>
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

          <div className="flex justify-end pt-2 border-t border-default">
            <Button type="button" variant="default" onClick={saveNotifications} disabled={notifSaving || notifLoading} className="flex items-center gap-2">
              {notifSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Preferences
            </Button>
          </div>
        </div>
      )}

      {/* ─── Password Tab ─── */}
      {activeTab === 'password' && (
        <div data-testid="password-panel" className="bg-elevated border border-default rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Change Password</h2>
          <div>
            <label htmlFor="settings-current-password" className="text-xs text-secondary mb-2 block">Current Password</label>
            <div className="relative">
              <Input id="settings-current-password" type={showCurrentPw ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full pr-10" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Toggle password visibility">
                {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="settings-new-password" className="text-xs text-secondary mb-2 block">New Password</label>
            <div className="relative">
              <Input id="settings-new-password" type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full pr-10" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Toggle password visibility">
                {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="text-xs text-secondary mb-2 block">Confirm New Password</label>
            <Input id="settings-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full" />
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="text-xs text-loss mt-1 block">Passwords do not match</span>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="default" onClick={savePassword} disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword} className="flex items-center gap-2">
              {pwSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Change Password
            </Button>
          </div>
        </div>
      )}

      {/* ─── 2FA Tab ─── */}
      {activeTab === '2fa' && (
        <div data-testid="twofa-panel" className="bg-elevated border border-default rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Two-Factor Authentication (TOTP)</h2>

          {/* View A: 2FA Disabled */}
          {twoFaView === 'disabled' && (
            <div className="space-y-5">
              <div className="flex items-start gap-4 p-4 rounded-pf bg-surface border border-default">
                <Shield className="size-8 text-tertiary shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-primary">Protect your account with an authenticator app</p>
                  <p className="text-xs text-secondary">
                    Two-factor authentication adds a second layer of security. Each time you sign in,
                    you'll need your password plus a 6-digit code from your authenticator app (e.g. Google
                    Authenticator, Authy, 1Password).
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={twoFaStartSetup}
                disabled={twoFaSetupLoading}
                className="flex items-center gap-2"
              >
                {twoFaSetupLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {twoFaSetupLoading ? 'Generating...' : 'Enable Two-Factor Authentication'}
              </Button>
            </div>
          )}

          {/* View B: Setup Flow */}
          {twoFaView === 'setup' && (
            <div className="space-y-6">
              {/* Step 1: QR Code */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-pf-full bg-accent text-inverse text-xs font-bold">1</span>
                  <h3 className="text-sm font-semibold text-primary">Scan QR Code</h3>
                </div>
                <p className="text-xs text-secondary ml-7">
                  Open your authenticator app and scan the QR code below, or enter the secret key manually.
                </p>
                <div className="ml-7 space-y-3">
                  {twoFaQrCodeUrl.startsWith('data:') ? (
                    <div className="inline-block bg-white p-3 rounded-pf-lg border border-default">{/* bg-white intentional: QR codes require white background for scanner compatibility */}
                      <img src={twoFaQrCodeUrl} alt="TOTP QR Code" className="w-44 h-44" />
                    </div>
                  ) : (
                    <div className="p-4 bg-surface border border-default rounded-pf text-xs text-secondary">
                      <p className="mb-1">Open your authenticator app and add account manually using:</p>
                      <p className="font-mono text-primary break-all">{twoFaQrCodeUrl}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-secondary mb-1">Or enter this secret manually:</p>
                    <code className="block font-mono text-sm text-primary bg-surface border border-default rounded-pf px-3 py-2 tracking-widest break-all">
                      {twoFaSetupSecret}
                    </code>
                  </div>
                </div>
              </div>

              {/* Step 2: Verify */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-pf-full bg-accent text-inverse text-xs font-bold">2</span>
                  <h3 className="text-sm font-semibold text-primary">Enter verification code</h3>
                </div>
                <div className="ml-7 space-y-3">
                  <Input
                    id="2fa-verify-token"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={twoFaVerifyToken}
                    onChange={e => setTwoFaVerifyToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-40 text-2xl font-mono tracking-widest text-center"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="default"
                      onClick={twoFaEnable}
                      disabled={twoFaVerifying || twoFaVerifyToken.length !== 6}
                      className="flex items-center gap-2"
                    >
                      {twoFaVerifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                      Verify & Enable
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setTwoFaView('disabled'); setTwoFaVerifyToken(''); setTwoFaSetupSecret(''); setTwoFaQrCodeUrl(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View C: Backup Codes (shown once after enable) */}
          {twoFaView === 'backup' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-pf bg-gain/10 border border-gain/30">
                <ShieldCheck className="size-5 text-gain shrink-0" />
                <p className="text-sm font-medium text-gain">2FA enabled successfully!</p>
              </div>
              <div className="p-4 bg-warning/5 border border-warning/30 rounded-pf space-y-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="size-4 text-warning shrink-0 mt-1" />
                  <p className="text-xs text-warning font-medium">
                    Save these backup codes somewhere safe. Each can only be used once. If you lose access to
                    your authenticator, you can use a backup code to sign in.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {twoFaBackupCodes.map(code => (
                    <span key={code} className="font-mono text-sm bg-surface px-3 py-2 rounded border border-default text-center text-primary">
                      {code}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => twoFaDownloadCodes(twoFaBackupCodes)}
                    className="flex items-center gap-2"
                  >
                    <Download className="size-4" />
                    Download Backup Codes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => twoFaCopyAll(twoFaBackupCodes)}
                    className="flex items-center gap-2"
                  >
                    {twoFaCopied ? <Check className="size-4 text-gain" /> : <Copy className="size-4" />}
                    {twoFaCopied ? 'Copied!' : 'Copy All'}
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => setTwoFaView('enabled')}
                className="flex items-center gap-2"
              >
                <Check className="size-4" />
                Done
              </Button>
            </div>
          )}

          {/* View D: 2FA Enabled */}
          {twoFaView === 'enabled' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-pf bg-gain/10 border border-gain/30">
                <ShieldCheck className="size-5 text-gain shrink-0" />
                <p className="text-sm font-medium text-gain">Two-factor authentication is active</p>
              </div>

              {/* Regenerate backup codes */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-primary">Backup Codes</p>
                  <p className="text-xs text-secondary mt-1">
                    Generate a new set of backup codes. Your old codes will be invalidated immediately.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={twoFaRegenBackupCodes}
                  disabled={twoFaRegenLoading}
                  className="flex items-center gap-2"
                >
                  {twoFaRegenLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Regenerate Backup Codes
                </Button>

                {twoFaRegenCodes.length > 0 && (
                  <div className="p-4 bg-warning/5 border border-warning/30 rounded-pf space-y-3">
                    <p className="text-xs text-warning font-medium flex items-center gap-2">
                      <KeyRound className="size-4" />
                      New backup codes — save these now, they won't be shown again
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {twoFaRegenCodes.map(code => (
                        <span key={code} className="font-mono text-sm bg-surface px-3 py-2 rounded border border-default text-center text-primary">
                          {code}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => twoFaDownloadCodes(twoFaRegenCodes)}
                        className="flex items-center gap-2"
                      >
                        <Download className="size-4" />
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => twoFaCopyAll(twoFaRegenCodes)}
                        className="flex items-center gap-2"
                      >
                        {twoFaCopied ? <Check className="size-4 text-gain" /> : <Copy className="size-4" />}
                        {twoFaCopied ? 'Copied!' : 'Copy All'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Disable 2FA */}
              <div className="pt-4 border-t border-default space-y-3">
                {!twoFaShowDisableForm ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setTwoFaShowDisableForm(true)}
                    className="flex items-center gap-2"
                  >
                    <ShieldOff className="size-4" />
                    Disable 2FA
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-surface border border-loss/20 rounded-pf">
                    <p className="text-sm font-medium text-primary">Enter your current authenticator code to disable 2FA</p>
                    <Input
                      id="2fa-disable-token"
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={twoFaDisableToken}
                      onChange={e => setTwoFaDisableToken(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-40 text-2xl font-mono tracking-widest text-center"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={twoFaDisable}
                        disabled={twoFaDisabling || twoFaDisableToken.length !== 6}
                        className="flex items-center gap-2"
                      >
                        {twoFaDisabling ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
                        Confirm Disable
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => { setTwoFaShowDisableForm(false); setTwoFaDisableToken(''); }}
                      >
                        Cancel
                      </Button>
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
        <div data-testid="gas-panel" className="bg-elevated border border-default rounded-pf-lg p-6 space-y-5">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Gas Sponsorship</h2>
          <p className="text-sm text-secondary">
            Polyforge absorbs Polygon gas fees so you can trade without worrying about network costs.
          </p>
          {gasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-overlay rounded animate-pulse" />
              ))}
            </div>
          ) : gasUsage ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface rounded-pf p-4 border border-subtle">
                  <span className="text-xs text-secondary uppercase tracking-wider">Today's Usage</span>
                  <span className="block mt-1 text-lg font-mono font-semibold text-primary">
                    {gasUsage.todayUsage.toFixed(4)} MATIC
                  </span>
                </div>
                <div className="bg-surface rounded-pf p-4 border border-subtle">
                  <span className="text-xs text-secondary uppercase tracking-wider">Daily Limit</span>
                  <span className="block mt-1 text-lg font-mono font-semibold text-primary">
                    {gasUsage.dailyLimit.toFixed(4)} MATIC
                  </span>
                </div>
                <div className="bg-surface rounded-pf p-4 border border-subtle">
                  <span className="text-xs text-secondary uppercase tracking-wider">Remaining</span>
                  <span className={`block mt-1 text-lg font-mono font-semibold ${gasUsage.remaining > 0.1 ? 'text-gain' : 'text-loss'}`}>
                    {gasUsage.remaining.toFixed(4)} MATIC
                  </span>
                </div>
              </div>

              {/* Usage bar */}
              <div>
                <div className="flex justify-between text-xs text-secondary mb-2">
                  <span>Usage</span>
                  <span>{((gasUsage.todayUsage / gasUsage.dailyLimit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-overlay rounded-pf-full overflow-hidden">
                  <div
                    className={`h-full rounded-pf-full transition-all duration-pf-slow ${
                      gasUsage.todayUsage / gasUsage.dailyLimit > 0.8 ? 'bg-loss' : 'bg-accent'
                    }`}
                    style={{ width: `${Math.min(100, (gasUsage.todayUsage / gasUsage.dailyLimit) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-pf-full ${gasUsage.sponsorEnabled ? 'bg-gain' : 'bg-loss'}`} />
                <span className="text-secondary">
                  Gas sponsorship is currently {gasUsage.sponsorEnabled ? 'active' : 'inactive'}
                </span>
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={loadGasUsage} className="flex items-center gap-2">
                  <Fuel className="size-4" />
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Fuel className="size-8 text-tertiary mb-2" />
              <p className="text-sm text-tertiary">Unable to load gas usage data.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Risk Tab ─── */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          {/* Circuit Breaker Tripped Banner */}
          {circuitBreakerTripped && (
            <div className="flex items-start gap-3 p-4 rounded-pf-lg bg-loss/10 border border-loss/30">
              <ShieldAlert className="size-5 text-loss shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-loss">Circuit Breaker Tripped</p>
                <p className="text-xs text-secondary mt-1">
                  All running strategies were paused due to drawdown exceeding your threshold.
                  {circuitBreakerTrippedAt && (
                    <span> Triggered {new Date(circuitBreakerTrippedAt).toLocaleString()}.</span>
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={resetCircuitBreaker}
                disabled={riskResetting}
                className="flex items-center gap-2 shrink-0"
              >
                {riskResetting ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Reset
              </Button>
            </div>
          )}

          <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Drawdown Circuit Breaker</h2>
              {riskLoading && <Loader2 className="size-4 animate-spin text-tertiary" />}
            </div>

            <p className="text-xs text-secondary -mt-2">
              Automatically pauses all running strategies if your portfolio loses more than the
              configured percentage within the lookback window.
            </p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-medium">Enable Circuit Breaker</p>
                <p className="text-xs text-tertiary mt-1">Pause all strategies when drawdown threshold is hit</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                role="switch"
                aria-checked={drawdownEnabled}
                onClick={() => setDrawdownEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-pf-full transition-colors ${
                  drawdownEnabled ? 'bg-accent' : 'bg-surface border border-default'
                }`}
              >
                <span className={`inline-block size-4 rounded-pf-full bg-primary shadow transition-transform ${
                  drawdownEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </Button>
            </div>

            {/* Lookback window */}
            <div>
              <label htmlFor="settings-lookback" className="text-xs text-secondary mb-2 block">
                Lookback Window
              </label>
              <Select
                id="settings-lookback"
                value={String(drawdownLookbackHours)}
                onChange={e => setDrawdownLookbackHours(Number(e.target.value))}
                disabled={!drawdownEnabled}
                className="w-full"
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </Select>
            </div>

            {/* Threshold */}
            <div>
              <label htmlFor="settings-threshold" className="text-xs text-secondary mb-2 block">
                Loss Threshold: <span className="font-mono text-loss">{drawdownThresholdPct}%</span>
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
                className="w-full accent-loss disabled:opacity-50"
              />
              <div className="flex justify-between text-pf-caption text-tertiary mt-1">
                <span>1%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-default">
              <Button
                type="button"
                variant="default"
                onClick={saveRiskSettings}
                disabled={riskSaving}
                className="flex items-center gap-2"
              >
                {riskSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save Risk Settings
              </Button>
            </div>
          </div>

          {/* Daily Loss Limit card */}
          <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Daily Loss Limit</h2>
              {dlLoading && <Loader2 className="size-4 animate-spin text-tertiary" />}
            </div>

            <p className="text-xs text-secondary -mt-2">
              Set a hard cap on how much you can lose in a single trading day. When hit, all new trades are paused automatically.
            </p>

            {/* Enable risk controls toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-medium">Enable Risk Controls</p>
                <p className="text-xs text-tertiary mt-1">When off, all limits below are ignored</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                role="switch"
                aria-checked={dlEnabled}
                onClick={() => setDlEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-pf-full transition-colors ${
                  dlEnabled ? 'bg-accent' : 'bg-surface border border-default'
                }`}
              >
                <span className={`inline-block size-4 rounded-pf-full bg-primary shadow transition-transform ${
                  dlEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </Button>
            </div>

            {/* Daily Loss Limit input */}
            <div>
              <label htmlFor="settings-dl-limit" className="text-xs text-secondary mb-2 block">
                Daily Loss Limit (USDC)
              </label>
              <Input
                id="settings-dl-limit"
                type="number"
                min={0}
                step={0.01}
                placeholder="100.00"
                value={dlLimit}
                onChange={e => setDlLimit(e.target.value)}
                disabled={!dlEnabled}
                className="w-full"
              />
              <p className="text-xs text-tertiary mt-2">
                Trading is paused automatically if your daily P&amp;L drops below this threshold.
              </p>
            </div>

            {/* Max Position Size input */}
            <div>
              <label htmlFor="settings-dl-position" className="text-xs text-secondary mb-2 block">
                Max Position Size (USDC)
              </label>
              <Input
                id="settings-dl-position"
                type="number"
                min={0}
                step={0.01}
                placeholder="500.00"
                value={dlMaxPositionSize}
                onChange={e => setDlMaxPositionSize(e.target.value)}
                disabled={!dlEnabled}
                className="w-full"
              />
              <p className="text-xs text-tertiary mt-2">Maximum size for any single position.</p>
            </div>

            {/* Max Open Positions input */}
            <div>
              <label htmlFor="settings-dl-open" className="text-xs text-secondary mb-2 block">
                Max Open Positions
              </label>
              <Input
                id="settings-dl-open"
                type="number"
                min={1}
                max={50}
                step={1}
                placeholder="10"
                value={dlMaxOpenPositions}
                onChange={e => setDlMaxOpenPositions(e.target.value)}
                disabled={!dlEnabled}
                className="w-full"
              />
              <p className="text-xs text-tertiary mt-2">Maximum number of concurrent open positions (1–50).</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-default">
              <Button
                type="button"
                variant="default"
                onClick={saveDailyLossSettings}
                disabled={dlSaving || dlLoading}
                className="flex items-center gap-2"
              >
                {dlSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save Risk Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── API Keys Tab ─── */}
      {activeTab === 'apikeys' && (
        <div data-testid="apikeys-panel" className="bg-elevated border border-default rounded-pf-lg p-6 space-y-6">
          {/* Generate section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Generate API Key</h2>
            <div>
              <label htmlFor="settings-key-name" className="text-xs text-secondary mb-2 block">Key Name</label>
              <Input id="settings-key-name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="My Integration" className="w-full" />
            </div>
            <div>
              <span className="text-xs text-secondary mb-2 block" id="settings-scopes-label">
                Scopes <span className="text-loss">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-labelledby="settings-scopes-label">
                {SCOPES.map(scope => {
                  const checked = newKeyScopes.has(scope.value);
                  return (
                    <label key={scope.value} className={`flex items-start gap-3 p-3 rounded-pf border cursor-pointer transition-colors ${
                      checked ? 'border-accent/50 bg-accent/5' : 'border-default bg-surface hover:border-default-muted'
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setNewKeyScopes(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(scope.value); else next.delete(scope.value);
                          return next;
                        })}
                        className="mt-1 rounded border-default shrink-0"
                      />
                      <div>
                        <span className={`text-xs font-medium block ${scopeBadgeClass(scope.value).split(' ')[1]}`}>{scope.label}</span>
                        <span className="text-pf-label text-tertiary">{scope.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              {newKeyScopes.size === 0 && (
                <p className="text-pf-label text-loss mt-1">Select at least one scope.</p>
              )}
            </div>
            <div>
              <label htmlFor="settings-key-expiration" className="text-xs text-secondary mb-2 block">Expiration (optional)</label>
              <Input id="settings-key-expiration" type="date" lang="en" value={newKeyExpiration} onChange={e => setNewKeyExpiration(e.target.value)} className="w-full max-w-[220px]" />
            </div>
            <Button type="button" variant="default" onClick={createApiKey} disabled={apiKeysCreating || !newKeyName.trim() || newKeyScopes.size === 0} className="flex items-center gap-2">
              {apiKeysCreating ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
              Generate API Key
            </Button>
          </div>

          {/* One-time secret display — key creation */}
          {(createdKey?.secret || createdKey?.key || createdKey?.token) && (
            <div className="space-y-2">
              <div className="bg-warning/10 border border-warning/30 rounded-pf p-3 space-y-2">
                <p className="text-xs text-warning font-medium flex items-center gap-2">
                  <Shield className="size-4 shrink-0" />
                  Copy this secret now — it won&apos;t be shown again
                </p>
                <code className="block font-mono text-sm text-warning break-all">
                  {createdKey.secret ?? createdKey.token ?? createdKey.key}
                </code>
                <div className="flex items-center gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={() => copyKey((createdKey.secret ?? createdKey.token ?? createdKey.key)!)} className="flex items-center gap-2">
                    <Copy className="size-3" /> Copy Secret
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreatedKey(null)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* One-time secret display — key rotation */}
          {rotatedSecret && (
            <div className="space-y-2">
              <div className="bg-warning/10 border border-warning/30 rounded-pf p-3 space-y-2">
                <p className="text-xs text-warning font-medium flex items-center gap-2">
                  <RotateCcw className="size-4 shrink-0" />
                  New secret — copy it now, it won&apos;t be shown again
                </p>
                <code className="block font-mono text-sm text-warning break-all">{rotatedSecret.secret}</code>
                <div className="flex items-center gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={() => copySecret(rotatedSecret.secret)} className="flex items-center gap-2">
                    {secretCopied ? <><Check className="size-3" /> Copied!</> : <><Copy className="size-3" /> Copy Secret</>}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setRotatedSecret(null); setSecretCopied(false); }}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Keys table */}
          <div className="border-t border-subtle pt-6">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Your API Keys</h2>
            {apiKeysLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-overlay rounded animate-pulse" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Key className="size-8 text-tertiary mb-2" />
                <p className="text-sm text-tertiary">No API keys yet. Generate one to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="API keys">
                  <thead>
                    <tr className="text-left text-xs text-secondary uppercase tracking-wider border-b border-subtle">
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
                  <tbody className="divide-y divide-subtle">
                    {apiKeys.map(key => {
                      const displayPrefix = key.keyPrefix ?? (key.prefix ? `${key.prefix}...` : '—');
                      return (
                        <tr key={key.id} className="align-top">
                          <td className="py-3 pr-4 text-primary font-medium">{key.name}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-xs text-secondary">{displayPrefix}</code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => copyKeyPrefix(key.id, displayPrefix)}
                                aria-label={`Copy key prefix for ${key.name}`}
                                className="shrink-0"
                              >
                                {copiedKeyId === key.id
                                  ? <Check className="size-3 text-gain" />
                                  : <Copy className="size-3" />}
                              </Button>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map(scope => (
                                <span key={scope} className={`text-pf-caption px-2 py-1 rounded font-medium ${scopeBadgeClass(scope)}`}>
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-tertiary whitespace-nowrap">{formatDate(key.createdAt)}</td>
                          <td className="py-3 pr-4 text-xs text-tertiary whitespace-nowrap">
                            <div>{daysAgo(key.lastUsedAt)}</div>
                            {typeof key.usageCount === 'number' && (
                              <div className="text-pf-caption text-tertiary">{key.usageCount.toLocaleString()} requests</div>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-tertiary hidden sm:table-cell whitespace-nowrap">
                            {key.expiresAt ? (
                              <span className={new Date(key.expiresAt) < new Date() ? 'text-loss' : ''}>
                                {formatDate(key.expiresAt)}
                              </span>
                            ) : '\u2014'}
                          </td>
                          <td className="py-3 pr-4">
                            {key.revoked || key.active === false ? (
                              <span className="text-pf-caption px-2 py-1 rounded font-medium bg-loss/10 text-loss">Revoked</span>
                            ) : (
                              <span className="text-pf-caption px-2 py-1 rounded font-medium bg-gain/10 text-gain">Active</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => rotateApiKey(key.id)}
                                disabled={key.revoked || key.active === false || rotatingKeyId === key.id}
                                aria-label={`Rotate API key ${key.name}`}
                                title="Rotate key"
                              >
                                {rotatingKeyId === key.id
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <RotateCcw className="size-4" />}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => revokeApiKey(key.id)}
                                disabled={key.revoked || key.active === false}
                                aria-label={`Revoke API key ${key.name}`}
                                title="Revoke key"
                              >
                                <Trash2 className="size-4" />
                              </Button>
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
          <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Add Webhook</h2>
            <div>
              <label htmlFor="webhook-url" className="text-xs text-secondary mb-2 block">HTTPS URL</label>
              <Input
                id="webhook-url"
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full"
              />
              {webhookUrl && !webhookUrl.startsWith('https://') && (
                <span className="text-xs text-loss mt-1 block">URL must start with https://</span>
              )}
            </div>
            <div>
              <div className="text-xs text-secondary mb-2">Events (select at least 1)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEBHOOK_EVENTS.map(event => {
                  const checked = webhookEvents.includes(event);
                  return (
                    <Button
                      key={event}
                      type="button"
                      variant="ghost"
                      onClick={() => setWebhookEvents(prev =>
                        checked ? prev.filter(e => e !== event) : [...prev, event]
                      )}
                      className={`flex items-center gap-2 px-3 py-2 rounded-pf text-xs font-medium border transition-colors text-left ${
                        checked
                          ? 'bg-accent/15 text-accent-text border-accent/30'
                          : 'bg-surface text-secondary border-default hover:border-strong'
                      }`}
                    >
                      <span className={`size-3 rounded-sm border flex items-center justify-center shrink-0 ${checked ? 'bg-accent border-accent' : 'border-default'}`}>
                        {checked && <Check className="size-2 text-inverse" />}
                      </span>
                      {event.replace(/_/g, ' ')}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="default"
                onClick={addWebhook}
                disabled={webhookAdding || !webhookUrl || webhookEvents.length === 0}
                className="flex items-center gap-2"
              >
                {webhookAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add Webhook
              </Button>
            </div>
          </div>

          {/* Webhooks List */}
          <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-3">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Your Webhooks</h2>

            {webhooksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-pf bg-surface animate-pulse" />
                ))}
              </div>
            ) : webhooks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Webhook className="size-8 text-tertiary" />
                <div>
                  <p className="text-sm font-medium text-primary">No webhooks yet</p>
                  <p className="text-xs text-tertiary mt-1">Add a webhook above to receive real-time event notifications</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {webhooks.map(wh => {
                  const whDeliveries = deliveries[wh.id] ?? [];
                  const isExpanded = expandedWebhookId === wh.id;
                  const isLoadingDel = loadingDeliveries[wh.id] ?? false;
                  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                  const recentFailures = whDeliveries.filter(
                    d => !d.success && new Date(d.attemptedAt).getTime() > oneDayAgo
                  ).length;

                  return (
                    <div key={wh.id} className="rounded-pf border border-default overflow-hidden">
                      {/* Webhook row */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-surface">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-primary font-mono truncate" title={wh.url}>
                            {wh.url.length > 50 ? `${wh.url.slice(0, 47)}…` : wh.url}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-pf-caption px-2 py-1 rounded font-medium bg-overlay text-secondary border border-default">
                              {wh.events.length} event{wh.events.length !== 1 ? 's' : ''}
                            </span>
                            <span className={`text-pf-caption px-2 py-1 rounded font-medium ${wh.active ? 'bg-gain/10 text-gain' : 'bg-overlay text-tertiary'}`}>
                              {wh.active ? 'Active' : 'Inactive'}
                            </span>
                            {wh.failureCount > 0 && (
                              <span className="text-pf-caption px-2 py-1 rounded font-medium bg-loss/10 text-loss">
                                {wh.failureCount} failure{wh.failureCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Deliveries button */}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleWebhookDeliveries(wh.id)}
                            aria-label={`${isExpanded ? 'Hide' : 'Show'} deliveries for ${wh.url}`}
                            className="relative flex items-center gap-1"
                          >
                            <History className="size-4" />
                            Deliveries
                            {recentFailures > 0 && (
                              <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-pf-full bg-loss text-primary text-pf-micro font-bold leading-none">
                                {recentFailures}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => testWebhook(wh.id)}
                            disabled={webhookTesting === wh.id}
                            aria-label={`Test webhook ${wh.url}`}
                            className="flex items-center gap-1"
                          >
                            {webhookTesting === wh.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            Test
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => deleteWebhook(wh.id)}
                            aria-label={`Delete webhook ${wh.url}`}
                          >
                            <Trash2 className="size-4 text-loss" />
                          </Button>
                        </div>
                      </div>

                      {/* Expandable deliveries panel */}
                      {isExpanded && (
                        <div className="bg-surface/50 border-t border-subtle rounded-b-pf-lg">
                          {/* Panel header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Recent Deliveries</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => { setExpandedWebhookId(null); setExpandedDeliveryId(null); }}
                              aria-label="Close deliveries"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>

                          {isLoadingDel ? (
                            /* Skeleton rows */
                            <div className="p-3 space-y-2">
                              {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-8 rounded bg-overlay animate-pulse" />
                              ))}
                            </div>
                          ) : whDeliveries.length === 0 ? (
                            <div className="py-8 text-center text-xs text-tertiary">No deliveries yet</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs" aria-label="Webhook deliveries">
                                <thead>
                                  <tr className="text-tertiary border-b border-subtle">
                                    <th className="text-left px-4 py-2 font-medium">Time</th>
                                    <th className="text-left px-4 py-2 font-medium">Event</th>
                                    <th className="text-left px-4 py-2 font-medium">Status</th>
                                    <th className="text-left px-4 py-2 font-medium">Response Time</th>
                                    <th className="text-left px-4 py-2 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                  {whDeliveries.map(del => {
                                    const isDelExpanded = expandedDeliveryId === del.id;
                                    const statusClass = del.statusCode == null
                                      ? 'bg-overlay text-tertiary'
                                      : del.statusCode >= 200 && del.statusCode < 300
                                        ? 'bg-gain/10 text-gain'
                                        : 'bg-loss/10 text-loss';

                                    return (
                                      <>
                                        <tr key={del.id} className="hover:bg-overlay/30 transition-colors">
                                          <td className="px-4 py-2 text-secondary whitespace-nowrap">
                                            {relativeTime(del.attemptedAt)}
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className="px-2 py-1 rounded font-mono bg-overlay text-secondary border border-default">
                                              {del.event}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className={`px-2 py-1 rounded font-medium ${statusClass}`}>
                                              {del.statusCode ?? 'Failed'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-secondary">
                                            {del.responseTimeMs != null ? `${del.responseTimeMs}ms` : '—'}
                                          </td>
                                          <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setExpandedDeliveryId(isDelExpanded ? null : del.id)}
                                                aria-label="View request/response"
                                                className="flex items-center gap-1"
                                              >
                                                <Code className="size-4" />
                                                View
                                              </Button>
                                              {!del.success && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => retryDelivery(wh.id, del.id)}
                                                  aria-label="Retry delivery"
                                                  className="flex items-center gap-1"
                                                >
                                                  <RefreshCw className="size-4" />
                                                  Retry
                                                </Button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                        {isDelExpanded && (
                                          <tr key={`${del.id}-preview`}>
                                            <td colSpan={5} className="px-4 pb-3 pt-1">
                                              <pre className="bg-overlay text-secondary text-xs font-mono p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                                                <span className="text-tertiary">-- Request Body --{'\n'}</span>
                                                {(() => { try { return JSON.stringify(JSON.parse(del.requestBody), null, 2); } catch { return del.requestBody; } })()}
                                                {del.responseBody != null && (
                                                  <>
                                                    {'\n'}<span className="text-tertiary">-- Response Body --{'\n'}</span>
                                                    {(() => { try { return JSON.stringify(JSON.parse(del.responseBody), null, 2); } catch { return del.responseBody; } })()}
                                                  </>
                                                )}
                                              </pre>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Sessions Tab ─── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-elevated border border-default rounded-pf-lg p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-pf bg-accent/10 flex items-center justify-center">
                  <Monitor className="size-4 text-accent-text" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary">Active Sessions</h2>
                  <p className="text-xs text-tertiary mt-1">
                    {sessionsLoading ? 'Loading…' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} total`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={revokeAllSessions}
                disabled={revokingAll || sessions.filter(s => !s.isCurrent).length === 0}
                className="flex items-center gap-2"
              >
                {revokingAll ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Revoke All Other Sessions
              </Button>
            </div>
          </div>

          {/* Session list */}
          <div className="bg-elevated border border-default rounded-pf-lg p-6">
            {sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3 py-3 animate-pulse">
                    <div className="size-9 rounded-pf bg-overlay shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-overlay rounded w-40" />
                      <div className="h-3 bg-overlay rounded w-28" />
                      <div className="h-3 bg-overlay rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Monitor className="size-8 text-tertiary" />
                <p className="text-sm text-tertiary">No other active sessions</p>
              </div>
            ) : (
              <div className="divide-y divide-subtle">
                {sessions.map(session => (
                  <div key={session.id} className="flex items-start gap-3 py-3">
                    <div className="size-9 rounded-pf bg-overlay flex items-center justify-center shrink-0 mt-1">
                      {isMobileDevice(session.deviceName)
                        ? <Smartphone className="size-4 text-secondary" />
                        : <Monitor className="size-4 text-secondary" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-primary">{session.deviceName}</span>
                        {session.isCurrent && (
                          <span className="text-gain bg-gain/10 text-xs px-2 py-1 rounded-pf-full">
                            Current Session
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-tertiary mt-1">{session.ipAddress}</p>
                      {session.location && (
                        <p className="flex items-center gap-1 text-xs text-tertiary mt-1">
                          <MapPin className="size-3 shrink-0" />
                          {session.location}
                        </p>
                      )}
                      <p className="text-xs text-tertiary mt-1">
                        Last active: {sessionRelativeTime(session.lastActiveAt)}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => revokeSession(session.id)}
                        disabled={revokingSessionId === session.id}
                        className="flex items-center gap-2 shrink-0 mt-1"
                      >
                        {revokingSessionId === session.id ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
                        Revoke
                      </Button>
                    )}
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
