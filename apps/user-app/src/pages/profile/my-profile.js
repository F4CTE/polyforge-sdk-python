import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Settings, Wallet, Code, ChevronRight, Mail, Link2, Shield, TrendingUp, Award, } from 'lucide-react';
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
    const { user } = useAuthStore();
    const [scoreData, setScoreData] = useState(null);
    const [badges, setBadges] = useState([]);
    useEffect(() => {
        (async () => {
            try {
                const [scoreRes, badgeRes] = await Promise.all([
                    fetch('/api/v1/scores/me', { credentials: 'include' }),
                    fetch('/api/v1/scores/me/badges', { credentials: 'include' }),
                ]);
                if (scoreRes.ok)
                    setScoreData(await scoreRes.json());
                if (badgeRes.ok)
                    setBadges(await badgeRes.json());
            }
            catch { /* keep state */ }
        })();
    }, []);
    if (!user)
        return (_jsx("div", { className: "animate-fade-in p-6 max-w-4xl mx-auto space-y-6", children: _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: _jsxs("div", { className: "flex items-center gap-4 mb-4", children: [_jsx("div", { className: "size-20 rounded-full bg-pf-surface animate-pulse" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx("div", { className: "h-5 bg-pf-surface rounded w-32 animate-pulse" }), _jsx("div", { className: "h-3 bg-pf-surface rounded w-24 animate-pulse" })] })] }) }) }));
    const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();
    const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (_jsxs("div", { className: "p-6 max-w-2xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "My Profile" }), _jsxs(Link, { to: "/settings", className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text-secondary hover:border-pf-border-strong transition-colors", children: [_jsx(Settings, { className: "size-3.5" }), "Edit Profile"] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-4 mb-4", children: [user.avatarUrl ? (_jsx("img", { src: user.avatarUrl, alt: `${user.displayName ?? user.username} avatar`, className: "size-20 rounded-full object-cover" })) : (_jsx("div", { className: "size-20 rounded-full bg-pf-surface flex items-center justify-center text-2xl font-bold text-pf-cyan-400", children: initials })), _jsxs("div", { children: [_jsx("div", { className: "text-lg font-semibold text-pf-text", children: user.displayName ?? user.username }), user.displayName && (_jsxs("div", { className: "text-sm text-pf-text-muted", children: ["@", user.username] })), _jsxs("div", { className: "text-xs font-mono text-pf-text-muted mt-1", children: ["Member since ", memberSince] })] })] }), user.bio && (_jsx("p", { className: "text-sm text-pf-text-secondary mb-4 leading-relaxed", children: user.bio })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("span", { className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.emailVerified
                                    ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
                                    : 'bg-pf-overlay text-pf-text-muted border-pf-border'}`, children: [_jsx(Mail, { className: "size-3" }), user.emailVerified ? 'Email Verified' : 'Email Unverified'] }), _jsxs("span", { className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.polymarketConnected
                                    ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
                                    : 'bg-pf-overlay text-pf-text-muted border-pf-border'}`, children: [_jsx(Link2, { className: "size-3" }), user.polymarketConnected ? 'Polymarket Connected' : 'Not Connected'] }), _jsxs("span", { className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.totpEnabled
                                    ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
                                    : 'bg-pf-overlay text-pf-text-muted border-pf-border'}`, children: [_jsx(Shield, { className: "size-3" }), user.totpEnabled ? '2FA Enabled' : '2FA Disabled'] })] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(TrendingUp, { className: "size-4 text-pf-cyan-400" }), _jsx("h2", { className: "text-sm font-semibold text-pf-text", children: "Edge Rating" })] }), scoreData?.score ? (_jsx(_Fragment, { children: _jsxs("div", { className: "flex items-center gap-6 mb-4", children: [_jsx("div", { className: `size-16 rounded-full border-2 flex items-center justify-center ${scoreBg(scoreData.score.score)}`, children: _jsx("span", { className: `text-2xl font-bold font-mono ${scoreColor(scoreData.score.score)}`, children: scoreData.score.score }) }), _jsxs("div", { className: "flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Win Rate" }), _jsxs("span", { className: "font-mono text-pf-text", children: [scoreData.score.winRate, "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Sharpe" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.sharpeRatio })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Profit Factor" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.profitFactor })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Consistency" }), _jsxs("span", { className: "font-mono text-pf-text", children: [scoreData.score.consistency, "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Avg Return" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.avgReturn })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-pf-text-muted", children: "Trades" }), _jsx("span", { className: "font-mono text-pf-text", children: scoreData.score.totalTrades })] })] })] }) })) : (_jsx("p", { className: "text-xs text-pf-text-muted", children: "No score yet. Start trading to build your Edge Rating." }))] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Award, { className: "size-4 text-pf-cyan-400" }), _jsx("h2", { className: "text-sm font-semibold text-pf-text", children: "Badges" }), _jsxs("span", { className: "text-xs text-pf-text-muted ml-auto", children: [badges.length, " earned"] })] }), badges.length > 0 ? (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2", children: badges.map(badge => (_jsxs("div", { className: "flex items-center gap-2.5 px-3 py-2 rounded-pf bg-pf-surface border border-pf-border-subtle", children: [_jsx("span", { className: "text-lg", children: BADGE_ICONS[badge.type] ?? '\u{2B50}' }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs font-medium text-pf-text truncate", children: badge.name }), _jsx("div", { className: "text-[10px] text-pf-text-muted", children: new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })] })] }, badge.id))) })) : (_jsx("p", { className: "text-xs text-pf-text-muted", children: "No badges yet. Keep trading to unlock achievements." }))] }), _jsx("div", { className: "space-y-2", children: [
                    { to: '/settings', icon: _jsx(Settings, { className: "size-4" }), label: 'Settings' },
                    { to: '/settings/trading-account', icon: _jsx(Wallet, { className: "size-4" }), label: 'Trading Account' },
                    { to: '/strategies', icon: _jsx(Code, { className: "size-4" }), label: 'My Strategies' },
                ].map(link => (_jsxs(Link, { to: link.to, className: "flex items-center gap-3 px-4 py-3 bg-pf-elevated border border-pf-border rounded-pf-lg hover:border-pf-border-strong transition-colors", children: [_jsx("span", { className: "text-pf-text-muted", children: link.icon }), _jsx("span", { className: "text-sm font-medium text-pf-text flex-1", children: link.label }), _jsx(ChevronRight, { className: "size-4 text-pf-text-muted" })] }, link.to))) })] }));
}
