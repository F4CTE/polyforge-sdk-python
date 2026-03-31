import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft, UserPlus, UserMinus, Settings, Loader2, User,
  TrendingUp, Award, Target, Flame, Hexagon, DollarSign, Users, Eye,
  GitFork, Heart, BarChart2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
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

interface PerfPoint {
  date: string;
  pnl: number;
  cumPnl: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  winRate: number;
  tradeCount: number;
  priceUsdc: number;
  forkCount: number;
  likeCount: number;
  isLiked: boolean;
}

interface ActivityItem {
  id: string;
  marketQuestion: string;
  outcome: string;
  side: string;
  size: number;
  pnl: number;
  resolvedAt: string;
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtPnl(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

interface PerfTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function PerfTooltip({ active, payload, label }: PerfTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const isPos = val >= 0;
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf px-3 py-2 text-xs shadow-lg">
      <div className="text-pf-text-muted mb-0.5">{label}</div>
      <div className={`font-mono font-semibold ${isPos ? 'text-pf-success' : 'text-pf-danger'}`}>
        {fmtPnl(val)}
      </div>
    </div>
  );
}

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

  // Performance chart state
  const [perfData, setPerfData] = useState<PerfPoint[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);

  // Strategies state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);

  // Activity state
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

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

  // Fetch performance data
  useEffect(() => {
    if (!username) return;
    setPerfLoading(true);
    fetch(`/api/v1/users/${username}/performance?period=30d`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) setPerfData(data.data);
      })
      .catch(() => toast.error('Failed to load performance data'))
      .finally(() => setPerfLoading(false));
  }, [username]);

  // Fetch strategies
  useEffect(() => {
    if (!username) return;
    setStrategiesLoading(true);
    fetch(`/api/v1/users/${username}/strategies?visibility=PUBLIC&limit=6`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) setStrategies(data.data);
      })
      .catch(() => toast.error('Failed to load strategies'))
      .finally(() => setStrategiesLoading(false));
  }, [username]);

  // Fetch activity
  useEffect(() => {
    if (!username) return;
    setActivityLoading(true);
    fetch(`/api/v1/users/${username}/activity?limit=5`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) setActivity(data.data);
      })
      .catch(() => toast.error('Failed to load activity'))
      .finally(() => setActivityLoading(false));
  }, [username]);

  const isOwn = me && profile && me.username === profile.username;

  async function toggleFollow() {
    if (!profile || followLoading) return;
    // Optimistic update
    const wasFollowing = profile.isFollowing;
    setProfile(prev => prev ? {
      ...prev,
      isFollowing: !wasFollowing,
      followersCount: wasFollowing ? prev.followersCount - 1 : prev.followersCount + 1,
    } : prev);
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${profile.username}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        // Revert on failure
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: wasFollowing,
          followersCount: wasFollowing ? prev.followersCount + 1 : prev.followersCount - 1,
        } : prev);
        toast.error('Failed to update follow status');
      }
    } catch {
      // Revert on error
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: wasFollowing,
        followersCount: wasFollowing ? prev.followersCount + 1 : prev.followersCount - 1,
      } : prev);
      toast.error('Failed to update follow status');
    }
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

  // Determine chart color based on final cumPnl
  const finalCumPnl = perfData.length > 0 ? perfData[perfData.length - 1].cumPnl : 0;
  const chartColor = finalCumPnl >= 0 ? '#22c55e' : '#ef4444';
  const chartGradientId = finalCumPnl >= 0 ? 'perfGradientGreen' : 'perfGradientRed';

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
          <div className="flex items-center gap-3">
            <span className="text-xs text-pf-text-muted">
              {profile.followersCount.toLocaleString()} follower{profile.followersCount !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={toggleFollow}
              disabled={followLoading}
              aria-label={profile.isFollowing ? 'Unfollow this user' : 'Follow this user'}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                profile.isFollowing
                  ? 'bg-pf-elevated text-pf-text-secondary border border-pf-border hover:border-pf-danger hover:text-pf-danger'
                  : 'bg-pf-cyan-500/15 text-pf-cyan-400 border border-pf-cyan-500/30 hover:bg-pf-cyan-500/25'
              }`}
            >
              {followLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : profile.isFollowing ? (
                <UserMinus className="size-3.5" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              {profile.isFollowing ? (
                <span>
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </span>
              ) : 'Follow'}
            </button>
          </div>
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

      {/* ── A. Performance (30d) Sparkline ─────────────────────────────── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="size-4 text-pf-cyan-400" />
          <h2 className="text-sm font-semibold text-pf-text">Performance (30d)</h2>
          {!perfLoading && perfData.length > 0 && (
            <span className={`ml-auto text-xs font-mono font-semibold ${finalCumPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
              {fmtPnl(finalCumPnl)}
            </span>
          )}
        </div>

        {perfLoading ? (
          <div className="h-[140px] bg-pf-overlay rounded animate-pulse" />
        ) : perfData.length === 0 ? (
          <div className="h-[140px] flex items-center justify-center">
            <p className="text-xs text-pf-text-muted">No trade history yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={perfData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--pf-text-muted, #6b7280)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip content={<PerfTooltip />} />
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#${chartGradientId})`}
                dot={false}
                activeDot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── B. Public Strategies ────────────────────────────────────────── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-pf-cyan-400" />
          <h2 className="text-sm font-semibold text-pf-text">Strategies</h2>
        </div>

        {strategiesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-pf bg-pf-surface border border-pf-border-subtle p-3 space-y-2">
                <div className="h-3.5 w-3/4 bg-pf-overlay rounded animate-pulse" />
                <div className="h-2.5 w-full bg-pf-overlay rounded animate-pulse" />
                <div className="flex gap-2 mt-2">
                  <div className="h-5 w-16 bg-pf-overlay rounded-full animate-pulse" />
                  <div className="h-5 w-12 bg-pf-overlay rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="py-8 flex items-center justify-center">
            <p className="text-xs text-pf-text-muted">No public strategies yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strategies.map(s => (
              <div
                key={s.id}
                className="rounded-pf bg-pf-surface border border-pf-border-subtle p-3 flex flex-col gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-pf-text truncate">{s.name}</div>
                  <div className="text-[11px] text-pf-text-muted truncate mt-0.5">{s.description}</div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-full bg-pf-cyan-500/10 border border-pf-cyan-500/20 text-[10px] font-mono text-pf-cyan-400">
                    {s.winRate.toFixed(0)}% WR
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-pf-overlay border border-pf-border-subtle text-[10px] font-mono text-pf-text-muted">
                    {s.tradeCount} trades
                  </span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3 text-[10px] text-pf-text-muted">
                    <span className="flex items-center gap-0.5">
                      <GitFork className="size-3" />
                      {s.forkCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="size-3" />
                      {s.likeCount}
                    </span>
                    <span className={`font-mono font-semibold ${s.priceUsdc === 0 ? 'text-pf-success' : 'text-pf-text'}`}>
                      {s.priceUsdc === 0 ? 'Free' : `$${s.priceUsdc.toFixed(2)}`}
                    </span>
                  </div>
                  <Link
                    to={`/marketplace/${s.id}`}
                    className="px-2 py-0.5 rounded-pf bg-pf-cyan-500/15 border border-pf-cyan-500/25 text-[10px] font-medium text-pf-cyan-400 hover:bg-pf-cyan-500/25 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── C. Recent Activity ──────────────────────────────────────────── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-pf-cyan-400" />
          <h2 className="text-sm font-semibold text-pf-text">Recent Activity</h2>
        </div>

        {activityLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-pf-border-subtle last:border-0">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-[85%] bg-pf-overlay rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-pf-overlay rounded animate-pulse" />
                </div>
                <div className="h-5 w-14 bg-pf-overlay rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="py-8 flex items-center justify-center">
            <p className="text-xs text-pf-text-muted">No resolved positions yet</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-pf-border-subtle">
            {activity.map(item => {
              const isPos = item.pnl >= 0;
              return (
                <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-pf-text truncate">{item.marketQuestion}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-1.5 py-px rounded-full text-[10px] font-semibold ${
                        item.outcome === 'YES'
                          ? 'bg-pf-success/15 text-pf-success border border-pf-success/20'
                          : 'bg-pf-danger/15 text-pf-danger border border-pf-danger/20'
                      }`}>
                        {item.outcome}
                      </span>
                      <span className="text-[10px] text-pf-text-muted">{item.side}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-semibold ${isPos ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {fmtPnl(item.pnl)}
                    </div>
                    <div className="text-[10px] text-pf-text-muted mt-0.5">{relativeTime(item.resolvedAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
