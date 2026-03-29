import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft, UserPlus, UserMinus, Settings, Loader2, User,
  TrendingUp, Award, Target, Flame, Hexagon, DollarSign, Users, Eye,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface PublicProfile {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  joinedAt: string;
  followersCount: number;
  followingCount: number;
  publicStrategyCount: number;
  isFollowing: boolean;
}

interface ScoreData {
  score: {
    score: number;
    winRate: string;
    sharpeRatio: string;
    totalTrades: number;
    profitFactor: string;
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
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/profile/${username}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);

          // Fetch score and badges using the profile's userId if available
          if (data.userId) {
            const [scoreRes, badgeRes] = await Promise.all([
              fetch(`/api/v1/scores/${data.userId}`, { credentials: 'include' }),
              fetch(`/api/v1/scores/${data.userId}/badges`, { credentials: 'include' }),
            ]);
            if (scoreRes.ok) setScoreData(await scoreRes.json());
            if (badgeRes.ok) setBadges(await badgeRes.json());
          }
        }
      } catch { /* keep state */ }
      setLoading(false);
    })();
  }, [username]);

  const isOwn = me && profile && me.username === profile.username;

  async function toggleFollow() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/v1/profile/${profile.username}/follow`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? { ...prev, isFollowing: data.following, followersCount: data.followersCount } : prev);
      }
    } catch { /* keep state */ }
    setFollowLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
          <div className="flex items-center gap-4">
            <div className="size-20 rounded-full bg-pf-overlay animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-pf-overlay rounded animate-pulse" />
              <div className="h-3 w-24 bg-pf-overlay rounded animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-[80%] bg-pf-overlay rounded animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="size-10 text-pf-text-muted mb-3" />
          <p className="text-sm font-medium text-pf-text">User not found</p>
          <p className="text-xs text-pf-text-muted mt-1">This profile doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const initials = (profile.displayName ?? profile.username).slice(0, 2).toUpperCase();
  const joinedDate = new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors" aria-label="Go back">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <h1 className="text-2xl font-semibold text-pf-text">{profile.displayName ?? profile.username}</h1>
          {/* Inline score badge */}
          {scoreData?.score && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-bold ${scoreBg(scoreData.score.score)} ${scoreColor(scoreData.score.score)}`}>
              <TrendingUp className="size-3" />
              {scoreData.score.score}
            </div>
          )}
        </div>
        {isOwn ? (
          <Link to="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors">
            <Settings className="size-3.5" aria-hidden="true" />
            Edit Profile
          </Link>
        ) : (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={followLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors ${
              profile.isFollowing
                ? 'bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong'
                : 'bg-pf-cyan-500 text-black hover:bg-pf-cyan-400'
            }`}
          >
            {followLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : profile.isFollowing ? (
              <UserMinus className="size-3.5" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            {profile.isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        {/* Identity */}
        <div className="flex items-center gap-4 mb-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={`${profile.displayName ?? profile.username} avatar`} className="size-20 rounded-full object-cover" />
          ) : (
            <div className="size-20 rounded-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-pf-cyan-400">
              {initials}
            </div>
          )}
          <div>
            <div className="text-lg font-semibold text-pf-text">{profile.displayName ?? profile.username}</div>
            {profile.displayName && (
              <div className="text-sm text-pf-text-muted">@{profile.username}</div>
            )}
            <div className="text-xs font-mono text-pf-text-muted mt-1">Joined {joinedDate}</div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-pf-text-secondary mb-4 leading-relaxed">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center divide-x divide-pf-border-subtle border-t border-pf-border-subtle pt-4 mt-4">
          <div className="flex-1 text-center">
            <div className="text-lg font-mono font-semibold text-pf-text">{profile.followersCount}</div>
            <div className="text-xs text-pf-text-muted">Followers</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-lg font-mono font-semibold text-pf-text">{profile.followingCount}</div>
            <div className="text-xs text-pf-text-muted">Following</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-lg font-mono font-semibold text-pf-text">{profile.publicStrategyCount}</div>
            <div className="text-xs text-pf-text-muted">Strategies</div>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      {scoreData?.score && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-pf-cyan-400" />
            <h2 className="text-sm font-semibold text-pf-text">Edge Rating</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className={`size-16 rounded-full border-2 flex items-center justify-center ${scoreBg(scoreData.score.score)}`}>
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
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="size-4 text-pf-cyan-400" />
            <h2 className="text-sm font-semibold text-pf-text">Badges</h2>
            <span className="text-xs text-pf-text-muted ml-auto">{badges.length} earned</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {badges.map(badge => (
              <div
                key={badge.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-pf bg-pf-surface border border-pf-border-subtle"
              >
                <span className="text-lg">{BADGE_ICONS[badge.type] ?? <Target className="size-4" />}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-pf-text truncate">{badge.name}</div>
                  <div className="text-[10px] text-pf-text-muted">
                    {new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
