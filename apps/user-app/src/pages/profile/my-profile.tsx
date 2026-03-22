import { Link } from 'react-router';
import {
  Settings, Wallet, Code, ChevronRight, Mail, Link2, Shield,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { user } = useAuthStore();

  if (!user) return null;

  const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">My Profile</h1>
        <Link
          to="/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong transition-colors"
        >
          <Settings className="size-3.5" />
          Edit Profile
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        {/* Identity */}
        <div className="flex items-center gap-4 mb-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <div className="size-20 rounded-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-cyan-400">
              {initials}
            </div>
          )}
          <div>
            <div className="text-lg font-semibold text-pf-text">{user.displayName ?? user.username}</div>
            {user.displayName && (
              <div className="text-sm text-pf-text-muted">@{user.username}</div>
            )}
            <div className="text-xs font-mono text-pf-text-muted mt-1">Member since {memberSince}</div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-pf-text-secondary mb-4 leading-relaxed">{user.bio}</p>
        )}

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            user.emailVerified
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Mail className="size-3" />
            {user.emailVerified ? 'Email Verified' : 'Email Unverified'}
          </span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            user.polymarketConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Link2 className="size-3" />
            {user.polymarketConnected ? 'Polymarket Connected' : 'Not Connected'}
          </span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            user.totpEnabled
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Shield className="size-3" />
            {user.totpEnabled ? '2FA Enabled' : '2FA Disabled'}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        {[
          { to: '/settings', icon: <Settings className="size-4" />, label: 'Settings' },
          { to: '/settings/trading-account', icon: <Wallet className="size-4" />, label: 'Trading Account' },
          { to: '/strategies', icon: <Code className="size-4" />, label: 'My Strategies' },
        ].map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 px-4 py-3 bg-pf-elevated border border-pf-border rounded-pf-lg hover:border-pf-border-strong transition-colors"
          >
            <span className="text-pf-text-muted">{link.icon}</span>
            <span className="text-sm font-medium text-pf-text flex-1">{link.label}</span>
            <ChevronRight className="size-4 text-pf-text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
