import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft, Link2, Unlink, CheckCircle, XCircle, Loader2,
  Copy, QrCode, Eye, EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { user, patchUser } = useAuthStore();
  const isConnected = user?.polymarketConnected === true;

  // Credentials form
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
    } catch { /* keep state */ }
    setImporting(false);
  }

  async function deleteCredentials() {
    if (deleting) return;
    if (!confirm('Disconnect your Polymarket account? Your strategies will stop trading.')) return;
    setDeleting(true);
    try {
      const res = await fetch('/auth/v1/credentials', { method: 'DELETE', credentials: 'include' });
      if (res.ok) patchUser({ polymarketConnected: false });
    } catch { /* keep state */ }
    setDeleting(false);
  }

  async function generateBotCode() {
    if (botCodeLoading) return;
    setBotCodeLoading(true);
    try {
      const res = await fetch('/auth/v1/bot-code', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBotCode(data.code);
        setBotCodeExpiry(data.expiresAt);
      }
    } catch { /* keep state */ }
    setBotCodeLoading(false);
  }

  function copyBotCode() {
    if (botCode) navigator.clipboard.writeText(botCode);
  }

  const canImport = privateKey && apiKey && apiSecret && apiPassphrase && !importing;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-pf-text">Trading Account</h1>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-pf-overlay text-pf-text-muted border-pf-border'
        }`}>
          {isConnected ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
          {isConnected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      {/* Credentials panel */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5">
        {isConnected ? (
          <>
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Polymarket Credentials</h2>
            <p className="text-sm text-pf-text-secondary">
              Your Polymarket account is connected. You can disconnect it at any time -- your strategies will stop trading until you reconnect.
            </p>
            <button onClick={deleteCredentials} disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors">
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              Disconnect Account
            </button>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Import Polymarket Credentials</h2>
            <p className="text-sm text-pf-text-secondary">
              Enter your Polymarket API credentials to enable live trading. These are encrypted at rest.
            </p>
            <div>
              <label className="text-xs text-pf-text-muted mb-1.5 block">
                Private Key <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input type={showPrivateKey ? 'text' : 'password'} value={privateKey} onChange={e => setPrivateKey(e.target.value)} placeholder="0x..."
                  className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
                <button type="button" onClick={() => setShowPrivateKey(!showPrivateKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text">
                  {showPrivateKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-pf-text-muted mb-1.5 block">
                API Key <span className="text-red-400">*</span>
              </label>
              <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key"
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-pf-text-muted mb-1.5 block">
                API Secret <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input type={showApiSecret ? 'text' : 'password'} value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="API Secret"
                  className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
                <button type="button" onClick={() => setShowApiSecret(!showApiSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text">
                  {showApiSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-pf-text-muted mb-1.5 block">
                API Passphrase <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input type={showPassphrase ? 'text' : 'password'} value={apiPassphrase} onChange={e => setApiPassphrase(e.target.value)} placeholder="Passphrase"
                  className="w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
                <button type="button" onClick={() => setShowPassphrase(!showPassphrase)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text">
                  {showPassphrase ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-pf-text-muted mb-1.5 block">
                Safe Address <span className="text-pf-text-muted text-[10px]">(optional)</span>
              </label>
              <input type="text" value={safeAddress} onChange={e => setSafeAddress(e.target.value)} placeholder="0x..."
                className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" />
            </div>
            <button onClick={importCredentials} disabled={!canImport}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-white text-sm font-medium hover:bg-pf-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Connect Account
            </button>
          </>
        )}
      </div>

      {/* Bot link code */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold text-pf-text uppercase tracking-wider">Bot Link Code</h2>
        <p className="text-sm text-pf-text-secondary">
          Generate a one-time code to link the PolyForge Telegram bot to your account. The code expires after 10 minutes.
        </p>

        {botCode && (
          <div className="flex items-center gap-3 bg-pf-surface rounded-pf p-3 border border-pf-border">
            <code className="flex-1 font-mono text-lg text-pf-text tracking-wider">{botCode}</code>
            <button onClick={copyBotCode} className="p-1.5 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text">
              <Copy className="size-4" />
            </button>
          </div>
        )}
        {botCodeExpiry && (
          <p className="text-xs text-pf-text-muted">Expires: <span className="font-mono">{botCodeExpiry}</span></p>
        )}

        <button onClick={generateBotCode} disabled={botCodeLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 transition-colors">
          {botCodeLoading ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
          {botCode ? 'Regenerate Code' : 'Generate Code'}
        </button>
      </div>
    </div>
  );
}
