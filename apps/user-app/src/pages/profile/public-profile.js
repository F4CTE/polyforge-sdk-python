import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, UserPlus, UserMinus, Settings, Loader2, User, TrendingUp, Award, } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
/* ─── Helpers ────────────────────────────────────────────────────────── */
function scoreColor(score) {
    if (score >= 80)
        return 'text-pf-success';
    if (score >= 60)
        return 'text-pf-cyan-400';
    if (score >= 40)
        return 'text-pf-warning';
    return 'text-pf-danger';
}
function scoreBg(score) {
    if (score >= 80)
        return 'bg-pf-success/15 border-pf-success/25';
    if (score >= 60)
        return 'bg-pf-cyan-500/15 border-pf-cyan-500/25';
    if (score >= 40)
        return 'bg-pf-warning/15 border-pf-warning/25';
    return 'bg-pf-danger/15 border-pf-danger/25';
}
const BADGE_ICONS = {
    FIRST_TRADE: '\u{1F3AF}',
    WINNING_STREAK_5: '\u{1F525}',
    WHALE_HUNTER: '\u{1F433}',
    STRATEGY_MASTER: '\u{1F9E0}',
    COPY_LEADER: '\u{1F451}',
    TOP_10: '\u{1F3C6}',
    TOP_50: '\u{1F31F}',
    CONSISTENT_WINNER: '\u{1F4C8}',
    PAPER_GRADUATE: '\u{1F393}',
    EARLY_ADOPTER: '\u{1F680}',
};
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { username } = useParams();
    const navigate = useNavigate();
    const { user: me } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [scoreData, setScoreData] = useState(null);
    const [badges, setBadges] = useState([]);
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
                        if (scoreRes.ok)
                            setScoreData(await scoreRes.json());
                        if (badgeRes.ok)
                            setBadges(await badgeRes.json());
                    }
                }
            }
            catch { /* keep state */ }
            setLoading(false);
        })();
    }, [username]);
    const isOwn = me && profile && me.username === profile.username;
    async function toggleFollow() {
        if (!profile || followLoading)
            return;
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
        }
        catch { /* keep state */ }
        setFollowLoading(false);
    }
    if (loading) {
        return (_jsx("div", { className: "p-6 max-w-2xl mx-auto", children: _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "size-20 rounded-full bg-pf-overlay animate-pulse" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-5 w-40 bg-pf-overlay rounded animate-pulse" }), _jsx("div", { className: "h-3 w-24 bg-pf-overlay rounded animate-pulse" })] })] }), _jsx("div", { className: "h-3 w-[80%] bg-pf-overlay rounded animate-pulse mt-4" })] }) }));
    }
    if (!profile) {
        return (_jsx("div", { className: "p-6 max-w-2xl mx-auto", children: _jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(User, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "User not found" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "This profile doesn't exist or has been removed." })] }) }));
    }
    const initials = (profile.displayName ?? profile.username).slice(0, 2).toUpperCase();
    const joinedDate = new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (_jsxs("div", { className: "p-6 max-w-2xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: profile.displayName ?? profile.username }), scoreData?.score && (_jsxs("div", { className: `flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-bold ${scoreBg(scoreData.score.score)} ${scoreColor(scoreData.score.score)}`, children: [_jsx(TrendingUp, { className: "size-3" }), scoreData.score.score] }))] }), isOwn ? (_jsxs(Link, { to: "/settings", className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong transition-colors", children: [_jsx(Settings, { className: "size-3.5" }), "Edit Profile"] })) : (_jsxs("button", { onClick: toggleFollow, disabled: followLoading, className: `flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium transition-colors ${profile.isFollowing
                            ? 'bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong'
                            : 'bg-pf-cyan-500 text-black hover:bg-pf-cyan-400'}`, children: [followLoading ? (_jsx(Loader2, { className: "size-3.5 animate-spin" })) : profile.isFollowing ? (_jsx(UserMinus, { className: "size-3.5" })) : (_jsx(UserPlus, { className: "size-3.5" })), profile.isFollowing ? 'Unfollow' : 'Follow'] }))] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-4 mb-4", children: [profile.avatarUrl ? (_jsx("img", { src: profile.avatarUrl, alt: `${profile.displayName ?? profile.username} avatar`, className: "size-20 rounded-full object-cover" })) : (_jsx("div", { className: "size-20 rounded-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-cyan-400", children: initials })), _jsxs("div", { children: [_jsx("div", { className: "text-lg font-semibold text-pf-text", children: profile.displayName ?? profile.username }), profile.displayName && (_jsxs("div", { className: "text-sm text-pf-text-muted", children: ["@", profile.username] })), _jsxs("div", { className: "text-xs font-mono text-pf-text-muted mt-1", children: ["Joined ", joinedDate] })] })] }), profile.bio && (_jsx("p", { className: "text-sm text-pf-text-secondary mb-4 leading-relaxed", children: profile.bio })), _jsxs("div", { className: "flex items-center divide-x divide-pf-border-subtle border-t border-pf-border-subtle pt-4 mt-4", children: [_jsxs("div", { className: "flex-1 text-center", children: [_jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: profile.followersCount }), _jsx("div", { className: "text-xs text-pf-text-muted", children: "Followers" })] }), _jsxs("div", { className: "flex-1 text-center", children: [_jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: profile.followingCount }), _jsx("div", { className: "text-xs text-pf-text-muted", children: "Following" })] }), _jsxs("div", { className: "flex-1 text-center", children: [_jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: profile.publicStrategyCount }), _jsx("div", { className: "text-xs text-pf-text-muted", children: "Strategies" })] })] })] }), scoreData?.score && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(TrendingUp, { className: "size-4 text-pf-cyan-400" }), _jsx("h2", { className: "text-sm font-semibold text-pf-text", children: "Edge Rating" })] }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: `size-16 rounded-full border-2 flex items-center justify-center ${scoreBg(scoreData.score.score)}`, children: _jsx("span", { className: `text-2xl font-bold font-mono ${scoreColor(scoreData.score.score)}`, children: scoreData.score.score }) }), _jsxs("div", { className: "flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Win Rate" }), _jsxs("span", { className: "font-mono text-pf-text", children: [scoreData.score.winRate, "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Sharpe" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.sharpeRatio })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Profit Factor" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.profitFactor })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Consistency" }), _jsxs("span", { className: "font-mono text-pf-text", children: [scoreData.score.consistency, "%"] })] })] })] })] })), badges.length > 0 && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Award, { className: "size-4 text-pf-cyan-400" }), _jsx("h2", { className: "text-sm font-semibold text-pf-text", children: "Badges" }), _jsxs("span", { className: "text-xs text-pf-text-muted ml-auto", children: [badges.length, " earned"] })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2", children: badges.map(badge => (_jsxs("div", { className: "flex items-center gap-2.5 px-3 py-2 rounded-pf bg-pf-surface border border-pf-border-subtle", children: [_jsx("span", { className: "text-lg", children: BADGE_ICONS[badge.type] ?? '\u{2B50}' }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs font-medium text-pf-text truncate", children: badge.name }), _jsx("div", { className: "text-[10px] text-pf-text-muted", children: new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })] })] }, badge.id))) })] }))] }));
}
