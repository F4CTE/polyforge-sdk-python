import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Newspaper, ArrowUpRight, ArrowDownRight, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
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
function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function DetailSkeleton() {
    return (_jsxs("div", { className: "animate-pulse space-y-6", children: [_jsx("div", { className: "h-7 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[40%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[80%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[65%]" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { id } = useParams();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/v1/news/${id}`, { credentials: 'include' })
            .then(r => {
            if (!r.ok)
                throw new Error('Not found');
            return r.json();
        })
            .then((data) => { if (!cancelled) {
            setArticle(data);
            setLoading(false);
        } })
            .catch(() => { if (!cancelled) {
            toast.error('Failed to load article');
            setLoading(false);
        } });
        return () => { cancelled = true; };
    }, [id]);
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-4xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/news", className: "inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: [_jsx(ArrowLeft, { className: "size-3.5" }), " News"] }), loading && _jsx(DetailSkeleton, {}), !loading && !article && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Newspaper, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium text-lg", children: "Article not found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "This article may have been removed or the link is incorrect." }), _jsx(Link, { to: "/news", className: "mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors", children: "Back to News" })] })), !loading && article && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-medium border ${sourceColor(article.source)}`, children: article.source }), _jsx("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-medium ${sentimentColor(article.sentiment)}`, children: article.sentiment })] }), _jsx("h1", { className: "text-xl font-semibold text-pf-text leading-snug", children: article.title }), _jsx("p", { className: "text-xs text-pf-text-muted", children: formatDate(article.publishedAt) }), _jsx("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: article.summary }), _jsxs("a", { href: article.url?.startsWith('https://') ? article.url : '#', target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors", children: [_jsx(ExternalLink, { className: "size-3.5" }), " Read full article"] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("h2", { className: "text-sm font-medium text-pf-text mb-4", children: ["Signals (", article.signals.length, ")"] }), article.signals.length === 0 ? (_jsx("div", { className: "py-8 text-center", children: _jsx("p", { className: "text-xs text-pf-text-muted", children: "No trading signals generated for this article." }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-pf-border-subtle", children: [_jsx("th", { className: "text-left py-2 px-3 text-pf-text-muted font-medium", children: "Market" }), _jsx("th", { className: "text-left py-2 px-3 text-pf-text-muted font-medium", children: "Direction" }), _jsx("th", { className: "text-left py-2 px-3 text-pf-text-muted font-medium", children: "Outcome" }), _jsx("th", { className: "text-left py-2 px-3 text-pf-text-muted font-medium", children: "Confidence" }), _jsx("th", { className: "text-left py-2 px-3 text-pf-text-muted font-medium", children: "Reasoning" }), _jsx("th", { className: "text-right py-2 px-3 text-pf-text-muted font-medium", children: "Action" })] }) }), _jsx("tbody", { children: article.signals.map(signal => (_jsxs("tr", { className: "border-b border-pf-border-subtle last:border-b-0 hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "py-2.5 px-3 text-pf-text font-medium", children: signal.marketName }), _jsx("td", { className: "py-2.5 px-3", children: _jsxs("span", { className: `inline-flex items-center gap-1 font-semibold ${signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`, children: [signal.direction === 'BUY'
                                                                    ? _jsx(ArrowUpRight, { className: "size-3.5" })
                                                                    : _jsx(ArrowDownRight, { className: "size-3.5" }), signal.direction] }) }), _jsx("td", { className: "py-2.5 px-3", children: _jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-semibold ${signal.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: signal.outcome }) }), _jsx("td", { className: "py-2.5 px-3", children: _jsxs("div", { className: "flex items-center gap-2 min-w-[100px]", children: [_jsx("div", { className: `h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`, children: _jsx("div", { className: `h-full rounded-full ${confidenceColor(signal.confidence)}`, style: { width: `${signal.confidence}%` } }) }), _jsxs("span", { className: "font-mono text-pf-text-muted w-7 text-right", children: [signal.confidence, "%"] })] }) }), _jsx("td", { className: "py-2.5 px-3 text-pf-text-secondary max-w-[200px] truncate", children: signal.reasoning }), _jsx("td", { className: "py-2.5 px-3 text-right", children: _jsx(Link, { to: `/markets/${signal.marketId}`, className: "px-2.5 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors", children: "Trade" }) })] }, signal.id))) })] }) }))] })] }))] }));
}
