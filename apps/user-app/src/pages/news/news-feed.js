import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Newspaper, ChevronDown, ChevronUp, ExternalLink, ArrowUpRight, ArrowDownRight, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const SOURCES = ['All', 'Reuters', 'CNN', 'CoinGecko', 'Bloomberg', 'AP News'];
const SENTIMENT_TABS = [
    { label: 'All', value: 'ALL' },
    { label: 'Positive', value: 'POSITIVE' },
    { label: 'Negative', value: 'NEGATIVE' },
    { label: 'Neutral', value: 'NEUTRAL' },
];
function sourceColor(source) {
    const map = {
        Reuters: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        CNN: 'bg-pf-danger/15 text-pf-danger border-pf-danger/30',
        CoinGecko: 'bg-pf-warning/15 text-pf-warning border-pf-warning/30',
        Bloomberg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        'AP News': 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    };
    return map[source] ?? 'bg-pf-overlay text-pf-text-muted border-pf-border';
}
function sentimentColor(s) {
    if (s === 'POSITIVE')
        return 'bg-pf-success/15 text-pf-success';
    if (s === 'NEGATIVE')
        return 'bg-pf-danger/15 text-pf-danger';
    return 'bg-pf-overlay text-pf-text-muted';
}
function confidenceColor(c) {
    if (c > 70)
        return 'bg-pf-success';
    if (c >= 40)
        return 'bg-pf-warning';
    return 'bg-pf-danger';
}
function confidenceBarBg(c) {
    if (c > 70)
        return 'bg-pf-success/15';
    if (c >= 40)
        return 'bg-pf-warning/15';
    return 'bg-pf-danger/15';
}
function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60)
        return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function ArticleSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-5 w-16 bg-pf-overlay rounded-full" }), _jsx("div", { className: "h-5 w-16 bg-pf-overlay rounded-full" }), _jsx("div", { className: "ml-auto h-3 w-16 bg-pf-overlay rounded" })] }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[85%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[70%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[50%]" })] }));
}
function SignalSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-3 space-y-2 animate-shimmer", children: [_jsx("div", { className: "h-3.5 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[40%]" }), _jsx("div", { className: "h-2 bg-pf-overlay rounded w-full" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [searchParams] = useSearchParams();
    const marketFilter = searchParams.get('market') || '';
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [source, setSource] = useState('All');
    const [sentiment, setSentiment] = useState('ALL');
    const [minConfidence, setMinConfidence] = useState(0);
    const [expandedId, setExpandedId] = useState(null);
    const [topSignals, setTopSignals] = useState([]);
    const [loadingSignals, setLoadingSignals] = useState(true);
    const refreshRef = useRef(null);
    /* ─── Load articles ─── */
    const loadArticles = useCallback(async (p, src, sent, minConf) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: '10' });
            if (src !== 'All')
                params.set('source', src);
            if (sent !== 'ALL')
                params.set('sentiment', sent);
            if (minConf > 0)
                params.set('minConfidence', String(minConf));
            if (marketFilter)
                params.set('market', marketFilter);
            const res = await fetch(`/api/v1/news?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setArticles(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load news articles');
        }
        setLoading(false);
    }, [marketFilter]);
    /* ─── Load top signals ─── */
    const loadTopSignals = useCallback(async () => {
        setLoadingSignals(true);
        try {
            const res = await fetch('/api/v1/news/signals/top?minConfidence=70&limit=10', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setTopSignals(data.data);
            }
        }
        catch {
            toast.error('Failed to load signals');
        }
        setLoadingSignals(false);
    }, []);
    useEffect(() => { loadArticles(page, source, sentiment, minConfidence); }, [page, source, sentiment, minConfidence, loadArticles]);
    useEffect(() => { loadTopSignals(); }, [loadTopSignals]);
    // Auto-refresh top signals every 30 seconds
    useEffect(() => {
        refreshRef.current = setInterval(() => { loadTopSignals(); }, 30_000);
        return () => { if (refreshRef.current)
            clearInterval(refreshRef.current); };
    }, [loadTopSignals]);
    function changeSource(s) { setSource(s); setPage(1); }
    function changeSentiment(s) { setSentiment(s); setPage(1); }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Newspaper, { className: "size-6 text-pf-cyan-400" }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "AI News & Signals" })] }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " articles"] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("select", { value: source, onChange: e => changeSource(e.target.value), className: "px-3 py-1.5 rounded-pf-sm text-xs bg-pf-elevated text-pf-text-secondary border border-pf-border hover:border-pf-border-strong transition-colors", children: SOURCES.map(s => (_jsx("option", { value: s, children: s }, s))) }), _jsx("div", { className: "flex gap-1.5", children: SENTIMENT_TABS.map(tab => (_jsx("button", { onClick: () => changeSentiment(tab.value), className: `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${sentiment === tab.value
                                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: tab.label }, tab.value))) }), _jsxs("div", { className: "flex items-center gap-2 ml-auto", children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: "Min Confidence:" }), _jsx("input", { type: "range", min: 0, max: 100, step: 5, value: minConfidence, onMouseUp: e => { setMinConfidence(Number(e.target.value)); setPage(1); }, onChange: e => { }, className: "w-24 accent-pf-cyan-500" }), _jsxs("span", { className: "text-xs font-mono text-pf-text-secondary w-8 text-right", children: [minConfidence, "%"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-4", children: [loading && articles.length === 0 ? (_jsx("div", { className: "space-y-4", children: Array.from({ length: 5 }, (_, i) => _jsx(ArticleSkeleton, {}, i)) })) : articles.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Newspaper, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No news articles found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Adjust filters or check back later." })] })) : (_jsx("div", { className: `space-y-4 ${loading ? 'opacity-60' : ''}`, children: articles.map(article => {
                                    const expanded = expandedId === article.id;
                                    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-medium border ${sourceColor(article.source)}`, children: article.source }), _jsx("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-medium ${sentimentColor(article.sentiment)}`, children: article.sentiment }), article.signals.length > 0 && (_jsxs("span", { className: "px-2 py-0.5 rounded-full text-[11px] font-medium bg-pf-cyan-500/15 text-pf-cyan-400", children: [article.signals.length, " signal", article.signals.length !== 1 ? 's' : ''] })), _jsx("span", { className: "ml-auto text-[11px] text-pf-text-muted", children: timeAgo(article.publishedAt) })] }), _jsxs("a", { href: article.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm font-medium text-pf-text hover:text-pf-cyan-400 transition-colors inline-flex items-center gap-1.5", children: [article.title, _jsx(ExternalLink, { className: "size-3 shrink-0 opacity-50" })] }), _jsx("p", { className: "text-xs text-pf-text-secondary mt-1.5 line-clamp-2 leading-relaxed", children: article.summary }), article.signals.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setExpandedId(expanded ? null : article.id), className: "flex items-center gap-1 mt-3 text-xs text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors", children: [expanded ? _jsx(ChevronUp, { className: "size-3.5" }) : _jsx(ChevronDown, { className: "size-3.5" }), expanded ? 'Hide signals' : `Show ${article.signals.length} signal${article.signals.length !== 1 ? 's' : ''}`] }), expanded && (_jsx("div", { className: "mt-3 space-y-2 border-t border-pf-border-subtle pt-3", children: article.signals.map(signal => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 rounded-pf-sm bg-pf-surface border border-pf-border-subtle", children: [_jsxs("div", { className: `flex items-center gap-1 text-xs font-semibold ${signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`, children: [signal.direction === 'BUY'
                                                                            ? _jsx(ArrowUpRight, { className: "size-3.5" })
                                                                            : _jsx(ArrowDownRight, { className: "size-3.5" }), signal.direction] }), _jsx("span", { className: "text-xs text-pf-text truncate flex-1", children: signal.marketName }), _jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-semibold ${signal.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: signal.outcome }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-[80px]", children: [_jsx("div", { className: `h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`, children: _jsx("div", { className: `h-full rounded-full ${confidenceColor(signal.confidence)}`, style: { width: `${signal.confidence}%` } }) }), _jsxs("span", { className: "text-[10px] font-mono text-pf-text-muted w-7 text-right", children: [signal.confidence, "%"] })] }), _jsx(Link, { to: `/markets/${signal.marketId}`, className: "px-2 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors", children: "Trade" })] }, signal.id))) }))] })), _jsx("div", { className: "flex items-center justify-end mt-2", children: _jsx(Link, { to: `/news/${article.id}`, className: "text-[11px] text-pf-text-muted hover:text-pf-cyan-400 transition-colors", children: "View details \u2192" }) })] }, article.id));
                                }) })), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("h2", { className: "text-sm font-medium text-pf-text mb-4", children: "Top Signals" }), loadingSignals && topSignals.length === 0 ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 4 }, (_, i) => _jsx(SignalSkeleton, {}, i)) })) : topSignals.length === 0 ? (_jsx("div", { className: "py-8 text-center", children: _jsx("p", { className: "text-xs text-pf-text-muted", children: "No high-confidence signals right now." }) })) : (_jsx("div", { className: "space-y-3", children: topSignals.map(signal => (_jsxs("div", { className: `rounded-pf-sm border p-3 transition-all duration-200 ${signal.confidence > 80
                                            ? 'border-pf-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.08)]'
                                            : 'border-pf-border-subtle'}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("span", { className: "text-xs text-pf-text font-medium truncate flex-1", children: signal.marketName }), _jsx("span", { className: `flex items-center gap-0.5 text-xs font-semibold ${signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`, children: signal.direction === 'BUY'
                                                            ? _jsxs(_Fragment, { children: [_jsx(ArrowUpRight, { className: "size-3" }), " BUY"] })
                                                            : _jsxs(_Fragment, { children: [_jsx(ArrowDownRight, { className: "size-3" }), " SELL"] }) })] }), _jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("div", { className: `h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`, children: _jsx("div", { className: `h-full rounded-full transition-all duration-500 ${confidenceColor(signal.confidence)}`, style: { width: `${signal.confidence}%` } }) }), _jsxs("span", { className: "text-[10px] font-mono text-pf-text-muted w-7 text-right", children: [signal.confidence, "%"] })] }), _jsx("p", { className: "text-[11px] text-pf-text-muted line-clamp-1 mb-2", children: signal.reasoning }), _jsx(Link, { to: `/markets/${signal.marketId}`, className: "inline-flex items-center gap-1 px-2.5 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors", children: "Trade" })] }, signal.id))) }))] }) })] })] }));
}
