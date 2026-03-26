import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronUp } from 'lucide-react';
/* ─── Data ───────────────────────────────────────────────────────────── */
const METHOD_STYLES = {
    GET: { bg: 'bg-pf-success/10', text: 'text-pf-success' },
    POST: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    PATCH: { bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
    DELETE: { bg: 'bg-pf-danger/10', text: 'text-pf-danger' },
};
const SCOPE_STYLES = {
    READ: { bg: 'bg-pf-success/10', text: 'text-pf-success' },
    WRITE: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    TRADE: { bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
};
const ERROR_SHAPE = `{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired API key",
  "field": null,
  "requestId": "req_abc123"
}`;
const ERROR_CODES = [
    { code: 400, meaning: 'Bad Request -- invalid parameters or malformed body' },
    { code: 401, meaning: 'Unauthorized -- missing or invalid API key' },
    { code: 403, meaning: 'Forbidden -- API key lacks the required scope' },
    { code: 404, meaning: 'Not Found -- resource does not exist' },
    { code: 409, meaning: 'Conflict -- action conflicts with current state' },
    { code: 422, meaning: 'Unprocessable Entity -- validation failed' },
    { code: 429, meaning: 'Too Many Requests -- rate limit exceeded' },
    { code: 500, meaning: 'Internal Server Error -- unexpected error on our end' },
];
const CATEGORIES = [
    {
        title: 'Markets',
        endpoints: [
            { method: 'GET', path: '/api/v1/markets', scope: 'READ', description: 'List all available markets with optional filtering.', queryParams: 'search, sort, category',
                curl: 'curl -X GET "https://api.polyforge.app/api/v1/markets?search=election&sort=volume" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'GET', path: '/api/v1/markets/:id', scope: 'READ', description: 'Get full details for a single market.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/mkt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'GET', path: '/api/v1/markets/:tokenId/price-history', scope: 'READ', description: 'Get OHLCV price history for a market token.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/price-history \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'GET', path: '/api/v1/markets/:tokenId/book', scope: 'READ', description: 'Get the current order book for a market token.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/markets/tok_abc123/book \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Strategies',
        endpoints: [
            { method: 'GET', path: '/api/v1/strategies', scope: 'READ', description: 'List all your strategies.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/strategies', scope: 'WRITE', description: 'Create a new strategy.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "My Strategy", "blocks": [...]}\'' },
            { method: 'GET', path: '/api/v1/strategies/:id', scope: 'READ', description: 'Get full details for a strategy.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'PATCH', path: '/api/v1/strategies/:id', scope: 'WRITE', description: 'Update a strategy.',
                curl: 'curl -X PATCH https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "Updated Name"}\'' },
            { method: 'DELETE', path: '/api/v1/strategies/:id', scope: 'WRITE', description: 'Delete a strategy. Must be stopped first.',
                curl: 'curl -X DELETE https://api.polyforge.app/api/v1/strategies/strat_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/strategies/:id/start', scope: 'TRADE', description: 'Start live execution of a strategy.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/strategies/:id/stop', scope: 'TRADE', description: 'Stop a running strategy.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/stop \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/strategies/:id/pause', scope: 'TRADE', description: 'Pause a running strategy temporarily.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/pause \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/strategies/:id/resume', scope: 'TRADE', description: 'Resume a paused strategy.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/resume \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Orders',
        endpoints: [
            { method: 'GET', path: '/api/v1/orders', scope: 'READ', description: 'List your orders with optional filtering.', queryParams: 'status, page, limit',
                curl: 'curl -X GET "https://api.polyforge.app/api/v1/orders?status=filled&limit=50" \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/orders/close-position', scope: 'TRADE', description: 'Close an open position by selling at market.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/orders/close-position \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"positionId": "pos_abc123"}\'' },
        ],
    },
    {
        title: 'Portfolio',
        endpoints: [
            { method: 'GET', path: '/api/v1/portfolio', scope: 'READ', description: 'Get your current positions and aggregated P&L.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'GET', path: '/api/v1/portfolio/pnl', scope: 'READ', description: 'Get P&L time series data for charting.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/portfolio/pnl \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Alerts',
        endpoints: [
            { method: 'GET', path: '/api/v1/alerts', scope: 'READ', description: 'List all your price alerts.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/alerts', scope: 'WRITE', description: 'Create a new price alert.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/alerts \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"marketId": "mkt_abc123", "condition": "above", "price": 0.75}\'' },
            { method: 'DELETE', path: '/api/v1/alerts/:id', scope: 'WRITE', description: 'Delete a price alert.',
                curl: 'curl -X DELETE https://api.polyforge.app/api/v1/alerts/alert_123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Backtests',
        endpoints: [
            { method: 'GET', path: '/api/v1/backtests', scope: 'READ', description: 'List your backtest runs.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/backtests', scope: 'WRITE', description: 'Start a new backtest run.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/backtests \\\n  -H "Authorization: Bearer pf_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"strategyId": "strat_123", "from": "2025-01-01", "to": "2025-06-01"}\'' },
            { method: 'GET', path: '/api/v1/backtests/:id', scope: 'READ', description: 'Get results for a backtest run.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/backtests/bt_abc123 \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Profile',
        endpoints: [
            { method: 'GET', path: '/api/v1/profile/:username', scope: 'READ', description: 'Get a user profile including public strategies and stats.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/profile/alphatrader \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
    {
        title: 'Paper Trading',
        endpoints: [
            { method: 'GET', path: '/api/v1/paper/summary', scope: 'READ', description: 'Get your paper trading account summary.',
                curl: 'curl -X GET https://api.polyforge.app/api/v1/paper/summary \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
            { method: 'POST', path: '/api/v1/paper/reset', scope: 'WRITE', description: 'Reset your paper trading account to default balance.',
                curl: 'curl -X POST https://api.polyforge.app/api/v1/paper/reset \\\n  -H "Authorization: Bearer pf_live_abc123..."' },
        ],
    },
];
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [openEndpoints, setOpenEndpoints] = useState(new Set());
    function toggleEndpoint(key) {
        setOpenEndpoints(prev => {
            const next = new Set(prev);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-4xl mx-auto space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text mb-1", children: "API Documentation" }), _jsx("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: "Use your API key to integrate with external tools, AI agents, and custom applications." })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Authentication" }), _jsxs("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: ["Authenticate every request by including your API key in the", ' ', _jsx("code", { className: "bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono", children: "Authorization" }), " header:"] }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-xs font-mono text-pf-text overflow-x-auto", children: "Authorization: Bearer pf_your_key_here" }), _jsxs("p", { className: "text-sm text-pf-text-secondary", children: ["Generate and manage your API keys in", ' ', _jsx(Link, { to: "/settings", className: "text-pf-cyan-400 hover:underline", children: "Settings \u2192 API Keys" }), "."] }), _jsx("h3", { className: "text-base font-semibold text-pf-text mt-4", children: "Scopes" }), _jsx("div", { className: "space-y-2", children: [
                            { scope: 'READ', desc: 'View data: markets, portfolio, strategies, orders, alerts, backtests, profiles' },
                            { scope: 'WRITE', desc: 'Modify strategies, settings, alerts, and start backtests' },
                            { scope: 'TRADE', desc: 'Place orders, start/stop/pause/resume strategies, close positions' },
                        ].map(s => {
                            const ss = SCOPE_STYLES[s.scope];
                            return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `text-[10px] px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`, children: s.scope }), _jsx("span", { className: "text-xs text-pf-text-secondary", children: s.desc })] }, s.scope));
                        }) })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Endpoints" }), CATEGORIES.map((category, catIdx) => (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-sm font-semibold text-pf-text", children: category.title }), category.endpoints.map((ep, epIdx) => {
                                const key = `${catIdx}-${epIdx}`;
                                const isOpen = openEndpoints.has(key);
                                const ms = METHOD_STYLES[ep.method];
                                const ss = SCOPE_STYLES[ep.scope];
                                return (_jsxs("div", { children: [_jsxs("button", { onClick: () => toggleEndpoint(key), className: "w-full flex items-center gap-3 px-3 py-2.5 bg-pf-elevated border border-pf-border rounded-pf hover:border-pf-border-strong transition-colors text-left", "aria-expanded": isOpen, children: [_jsx("span", { className: `text-[10px] px-2 py-0.5 rounded font-bold ${ms.bg} ${ms.text}`, children: ep.method }), _jsx("code", { className: "flex-1 text-xs font-mono text-pf-text", children: ep.path }), _jsx("span", { className: `text-[10px] px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`, children: ep.scope }), isOpen ? _jsx(ChevronUp, { className: "size-3 text-pf-text-muted" }) : _jsx(ChevronDown, { className: "size-3 text-pf-text-muted" })] }), isOpen && (_jsxs("div", { className: "px-3 pb-3 border border-t-0 border-pf-border rounded-b-pf-lg -mt-px bg-pf-elevated", children: [_jsx("p", { className: "text-xs text-pf-text-secondary mt-3 mb-2", children: ep.description }), ep.queryParams && (_jsxs("p", { className: "text-[11px] text-pf-text-muted mb-2", children: ["Query params: ", _jsx("code", { className: "font-mono", children: ep.queryParams })] })), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap", children: ep.curl })] }))] }, key));
                            })] }, category.title)))] }), _jsxs("section", { className: "space-y-3", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Rate Limits" }), _jsxs("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: ["Each API key is limited to ", _jsx("strong", { className: "text-pf-text", children: "120 requests per minute" }), ". If you exceed the limit, the API responds with status", ' ', _jsx("code", { className: "bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono", children: "429 Too Many Requests" }), "."] }), _jsxs("p", { className: "text-sm text-pf-text-secondary leading-relaxed", children: ["The response includes a", ' ', _jsx("code", { className: "bg-pf-overlay px-1.5 py-0.5 rounded text-xs font-mono", children: "Retry-After" }), ' ', "header indicating how many seconds to wait before retrying."] })] }), _jsxs("section", { className: "space-y-3", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Error Codes" }), _jsx("p", { className: "text-sm text-pf-text-secondary leading-relaxed mb-3", children: "All errors follow a standard shape:" }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-xs font-mono text-pf-text overflow-x-auto", children: ERROR_SHAPE }), _jsx("div", { className: "overflow-x-auto mt-4", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-pf-border", children: [_jsx("th", { className: "text-left py-2 px-3 text-xs text-pf-text-secondary font-semibold", children: "Code" }), _jsx("th", { className: "text-left py-2 px-3 text-xs text-pf-text-secondary font-semibold", children: "Meaning" })] }) }), _jsx("tbody", { children: ERROR_CODES.map(err => (_jsxs("tr", { className: "border-b border-pf-border-subtle", children: [_jsx("td", { className: "py-2 px-3 font-mono text-pf-text", children: err.code }), _jsx("td", { className: "py-2 px-3 text-pf-text-secondary", children: err.meaning })] }, err.code))) })] }) })] }), _jsxs("section", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Code Examples" }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-pf-text mb-2", children: "1. List your strategies" }), _jsx("p", { className: "text-[11px] text-pf-text-muted mb-1", children: "curl" }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap mb-3", children: `curl -X GET https://api.polyforge.app/api/v1/strategies \\
  -H "Authorization: Bearer pf_live_abc123..."` }), _jsx("p", { className: "text-[11px] text-pf-text-muted mb-1", children: "JavaScript (fetch)" }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap", children: `const res = await fetch('https://api.polyforge.app/api/v1/strategies', {
  headers: { 'Authorization': 'Bearer pf_live_abc123...' }
});
const strategies = await res.json();` })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-pf-text mb-2", children: "2. Start a strategy" }), _jsx("p", { className: "text-[11px] text-pf-text-muted mb-1", children: "curl" }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap", children: `curl -X POST https://api.polyforge.app/api/v1/strategies/strat_123/start \\
  -H "Authorization: Bearer pf_live_abc123..."` })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-pf-text mb-2", children: "3. Get portfolio P&L" }), _jsx("p", { className: "text-[11px] text-pf-text-muted mb-1", children: "curl" }), _jsx("pre", { className: "bg-pf-surface border border-pf-border rounded-pf p-3 text-[11px] font-mono text-pf-text overflow-x-auto whitespace-pre-wrap", children: `curl -X GET https://api.polyforge.app/api/v1/portfolio/pnl \\
  -H "Authorization: Bearer pf_live_abc123..."` })] })] })] }));
}
