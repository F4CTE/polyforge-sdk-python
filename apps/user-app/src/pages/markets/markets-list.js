import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Search, Grid3X3, List, ChevronLeft, ChevronRight, Zap, Trophy, Bitcoin, Landmark, TrendingUp, Wallet, Cpu, LayoutGrid, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const SORT_OPTIONS = [
    { label: 'Volume', value: 'volume' },
    { label: 'Newest', value: 'newest' },
    { label: 'Closing Soon', value: 'closing_soon' },
    { label: 'Liquidity', value: 'liquidity' },
];
const CATEGORIES = ['all', 'Sports', 'Crypto', 'Politics', 'Economics', 'Finance', 'Technology'];
const CATEGORY_ICONS = {
    all: _jsx(LayoutGrid, { className: "size-4" }),
    Sports: _jsx(Trophy, { className: "size-4" }),
    Crypto: _jsx(Bitcoin, { className: "size-4" }),
    Politics: _jsx(Landmark, { className: "size-4" }),
    Economics: _jsx(TrendingUp, { className: "size-4" }),
    Finance: _jsx(Wallet, { className: "size-4" }),
    Technology: _jsx(Cpu, { className: "size-4" }),
};
const CATEGORY_COLORS = {
    Sports: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    Crypto: { bg: 'bg-pf-warning/15', text: 'text-pf-warning' },
    Politics: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    Economics: { bg: 'bg-pf-success/15', text: 'text-pf-success' },
    Finance: { bg: 'bg-pf-cyan-500/15', text: 'text-pf-cyan-400' },
    Technology: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
};
function formatVolume(vol) {
    const v = parseFloat(vol);
    if (v >= 1_000_000)
        return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)
        return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
}
function daysUntil(dateStr) {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    if (d < 0)
        return 'Closed';
    if (d === 0)
        return 'Today';
    if (d === 1)
        return '1 day';
    if (d < 30)
        return `${d} days`;
    const months = Math.round(d / 30);
    return `${months}mo`;
}
function isClosingSoon(dateStr) {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    return d >= 0 && d <= 7;
}
function tokenPercent(token) {
    return Math.round(parseFloat(token.price || '0') * 100);
}
function yesPercent(market) {
    const token = market.tokens.find((t) => t.outcome === 'YES');
    if (!token)
        return 50;
    return Math.round(parseFloat(token.price || '0') * 100);
}
function priceCents(market, outcome) {
    const token = market.tokens.find((t) => t.outcome === outcome);
    if (!token)
        return '\u2014';
    const val = parseFloat(token.price);
    return Math.round(val * 100) + '\u00A2';
}
// strategyCount removed — synthetic data must not be shown to users.
// TODO: Replace with real strategy count from API when available.
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-12 h-12 rounded-pf-md bg-pf-overlay shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-4 bg-pf-overlay rounded w-[85%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[50%]" })] })] }), _jsx("div", { className: "h-1.5 bg-pf-overlay rounded-full" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("div", { className: "h-9 bg-pf-overlay rounded-pf" }), _jsx("div", { className: "h-9 bg-pf-overlay rounded-pf" })] })] }));
}
/* ─── Market Card ────────────────────────────────────────────────────── */
const MarketCard = memo(function MarketCard({ market, featured }) {
    const catColor = CATEGORY_COLORS[market.category];
    return (_jsxs(Link, { to: `/markets/${market.id}`, className: `group block bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5 ${featured ? 'ring-1 ring-pf-cyan-500/20' : ''}`, children: [_jsxs("div", { className: "flex items-start gap-3 mb-3", children: [market.image ? (_jsx("img", { src: market.image, alt: market.title, className: "w-12 h-12 rounded-pf-md object-cover shrink-0", width: 48, height: 48, loading: "lazy" })) : (_jsx("div", { className: `w-[52px] h-[52px] rounded-pf-md flex items-center justify-center shrink-0 ${catColor?.bg ?? 'bg-pf-overlay'}`, children: _jsx("span", { className: `[&_svg]:size-6 ${catColor?.text ?? 'text-pf-text-muted'}`, children: CATEGORY_ICONS[market.category] ?? _jsx(LayoutGrid, { className: "size-6" }) }) })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h3", { className: "text-sm font-medium text-pf-text leading-snug line-clamp-2 group-hover:text-pf-cyan-400 transition-colors", children: market.title }), _jsxs("div", { className: "flex items-center gap-1.5 mt-1 text-xs text-pf-text-secondary", children: [_jsxs("span", { children: [formatVolume(market.volume24h), " Vol"] }), _jsx("span", { children: "\u00B7" }), _jsx("span", { className: isClosingSoon(market.endDate) ? 'text-pf-warning' : '', children: daysUntil(market.endDate) })] })] })] }), market.tokens.length <= 2 ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("div", { className: "h-1.5 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-pf-cyan-500 rounded-full transition-all", style: { width: `${yesPercent(market)}%` } }) }), _jsxs("span", { className: "text-[11px] text-pf-text-muted mt-1 block", children: [yesPercent(market), "% chance"] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("span", { className: "h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-pf-success/10 text-pf-success", children: ["Yes ", priceCents(market, 'YES')] }), _jsxs("span", { className: "h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-pf-danger/10 text-pf-danger", children: ["No ", priceCents(market, 'NO')] })] })] })) : (
            /* Multi-outcome */
            _jsxs("div", { className: "space-y-1.5", children: [market.tokens.slice(0, 4).map((token) => (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "w-20 truncate text-pf-text-secondary", children: token.outcome }), _jsx("div", { className: "flex-1 h-1.5 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-pf-cyan-500/60 rounded-full", style: { width: `${tokenPercent(token)}%` } }) }), _jsxs("span", { className: "w-8 text-right font-mono text-pf-text-muted", children: [tokenPercent(token), "%"] })] }, token.tokenId))), market.tokens.length > 4 && (_jsxs("span", { className: "text-[11px] text-pf-text-muted", children: ["+", market.tokens.length - 4, " more"] }))] })), market.tokens.length > 0 && (_jsxs("div", { className: "flex items-center gap-1 mt-3 text-[11px] text-pf-text-muted", children: [_jsx(Zap, { className: "size-3" }), market.tokens.length, " outcomes"] }))] }));
});
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('volume');
    const [category, setCategory] = useState('all');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('pf-markets-view') || 'cards');
    const searchTimeout = useRef(null);
    const load = useCallback(async (p, s, so, cat) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(p));
            params.set('limit', '25');
            if (s)
                params.set('search', s);
            params.set('sort', so);
            if (cat !== 'all')
                params.set('category', cat);
            const res = await fetch(`/api/v1/markets?${params}`, { credentials: 'include' });
            if (!res.ok)
                throw new Error('Failed to load');
            const data = await res.json();
            setMarkets(data.data);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        }
        catch {
            toast.error('Failed to load markets');
        }
        finally {
            setLoading(false);
        }
    }, []);
    // Keep a ref to the latest search value so the debounce callback never captures stale state
    const searchRef = useRef(search);
    searchRef.current = search;
    useEffect(() => {
        load(page, search, sort, category);
    }, [page, search, sort, category, load]);
    function onSearchInput(value) {
        if (searchTimeout.current)
            clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 300);
    }
    function changeViewMode(mode) {
        setViewMode(mode);
        localStorage.setItem('pf-markets-view', mode);
    }
    // Category filtering is now done server-side via query param
    const filtered = markets;
    const featured = filtered.slice(0, 3);
    const grid = filtered.slice(3);
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Markets" }), !loading && (_jsxs("span", { className: "text-sm text-pf-text-muted", children: [total.toLocaleString(), " markets"] }))] }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { type: "text", placeholder: "Search markets...", defaultValue: "", onChange: (e) => onSearchInput(e.target.value), className: "w-full h-11 pl-11 pr-4 rounded-full bg-pf-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors" })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: CATEGORIES.map((cat) => (_jsxs("button", { onClick: () => { setCategory(cat); setPage(1); }, className: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${category === cat
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                        : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: [CATEGORY_ICONS[cat], cat === 'all' ? 'All' : cat] }, cat))) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { children: !loading && (_jsxs("span", { className: "text-sm text-pf-text-muted", children: [filtered.length, " results"] })) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex bg-pf-surface rounded-pf border border-pf-border-subtle", children: [_jsx("button", { onClick: () => changeViewMode('cards'), className: `p-1.5 rounded-pf-sm transition-colors ${viewMode === 'cards' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-muted hover:text-pf-text-secondary'}`, "aria-label": "Card view", children: _jsx(Grid3X3, { className: "size-4" }) }), _jsx("button", { onClick: () => changeViewMode('table'), className: `p-1.5 rounded-pf-sm transition-colors ${viewMode === 'table' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-muted hover:text-pf-text-secondary'}`, "aria-label": "Table view", children: _jsx(List, { className: "size-4" }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-pf-text-secondary", children: "Sort by" }), _jsx("select", { value: sort, onChange: (e) => { setSort(e.target.value); setPage(1); }, className: "h-8 px-3 rounded-pf bg-pf-elevated border border-pf-border text-xs text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: SORT_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] })] })] }), loading && (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [1, 2, 3].map((i) => _jsx(CardSkeleton, {}, i)) }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", children: Array.from({ length: 8 }, (_, i) => _jsx(CardSkeleton, {}, i)) })] })), !loading && viewMode === 'cards' && (_jsx(_Fragment, { children: filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Search, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No markets found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Try adjusting your search or filters" })] })) : (_jsxs(_Fragment, { children: [featured.length > 0 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children", children: featured.map((m) => _jsx(MarketCard, { market: m, featured: true }, m.id)) })), grid.length > 0 && (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children", children: grid.map((m) => _jsx(MarketCard, { market: m }, m.id)) }))] })) })), !loading && viewMode === 'table' && (_jsx(_Fragment, { children: filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Search, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No markets found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Try adjusting your search or filters" })] })) : (_jsx("div", { className: "border border-pf-border rounded-pf-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Market" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Category" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "YES" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "NO" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Vol 24h" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Closes" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: filtered.map((market) => {
                                    const catColor = CATEGORY_COLORS[market.category];
                                    return (_jsxs("tr", { className: "group hover:bg-pf-elevated/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsx(Link, { to: `/markets/${market.id}`, className: "text-pf-text hover:text-pf-cyan-400 transition-colors line-clamp-1", children: market.title }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor?.bg ?? 'bg-pf-overlay'} ${catColor?.text ?? 'text-pf-text-muted'}`, children: [CATEGORY_ICONS[market.category], market.category] }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-success", children: priceCents(market, 'YES') }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-danger", children: priceCents(market, 'NO') }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: formatVolume(market.volume24h) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: `font-mono text-xs ${isClosingSoon(market.endDate) ? 'text-pf-warning' : 'text-pf-text-secondary'}`, children: daysUntil(market.endDate) }) })] }, market.id));
                                }) })] }) })) })), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
