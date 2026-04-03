import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Settings, Wallet, Code, ChevronRight, Mail, Link2, Shield,
  TrendingUp, Award, Target, Flame, Hexagon, DollarSign, Users, Eye,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ScoreData {
  score: {
    score: number;
    winRate: string;
    sharpeRatio: string;
    avgReturn: string;
    totalTrades: number;
    profitFactor: string;
    maxDrawdown: string;
    consistency: string;
  } | null;
}

interface Badge {
  id: string;
  type: string;
  name: string;
  earnedAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return 'text-pf-success';
  if (score >= 60) return 'text-pf-cyan-400';
  if (score >= 40) return 'text-pf-warning';
  return 'text-pf-danger';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-pf-success/15 border-pf-success/25';
  if (score >= 60) return 'bg-pf-cyan-500/15 border-pf-cyan-500/25';
  if (score >= 40) return 'bg-pf-warning/15 border-pf-warning/25';
  return 'bg-pf-danger/15 border-pf-danger/25';
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  PROPHET: <Target className="size-4" />,
  PROPHET_ELITE: <Flame className="size-4" />,
  POLYMARKET_OG: <Hexagon className="size-4" />,
  TRADING_VOLUME: <DollarSign className="size-4" />,
  FOLLOWERS: <Users className="size-4" />,
  WHALE_WATCHER: <Eye className="size-4" />,
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { user } = useAuthStore();
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [scoreRes, badgeRes] = await Promise.all([
          fetch('/api/v1/scores/me', { credentials: 'include' }),
          fetch('/api/v1/scores/me/badges', { credentials: 'include' }),
        ]);
        if (scoreRes.ok) setScoreData(await scoreRes.json());
        if (badgeRes.ok) setBadges(await badgeRes.json());
      } catch { /* keep state */ }
    })();
  }, []);

  if (!user) return (
    <div className="animate-fade-in p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="size-20 rounded-pf-full bg-pf-surface animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-pf-surface rounded w-32 animate-pulse" />
            <div className="h-3 bg-pf-surface rounded w-24 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">My Profile</h1>
        <Link
          to="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
        >
          <Settings className="size-4" aria-hidden="true" />
          Edit Profile
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        {/* Identity */}
        <div className="flex items-center gap-4 mb-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`${user.displayName ?? user.username} avatar`} className="size-20 rounded-pf-full object-cover" />
          ) : (
            <div className="size-20 rounded-pf-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-pf-cyan-400">
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
          <span className={`flex items-center gap-2 px-3 py-1 rounded-pf-full text-xs font-medium border ${
            user.emailVerified
              ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Mail className="size-3" />
            {user.emailVerified ? 'Email Verified' : 'Email Unverified'}
          </span>
          <span className={`flex items-center gap-2 px-3 py-1 rounded-pf-full text-xs font-medium border ${
            user.polymarketConnected
              ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Link2 className="size-3" />
            {user.polymarketConnected ? 'Polymarket Connected' : 'Not Connected'}
          </span>
          <span className={`flex items-center gap-2 px-3 py-1 rounded-pf-full text-xs font-medium border ${
            user.totpEnabled
              ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
              : 'bg-pf-overlay text-pf-text-muted border-pf-border'
          }`}>
            <Shield className="size-3" />
            {user.totpEnabled ? '2FA Enabled' : '2FA Disabled'}
          </span>
        </div>
      </div>

      {/* Edge Rating card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-pf-cyan-400" />
          <h2 className="text-sm font-semibold text-pf-text">Edge Rating</h2>
        </div>

        {scoreData?.score ? (
          <>
            {/* Score circle + value */}
            <div className="flex items-center gap-6 mb-4">
              <div className={`size-16 rounded-pf-full border-2 flex items-center justify-center ${scoreBg(scoreData.score.score)}`}>
                <span className={`text-2xl font-bold font-mono ${scoreColor(scoreData.score.score)}`}>
                  {scoreData.score.score}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Win Rate</span>
                  <span className="font-mono text-pf-text">{scoreData.score.winRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Sharpe</span>
                  <span className="font-mono text-pf-text">{scoreData.score.sharpeRatio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Profit Factor</span>
                  <span className="font-mono text-pf-text">{scoreData.score.profitFactor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Consistency</span>
                  <span className="font-mono text-pf-text">{scoreData.score.consistency}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Avg Return</span>
                  <span className="font-mono text-pf-text">{scoreData.score.avgReturn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pf-text-muted">Trades</span>
                  <span className="font-mono text-pf-text">{scoreData.score.totalTrades}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-pf-text-muted">
            No score yet. Start trading to build your Edge Rating.
          </p>
        )}
      </div>

      {/* Badges card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="size-4 text-pf-cyan-400" />
          <h2 className="text-sm font-semibold text-pf-text">Badges</h2>
          <span className="text-xs text-pf-text-muted ml-auto">{badges.length} earned</span>
        </div>

        {badges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {badges.map(badge => (
              <div
                key={badge.id}
                className="flex items-center gap-3 px-3 py-2 rounded-pf bg-pf-surface border border-pf-border-subtle"
              >
                <span className="text-lg">{BADGE_ICONS[badge.type] ?? <Target className="size-4" />}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-pf-text truncate">{badge.name}</div>
                  <div className="text-pf-caption text-pf-text-muted">
                    {new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-pf-text-muted">
            No badges yet. Keep trading to unlock achievements.
          </p>
        )}
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
            className="flex items-center gap-3 px-4 py-3 bg-pf-elevated border border-pf-border rounded-pf-lg hover:border-pf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
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
