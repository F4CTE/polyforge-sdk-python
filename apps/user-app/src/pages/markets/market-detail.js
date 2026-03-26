import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Play, Plus, BarChart3, Clock, Droplets, TrendingUp, Zap, X, Newspaper, ArrowUpRight, ArrowDownRight, } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, } from 'recharts';
/* ─── Helpers ────────────────────────────────────────────────────────── */
function formatVolume(vol) {
    const v = parseFloat(vol);
    if (v >= 1_000_000)
        return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)
        return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}
function daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}
function totalLiquidity(tokens) {
    const v = tokens.reduce((sum, t) => sum + parseFloat(t.liquidity || '0'), 0);
    if (v >= 1_000_000)
        return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)
        return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}
function chartRange(res) {
    if (res === '1m')
        return 6 * 60 * 60 * 1000;
    if (res === '1h')
        return 7 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
}
function chartLimit(res) {
    return res === '1d' ? 90 : 200;
}
function bookDepth(entries, index) {
    const total = entries.reduce((s, e) => s + parseFloat(e.size), 0);
    if (total === 0)
        return 0;
    const cumSize = entries.slice(0, index + 1).reduce((s, e) => s + parseFloat(e.size), 0);
    return Math.round((cumSize / total) * 100);
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function DetailSkeleton() {
    return (_jsxs("div", { className: "animate-pulse space-y-6", children: [_jsx("div", { className: "h-7 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[40%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[80%]" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { id } = useParams();
    const navigate = useNavigate();
    // Read CSS variables for Recharts (which needs raw color strings)
    const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const textMuted = styles?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A';
    const bgElevated = styles?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E';
    const borderColor = styles?.getPropertyValue('--color-pf-border').trim() || '#1E3350';
    const textSecondary = styles?.getPropertyValue('--color-pf-text-secondary').trim() || '#7A94B4';
    const cyan500 = styles?.getPropertyValue('--color-pf-cyan-500').trim() || '#06B6D4';
    const [market, setMarket] = useState(null);
    const [loadingMarket, setLoadingMarket] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [loadingChart, setLoadingChart] = useState(true);
    const [resolution, setResolution] = useState('1h');
    const [orderBook, setOrderBook] = useState(null);
    const [loadingBook, setLoadingBook] = useState(true);
    const [showRunStrategy, setShowRunStrategy] = useState(false);
    const [strategyOptions, setStrategyOptions] = useState([]);
    const [selectedStrategyId, setSelectedStrategyId] = useState('');
    // Conditional order dialog state
    const [showConditional, setShowConditional] = useState(false);
    const [condType, setCondType] = useState('TAKE_PROFIT');
    const [condOutcome, setCondOutcome] = useState('YES');
    const [condSize, setCondSize] = useState('');
    const [condTriggerPrice, setCondTriggerPrice] = useState('');
    const [condSubmitting, setCondSubmitting] = useState(false);
    const [relatedNews, setRelatedNews] = useState([]);
    const [loadingNews, setLoadingNews] = useState(true);
    // Load market
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setLoadingMarket(true);
        fetch(`/api/v1/markets/${id}`, { credentials: 'include' })
            .then((r) => {
            if (!r.ok)
                throw new Error('Not found');
            return r.json();
        })
            .then((m) => {
            if (!cancelled) {
                setMarket(m);
                setLoadingMarket(false);
            }
        })
            .catch(() => { if (!cancelled) {
            toast.error('Failed to load market');
            setLoadingMarket(false);
        } });
        return () => { cancelled = true; };
    }, [id]);
    // Load chart
    const loadChart = useCallback((tokenId, res) => {
        setLoadingChart(true);
        const from = new Date(Date.now() - chartRange(res)).toISOString();
        const params = new URLSearchParams({
            resolution: res,
            limit: String(chartLimit(res)),
            from,
        });
        fetch(`/api/v1/markets/${tokenId}/price-history?${params}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((h) => {
            setChartData(h.data.map((d) => ({
                time: res === '1m'
                    ? new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : res === '1h'
                        ? new Date(d.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : new Date(d.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                close: parseFloat(d.close),
            })));
            setLoadingChart(false);
        })
            .catch(() => { toast.error('Failed to load chart data'); setChartData([]); setLoadingChart(false); });
    }, []);
    // Load order book
    const loadBook = useCallback((tokenId) => {
        setLoadingBook(true);
        fetch(`/api/v1/markets/${tokenId}/book`, { credentials: 'include' })
            .then((r) => r.json())
            .then((b) => {
            setOrderBook(b);
            setLoadingBook(false);
        })
            .catch(() => { toast.error('Failed to load order book'); setLoadingBook(false); });
    }, []);
    // When market loads, fetch chart + book
    useEffect(() => {
        if (!market)
            return;
        let cancelled = false;
        const yesToken = market.tokens.find((t) => t.outcome === 'YES');
        if (yesToken) {
            loadChart(yesToken.tokenId, resolution);
            loadBook(yesToken.tokenId);
        }
        return () => { cancelled = true; };
    }, [market, resolution, loadChart, loadBook]);
    // Load related news signals
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setLoadingNews(true);
        fetch(`/api/v1/news/signals?market=${id}&limit=3`, { credentials: 'include' })
            .then(r => r.json())
            .then((data) => {
            if (!cancelled) {
                setRelatedNews(data.data);
                setLoadingNews(false);
            }
        })
            .catch(() => { if (!cancelled)
            setLoadingNews(false); });
        return () => { cancelled = true; };
    }, [id]);
    // When resolution changes
    function onResolutionChange(res) {
        setResolution(res);
        const yesToken = market?.tokens.find((t) => t.outcome === 'YES');
        if (yesToken)
            loadChart(yesToken.tokenId, res);
    }
    // Load strategy options when dialog opens
    useEffect(() => {
        if (!showRunStrategy)
            return;
        fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
            .then((r) => r.json())
            .then((res) => {
            setStrategyOptions(res.data.map((s) => ({ id: s.id, name: s.name })));
        })
            .catch(() => { toast.error('Failed to load strategies'); });
    }, [showRunStrategy]);
    function onStartStrategy() {
        if (!selectedStrategyId)
            return;
        fetch(`/api/v1/strategies/${selectedStrategyId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode: 'paper' }),
        }).then(() => {
            setShowRunStrategy(false);
            setSelectedStrategyId('');
        });
    }
    function openConditional(type, outcome) {
        setCondType(type);
        setCondOutcome(outcome);
        setCondSize('');
        setCondTriggerPrice('');
        setShowConditional(true);
    }
    async function submitConditional() {
        if (!market || !condSize || !condTriggerPrice)
            return;
        setCondSubmitting(true);
        const token = market.tokens.find((t) => t.outcome === condOutcome);
        if (!token) {
            setCondSubmitting(false);
            return;
        }
        try {
            const res = await fetch('/api/v1/orders/conditional', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    marketId: market.id,
                    tokenId: token.tokenId,
                    type: condType,
                    side: 'BUY',
                    outcome: condOutcome,
                    size: condSize,
                    triggerPrice: condTriggerPrice,
                }),
            });
            if (res.ok) {
                toast.success(`${condType === 'TAKE_PROFIT' ? 'Take Profit' : 'Stop Loss'} order created`);
                setShowConditional(false);
            }
            else {
                toast.error('Failed to create conditional order');
            }
        }
        catch {
            toast.error('Failed to create conditional order');
        }
        setCondSubmitting(false);
    }
    const yesPrice = market?.tokens.find((t) => t.outcome === 'YES')?.price ?? null;
    const noPrice = market?.tokens.find((t) => t.outcome === 'NO')?.price ?? null;
    const days = market ? daysUntil(market.endDate) : 0;
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/markets", className: "inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: [_jsx(ArrowLeft, { className: "size-3.5" }), " Markets"] }), loadingMarket && _jsx(DetailSkeleton, {}), !loadingMarket && !market && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("p", { className: "text-pf-text font-medium text-lg", children: "Market not found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "This market may have been removed or the link is incorrect." }), _jsx("button", { onClick: () => navigate('/markets'), className: "mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors", children: "Back to Markets" })] })), !loadingMarket && market && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "px-2 py-0.5 rounded-full bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium", children: market.category }), days >= 0 && days <= 7 && (_jsx("span", { className: "px-2 py-0.5 rounded-full bg-pf-warning/15 text-pf-warning text-xs font-medium", children: "Closing soon" }))] }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text leading-snug", children: market.title }), _jsxs("p", { className: "text-sm text-pf-text-secondary", children: ["Closes ", formatDate(market.endDate), days > 0 && (_jsxs("span", { className: "text-pf-text-muted", children: [" \u00B7 ", days, " days remaining"] }))] })] }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-success/10 border border-pf-success/20", children: [_jsx("span", { className: "text-[10px] uppercase tracking-wide text-pf-success/70", children: "YES" }), _jsx("span", { className: "text-lg font-mono font-semibold text-pf-success", children: yesPrice ?? '\u2014' }), _jsxs("div", { className: "flex gap-1 mt-1", children: [_jsx("button", { onClick: () => openConditional('TAKE_PROFIT', 'YES'), className: "px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-success/20 text-pf-success hover:bg-pf-success/30 transition-colors", children: "TP" }), _jsx("button", { onClick: () => openConditional('STOP_LOSS', 'YES'), className: "px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-danger/20 text-pf-danger hover:bg-pf-danger/30 transition-colors", children: "SL" })] })] }), _jsxs("div", { className: "flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-danger/10 border border-pf-danger/20", children: [_jsx("span", { className: "text-[10px] uppercase tracking-wide text-pf-danger/70", children: "NO" }), _jsx("span", { className: "text-lg font-mono font-semibold text-pf-danger", children: noPrice ?? '\u2014' }), _jsxs("div", { className: "flex gap-1 mt-1", children: [_jsx("button", { onClick: () => openConditional('TAKE_PROFIT', 'NO'), className: "px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-success/20 text-pf-success hover:bg-pf-success/30 transition-colors", children: "TP" }), _jsx("button", { onClick: () => openConditional('STOP_LOSS', 'NO'), className: "px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-danger/20 text-pf-danger hover:bg-pf-danger/30 transition-colors", children: "SL" })] })] })] }), _jsxs("button", { onClick: () => setShowRunStrategy(true), className: "flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 transition-opacity", children: [_jsx(Play, { className: "size-4" }), " Run Strategy"] })] })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [
                            { icon: _jsx(BarChart3, { className: "size-4 text-pf-text-muted" }), label: '24h Volume', value: formatVolume(market.volume24h) },
                            { icon: _jsx(Droplets, { className: "size-4 text-pf-text-muted" }), label: 'Liquidity', value: totalLiquidity(market.tokens) },
                            { icon: _jsx(Clock, { className: "size-4 text-pf-text-muted" }), label: 'End Date', value: formatDate(market.endDate) },
                        ].map((stat) => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [stat.icon, _jsx("span", { className: "text-xs text-pf-text-muted", children: stat.label })] }), _jsx("span", { className: "text-sm font-mono font-medium text-pf-text", children: stat.value })] }, stat.label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsxs("div", { className: "lg:col-span-2 bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("span", { className: "text-sm font-medium text-pf-text", children: "Price History \u2014 YES" }), _jsx("div", { className: "flex gap-1", children: ['1m', '1h', '1d'].map((r) => (_jsx("button", { onClick: () => onResolutionChange(r), className: `px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors ${resolution === r
                                                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                                                        : 'text-pf-text-muted hover:text-pf-text-secondary'}`, children: r }, r))) })] }), _jsx("div", { className: "h-72", children: loadingChart ? (_jsx("div", { className: "h-full bg-pf-overlay rounded-pf animate-pulse" })) : chartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: chartData, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "cyanGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: cyan500, stopOpacity: 0.15 }), _jsx("stop", { offset: "100%", stopColor: cyan500, stopOpacity: 0 })] }) }), _jsx(XAxis, { dataKey: "time", tick: { fontSize: 10, fill: textMuted }, tickLine: false, axisLine: false, interval: "preserveStartEnd" }), _jsx(YAxis, { domain: [0, 1], tick: { fontSize: 10, fill: textMuted }, tickLine: false, axisLine: false, tickFormatter: (v) => v.toFixed(2), width: 40 }), _jsx(Tooltip, { contentStyle: {
                                                            background: bgElevated,
                                                            border: `1px solid ${borderColor}`,
                                                            borderRadius: 6,
                                                            fontSize: 12,
                                                            fontFamily: "'JetBrains Mono', monospace",
                                                        }, labelStyle: { color: textSecondary }, itemStyle: { color: cyan500 }, formatter: (value) => [value.toFixed(3), 'YES'] }), _jsx(Area, { type: "monotone", dataKey: "close", stroke: cyan500, strokeWidth: 1.5, fill: "url(#cyanGrad)", dot: false, activeDot: { r: 3, fill: cyan500 } })] }) })) : (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-pf-text-muted text-sm", children: [_jsx(TrendingUp, { className: "size-8 opacity-20 mb-2" }), "No price data available for this resolution", _jsx("button", { onClick: () => {
                                                        const yesToken = market?.tokens.find((t) => t.outcome === 'YES');
                                                        if (yesToken)
                                                            loadChart(yesToken.tokenId, resolution);
                                                    }, className: "mt-2 px-3 py-1 rounded-pf text-xs bg-pf-overlay hover:bg-pf-border transition-colors", children: "Retry" })] })) })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-sm font-medium text-pf-text", children: "Order Book" }), orderBook && (_jsxs("span", { className: "font-mono text-[11px] text-pf-text-muted", children: ["spread ", orderBook.spread] }))] }), loadingBook ? (_jsx("div", { className: "space-y-1.5", children: Array.from({ length: 5 }, (_, i) => (_jsx("div", { className: "h-6 bg-pf-overlay rounded animate-pulse" }, i))) })) : orderBook ? (_jsxs("div", { className: "space-y-0", children: [_jsx("div", { className: "space-y-px", children: orderBook.asks
                                                    .slice(0, 8)
                                                    .reverse()
                                                    .map((ask, idx, arr) => (_jsxs("div", { className: "relative flex items-center h-6 px-2 text-xs", children: [_jsx("div", { className: "absolute inset-y-0 right-0 bg-pf-danger/8 rounded-sm", style: { width: `${bookDepth(orderBook.asks.slice(0, 8), arr.length - 1 - idx)}%` } }), _jsx("span", { className: "relative font-mono text-pf-danger w-16", children: ask.price }), _jsx("span", { className: "relative font-mono text-pf-text-muted ml-auto", children: ask.size })] }, `ask-${idx}`))) }), _jsxs("div", { className: "flex items-center gap-2 px-2 py-1.5 border-y border-pf-border-subtle my-1", children: [_jsx("span", { className: "font-mono text-sm text-pf-text font-medium", children: orderBook.midpoint }), _jsx("span", { className: "text-[11px] text-pf-text-muted", children: "mid" })] }), _jsx("div", { className: "space-y-px", children: orderBook.bids.slice(0, 8).map((bid, idx) => (_jsxs("div", { className: "relative flex items-center h-6 px-2 text-xs", children: [_jsx("div", { className: "absolute inset-y-0 right-0 bg-pf-success/8 rounded-sm", style: { width: `${bookDepth(orderBook.bids.slice(0, 8), idx)}%` } }), _jsx("span", { className: "relative font-mono text-pf-success w-16", children: bid.price }), _jsx("span", { className: "relative font-mono text-pf-text-muted ml-auto", children: bid.size })] }, `bid-${idx}`))) })] })) : (_jsx("div", { className: "py-8 text-center text-sm text-pf-text-muted", children: "No book data" }))] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsx("h3", { className: "text-sm font-medium text-pf-text mb-4", children: "Strategies on This Market" }), _jsxs("div", { className: "flex flex-col items-center py-6 text-center", children: [_jsx(Zap, { className: "size-6 text-pf-text-muted mb-2" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "No strategies running on this market yet." }), _jsxs("button", { onClick: () => setShowRunStrategy(true), className: "mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:border-pf-border-strong transition-colors", children: [_jsx(Play, { className: "size-3" }), " Run Strategy"] })] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Newspaper, { className: "size-4 text-pf-text-muted" }), _jsx("h3", { className: "text-sm font-medium text-pf-text", children: "Related News" })] }), _jsx(Link, { to: `/news?market=${id}`, className: "text-[11px] text-pf-text-muted hover:text-pf-cyan-400 transition-colors", children: "See all news \u2192" })] }), loadingNews ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 3 }, (_, i) => (_jsx("div", { className: "h-12 bg-pf-overlay rounded-pf-sm animate-pulse" }, i))) })) : relatedNews.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-6 text-center", children: [_jsx(Newspaper, { className: "size-6 text-pf-text-muted mb-2" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "No news signals for this market yet." })] })) : (_jsx("div", { className: "space-y-2", children: relatedNews.map(signal => (_jsxs(Link, { to: `/news/${signal.articleId}`, className: "flex items-center gap-3 px-3 py-2.5 rounded-pf-sm bg-pf-surface border border-pf-border-subtle hover:border-pf-border-strong transition-colors", children: [_jsxs("span", { className: `flex items-center gap-0.5 text-xs font-semibold shrink-0 ${signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`, children: [signal.direction === 'BUY'
                                                    ? _jsx(ArrowUpRight, { className: "size-3.5" })
                                                    : _jsx(ArrowDownRight, { className: "size-3.5" }), signal.direction] }), _jsx("span", { className: "text-xs text-pf-text truncate flex-1", children: signal.articleTitle }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-[70px]", children: [_jsx("div", { className: `h-1.5 rounded-full flex-1 ${signal.confidence > 70 ? 'bg-pf-success/15' : signal.confidence >= 40 ? 'bg-pf-warning/15' : 'bg-pf-danger/15'}`, children: _jsx("div", { className: `h-full rounded-full ${signal.confidence > 70 ? 'bg-pf-success' : signal.confidence >= 40 ? 'bg-pf-warning' : 'bg-pf-danger'}`, style: { width: `${signal.confidence}%` } }) }), _jsxs("span", { className: "text-[10px] font-mono text-pf-text-muted w-7 text-right", children: [signal.confidence, "%"] })] })] }, signal.id))) }))] }), market.description && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6", children: [_jsx("h3", { className: "text-sm font-medium text-pf-text mb-2", children: "About" }), _jsx("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: market.description })] })), showConditional && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", role: "dialog", "aria-modal": "true", "aria-label": "Set Conditional Order", children: _jsxs("div", { className: "animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-sm p-6 shadow-pf-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsxs("h2", { className: "text-base font-semibold text-pf-text", children: [condType === 'TAKE_PROFIT' ? 'Set Take Profit' : 'Set Stop Loss', " \u2014 ", condOutcome] }), _jsx("button", { onClick: () => setShowConditional(false), "aria-label": "Close dialog", className: "p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1.5", children: "Trigger Price" }), _jsx("input", { type: "number", step: "0.01", min: "0.01", max: "0.99", value: condTriggerPrice, onChange: (e) => setCondTriggerPrice(e.target.value), placeholder: "e.g. 0.75", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1.5", children: "Size (shares)" }), _jsx("input", { type: "number", step: "1", min: "1", value: condSize, onChange: (e) => setCondSize(e.target.value), placeholder: "e.g. 100", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-3 border-t border-pf-border-subtle", children: [_jsx("button", { onClick: () => setShowConditional(false), className: "px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: "Cancel" }), _jsx("button", { onClick: submitConditional, disabled: !condSize || !condTriggerPrice || condSubmitting, className: `flex items-center gap-2 px-4 py-2 rounded-pf text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${condType === 'TAKE_PROFIT' ? 'bg-pf-success' : 'bg-pf-danger'}`, children: condType === 'TAKE_PROFIT' ? 'Set TP' : 'Set SL' })] })] })] }) })), showRunStrategy && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", role: "dialog", "aria-modal": "true", "aria-label": "Run Strategy", children: _jsxs("div", { className: "animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-md p-6 shadow-pf-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsx("h2", { className: "text-base font-semibold text-pf-text", children: "Run Strategy on This Market" }), _jsx("button", { onClick: () => setShowRunStrategy(false), "aria-label": "Close dialog", className: "p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1.5", children: "Select Strategy" }), _jsxs("select", { value: selectedStrategyId, onChange: (e) => setSelectedStrategyId(e.target.value), className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "", children: "Choose a strategy..." }), strategyOptions.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })] }), _jsx("div", { className: "text-center text-xs text-pf-text-muted", children: "or" }), _jsxs(Link, { to: "/strategies/new", onClick: () => setShowRunStrategy(false), className: "flex items-center justify-center gap-2 w-full h-10 rounded-pf border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong transition-colors", children: [_jsx(Plus, { className: "size-4" }), " Create New Strategy"] }), _jsxs("div", { className: "flex gap-2 justify-end pt-3 border-t border-pf-border-subtle", children: [_jsx("button", { onClick: () => setShowRunStrategy(false), className: "px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: "Cancel" }), _jsxs("button", { onClick: onStartStrategy, disabled: !selectedStrategyId, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity", children: [_jsx(Play, { className: "size-3.5" }), " Start Strategy"] })] })] })] }) }))] }))] }));
}
