import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Input } from '@polyforge/ui';
import {
  ArrowLeft, Link2, Unlink, CheckCircle, XCircle, Loader2,
  Copy, QrCode, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { user, patchUser } = useAuthStore();
  const isConnected = user?.polymarketConnected === true;
  const isKalshiConnected = user?.kalshiConnected === true;

  // Polymarket credentials form
  const [privateKey, setPrivateKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiPassphrase, setApiPassphrase] = useState('');
  const [safeAddress, setSafeAddress] = useState('');
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Kalshi credentials form
  const [kalshiUserId, setKalshiUserId] = useState('');
  const [kalshiImporting, setKalshiImporting] = useState(false);
  const [kalshiDeleting, setKalshiDeleting] = useState(false);

  // Bot link code
  const [botCode, setBotCode] = useState<string | null>(null);
  const [botCodeExpiry, setBotCodeExpiry] = useState<string | null>(null);
  const [botCodeLoading, setBotCodeLoading] = useState(false);

  async function importCredentials() {
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch('/auth/v1/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          privateKey, apiKey, apiSecret, apiPassphrase,
          safeAddress: safeAddress || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        patchUser({ polymarketConnected: data.connected });
        setPrivateKey('');
        setApiKey('');
        setApiSecret('');
        setApiPassphrase('');
        setSafeAddress('');
      }
    } catch { toast.error('Failed to import credentials'); }
    setImporting(false);
  }

  async function deleteCredentials() {
    if (deleting) return;
    if (!confirm('Disconnect your Polymarket account? Your strategies will stop trading.')) return;
    setDeleting(true);
    try {
      const res = await fetch('/auth/v1/credentials', { method: 'DELETE', credentials: 'include' });
      if (res.ok) patchUser({ polymarketConnected: false });
    } catch { toast.error('Failed to disconnect account'); }
    setDeleting(false);
  }

  async function connectKalshi() {
    if (kalshiImporting || !kalshiUserId.trim()) return;
    setKalshiImporting(true);
    try {
      const res = await fetch('/auth/v1/credentials/kalshi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: kalshiUserId.trim() }),
      });
      if (res.ok) {
        patchUser({ kalshiConnected: true });
        setKalshiUserId('');
        toast.success('Kalshi account connected');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message ?? 'Failed to connect Kalshi');
      }
    } catch { toast.error('Failed to connect Kalshi'); }
    setKalshiImporting(false);
  }

  async function disconnectKalshi() {
    if (kalshiDeleting) return;
    if (!confirm('Disconnect your Kalshi account? Cross-venue arbitrage will be disabled.')) return;
    setKalshiDeleting(true);
    try {
      const res = await fetch('/auth/v1/credentials/kalshi', { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        patchUser({ kalshiConnected: false });
        toast.success('Kalshi account disconnected');
      }
    } catch { toast.error('Failed to disconnect Kalshi'); }
    setKalshiDeleting(false);
  }

  async function generateBotCode() {
    if (botCodeLoading) return;
    setBotCodeLoading(true);
    try {
      const res = await fetch('/auth/v1/bot-link', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBotCode(data.code);
        const expiry = new Date(Date.now() + (data.expiresInSeconds ?? 300) * 1000);
        setBotCodeExpiry(expiry.toLocaleTimeString());
      } else {
        toast.error('Failed to generate bot code');
      }
    } catch { toast.error('Failed to generate bot code'); }
    setBotCodeLoading(false);
  }

  function copyBotCode() {
    if (botCode) navigator.clipboard.writeText(botCode).catch(() => toast.error('Copy failed'));
  }

  const canImport = privateKey && apiKey && apiSecret && apiPassphrase && !importing;

  return (
    <div className="animate-fade-in p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="p-2 rounded-pf text-tertiary hover:text-primary hover:bg-elevated focus-visible:outline-none focus-visible:shadow-focus-ring transition-colors" aria-label="Back to settings">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <h1 className="text-2xl font-semibold text-primary">Trading Account</h1>
        </div>
        <span data-testid="trading-status" className={`flex items-center gap-2 px-3 py-2 rounded-full text-label font-medium border ${
          isConnected
            ? 'bg-gain/10 text-gain border-gain/20'
            : 'bg-overlay text-tertiary border-default'
        }`}>
          {isConnected ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
          {isConnected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      {/* Polymarket credentials panel */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-5">
        {isConnected ? (
          <>
            <h2 className="text-body-md font-semibold text-primary uppercase tracking-wider">Polymarket Credentials</h2>
            <p className="text-body-sm text-secondary">
              Your Polymarket account is connected. You can disconnect it at any time -- your strategies will stop trading until you reconnect.
            </p>
            <Button type="button" variant="danger" onClick={deleteCredentials} disabled={deleting} className="flex items-center gap-2">
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              Disconnect Account
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-body-md font-semibold text-primary uppercase tracking-wider">Import Polymarket Credentials</h2>
            <p className="text-body-sm text-secondary">
              Enter your Polymarket API credentials to enable live trading. These are encrypted at rest.
            </p>
            <div>
              <label htmlFor="trading-private-key" className="text-label text-secondary mb-2 block">
                Private Key <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Input id="trading-private-key" type={showPrivateKey ? 'text' : 'password'} value={privateKey} onChange={e => setPrivateKey(e.target.value)} placeholder="0x..." aria-required="true" className="w-full pr-10 font-mono" />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPrivateKey(!showPrivateKey)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showPrivateKey ? "Hide private key" : "Show private key"}>
                  {showPrivateKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="trading-api-key" className="text-label text-secondary mb-2 block">
                API Key <span className="text-loss">*</span>
              </label>
              <Input id="trading-api-key" type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" aria-required="true" className="w-full" />
            </div>
            <div>
              <label htmlFor="trading-api-secret" className="text-label text-secondary mb-2 block">
                API Secret <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Input id="trading-api-secret" type={showApiSecret ? 'text' : 'password'} value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="API Secret" aria-required="true" className="w-full pr-10" />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowApiSecret(!showApiSecret)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showApiSecret ? "Hide API secret" : "Show API secret"}>
                  {showApiSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="trading-api-passphrase" className="text-label text-secondary mb-2 block">
                API Passphrase <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Input id="trading-api-passphrase" type={showPassphrase ? 'text' : 'password'} value={apiPassphrase} onChange={e => setApiPassphrase(e.target.value)} placeholder="Passphrase" aria-required="true" className="w-full pr-10" />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPassphrase(!showPassphrase)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}>
                  {showPassphrase ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="trading-safe-address" className="text-label text-secondary mb-2 block">
                Safe Address <span className="text-tertiary text-caption">(optional)</span>
              </label>
              <Input id="trading-safe-address" type="text" value={safeAddress} onChange={e => setSafeAddress(e.target.value)} placeholder="0x..." className="w-full font-mono" />
            </div>
            <Button type="button" variant="default" onClick={importCredentials} disabled={!canImport} className="flex items-center gap-2">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Connect Account
            </Button>
          </>
        )}
      </div>

      {/* Kalshi credentials panel */}
      <div data-testid="kalshi-panel" className="bg-elevated border border-default rounded-pf p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-body-md font-semibold text-primary uppercase tracking-wider">Kalshi</h2>
          <span data-testid="kalshi-status" className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-label font-medium border ${
            isKalshiConnected
              ? 'bg-gain/10 text-gain border-gain/20'
              : 'bg-overlay text-tertiary border-default'
          }`}>
            {isKalshiConnected ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
            {isKalshiConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {isKalshiConnected ? (
          <>
            <p className="text-body-sm text-secondary">
              Your Kalshi account is connected. Cross-venue arbitrage and Kalshi market data are active.
            </p>
            <div className="flex items-center gap-3 bg-surface rounded-pf p-3 border border-default">
              <span className="text-label text-tertiary">User ID</span>
              <code data-testid="kalshi-user-id-display" className="flex-1 font-mono text-body-sm text-primary">
                {user?.id ? `${user.id.slice(0, 4)}${'•'.repeat(8)}` : '••••••••••••'}
              </code>
            </div>
            <Button
              type="button"
              variant="danger"
              onClick={disconnectKalshi}
              disabled={kalshiDeleting}
              data-testid="kalshi-disconnect-btn"
              className="flex items-center gap-2"
            >
              {kalshiDeleting ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              Disconnect Kalshi
            </Button>
          </>
        ) : (
          <>
            <p className="text-body-sm text-secondary">
              Connect your Kalshi account to enable cross-venue market data and arbitrage opportunities.
            </p>
            <div>
              <label htmlFor="kalshi-user-id" className="text-label text-secondary mb-2 block">
                Kalshi User ID <span className="text-loss">*</span>
              </label>
              <Input
                id="kalshi-user-id"
                type="text"
                value={kalshiUserId}
                onChange={e => setKalshiUserId(e.target.value)}
                placeholder="your-kalshi-user-id"
                aria-required="true"
                data-testid="kalshi-user-id-input"
                className="w-full"
              />
            </div>
            <Button
              type="button"
              variant="default"
              onClick={connectKalshi}
              disabled={!kalshiUserId.trim() || kalshiImporting}
              data-testid="kalshi-connect-btn"
              className="flex items-center gap-2"
            >
              {kalshiImporting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Connect Kalshi
            </Button>
          </>
        )}
      </div>

      {/* Bot link code */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-4">
        <h2 className="text-body-md font-semibold text-primary uppercase tracking-wider">Bot Link Code</h2>
        <p className="text-body-sm text-secondary">
          Generate a one-time code to link the PolyForge Telegram bot to your account. The code expires after 10 minutes.
        </p>

        {botCode && (
          <div className="flex items-center gap-3 bg-surface rounded-pf p-3 border border-default">
            <code className="flex-1 font-mono text-lg text-primary tracking-wider">{botCode}</code>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copyBotCode} aria-label="Copy bot code">
              <Copy className="size-4" />
            </Button>
          </div>
        )}
        {botCodeExpiry && (
          <p className="text-caption text-tertiary">Expires: <span className="font-mono">{botCodeExpiry}</span></p>
        )}

        <Button type="button" variant="secondary" onClick={generateBotCode} disabled={botCodeLoading} className="flex items-center gap-2">
          {botCodeLoading ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
          {botCode ? 'Regenerate Code' : 'Generate Code'}
        </Button>
      </div>
    </div>
  );
}
