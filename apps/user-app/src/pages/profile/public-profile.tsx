import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft, UserPlus, UserMinus, Settings, Loader2, User,
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

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/profile/${username}`, { credentials: 'include' });
        if (res.ok) setProfile(await res.json());
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
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-2xl font-semibold text-pf-text">{profile.displayName ?? profile.username}</h1>
        </div>
        {isOwn ? (
          <Link to="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong transition-colors">
            <Settings className="size-3.5" />
            Edit Profile
          </Link>
        ) : (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium transition-colors ${
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
            <div className="size-20 rounded-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-cyan-400">
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
    </div>
  );
}
