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
  if (score >= 80) return 'text-gain';
  if (score >= 60) return 'text-accent-text';
  if (score >= 40) return 'text-warning';
  return 'text-loss';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-gain-subtle border-gain/25';
  if (score >= 60) return 'bg-accent-subtle border-accent/25';
  if (score >= 40) return 'bg-warning-subtle border-warning/25';
  return 'bg-loss-subtle border-loss/25';
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
      <div className="bg-elevated border border-default rounded-pf p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="size-20 rounded-full bg-surface animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-surface rounded w-32 animate-pulse" />
            <div className="h-3 bg-surface rounded w-24 animate-pulse" />
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
        <h1 className="text-2xl font-semibold text-primary">My Profile</h1>
        <Link
          to="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-label font-medium text-secondary hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
        >
          <Settings className="size-4" aria-hidden="true" />
          Edit Profile
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-elevated border border-default rounded-pf p-6">
        {/* Identity */}
        <div className="flex items-center gap-4 mb-4">
          {user.avatarUrl ? (
            <img data-testid="profile-avatar" src={user.avatarUrl} alt={`${user.displayName ?? user.username} avatar`} className="size-20 rounded-full object-cover" />
          ) : (
            <div data-testid="profile-avatar" className="size-20 rounded-full bg-surface flex items-center justify-center text-2xl font-semibold text-accent-text">
              {initials}
            </div>
          )}
          <div>
            <div data-testid="profile-display-name" className="text-lg font-semibold text-primary">{user.displayName ?? user.username}</div>
            {user.displayName && (
              <div data-testid="profile-username" className="text-body-sm text-tertiary">@{user.username}</div>
            )}
            <div className="text-label font-mono text-tertiary mt-1">Member since {memberSince}</div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p data-testid="profile-bio" className="text-body-sm text-secondary mb-4 leading-relaxed">{user.bio}</p>
        )}

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          <span data-testid="status-chip" className={`flex items-center gap-2 px-3 py-1 rounded-full text-label font-medium border ${
            user.emailVerified
              ? 'bg-gain/10 text-gain border-gain/20'
              : 'bg-overlay text-tertiary border-default'
          }`}>
            <Mail className="size-3" />
            {user.emailVerified ? 'Email Verified' : 'Email Unverified'}
          </span>
          <span data-testid="status-chip" className={`flex items-center gap-2 px-3 py-1 rounded-full text-label font-medium border ${
            user.polymarketConnected
              ? 'bg-gain/10 text-gain border-gain/20'
              : 'bg-overlay text-tertiary border-default'
          }`}>
            <Link2 className="size-3" />
            {user.polymarketConnected ? 'Polymarket Connected' : 'Not Connected'}
          </span>
          <span data-testid="status-chip" className={`flex items-center gap-2 px-3 py-1 rounded-full text-label font-medium border ${
            user.totpEnabled
              ? 'bg-gain/10 text-gain border-gain/20'
              : 'bg-overlay text-tertiary border-default'
          }`}>
            <Shield className="size-3" />
            {user.totpEnabled ? '2FA Enabled' : '2FA Disabled'}
          </span>
        </div>
      </div>

      {/* Edge Rating card */}
      <div data-testid="edge-rating" className="bg-elevated border border-default rounded-pf p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-accent-text" />
          <h2 className="text-body-md font-semibold text-primary">Edge Rating</h2>
        </div>

        {scoreData?.score ? (
          <>
            {/* Score circle + value */}
            <div className="flex items-center gap-6 mb-4">
              <div className={`size-16 rounded-full border-2 flex items-center justify-center ${scoreBg(scoreData.score.score)}`}>
                <span className={`text-2xl font-semibold font-mono ${scoreColor(scoreData.score.score)}`}>
                  {scoreData.score.score}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-label">
                <div className="flex justify-between">
                  <span className="text-tertiary">Win Rate</span>
                  <span className="font-mono text-primary">{scoreData.score.winRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Sharpe</span>
                  <span className="font-mono text-primary">{scoreData.score.sharpeRatio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Profit Factor</span>
                  <span className="font-mono text-primary">{scoreData.score.profitFactor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Consistency</span>
                  <span className="font-mono text-primary">{scoreData.score.consistency}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Avg Return</span>
                  <span className="font-mono text-primary">{scoreData.score.avgReturn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Trades</span>
                  <span className="font-mono text-primary">{scoreData.score.totalTrades}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-label text-tertiary">
            No score yet. Start trading to build your Edge Rating.
          </p>
        )}
      </div>

      {/* Badges card */}
      <div className="bg-elevated border border-default rounded-pf p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="size-4 text-accent-text" />
          <h2 className="text-body-md font-semibold text-primary">Badges</h2>
          <span className="text-label text-tertiary ml-auto">{badges.length} earned</span>
        </div>

        {badges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {badges.map(badge => (
              <div
                key={badge.id}
                data-testid="badge"
                data-earned={badge.earnedAt}
                className="flex items-center gap-3 px-3 py-2 rounded-pf bg-surface border border-subtle"
              >
                <span data-testid="badge-icon" className="text-lg">{BADGE_ICONS[badge.type] ?? <Target className="size-4" />}</span>
                <div className="min-w-0">
                  <div data-testid="badge-name" className="text-label font-medium text-primary truncate">{badge.name}</div>
                  <div data-testid="earned-date" className="text-caption text-tertiary">
                    {new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-label text-tertiary">
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
            className="flex items-center gap-3 px-4 py-3 bg-elevated border border-default rounded-pf hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
          >
            <span className="text-tertiary">{link.icon}</span>
            <span className="text-body-md font-medium text-primary flex-1">{link.label}</span>
            <ChevronRight className="size-4 text-tertiary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
