import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, LifeBuoy, ChevronDown, ChevronUp, } from 'lucide-react';
import { toast } from 'sonner';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
    OPEN: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    AWAITING_USER: { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    AWAITING_ADMIN: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
    CLOSED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};
const PRIORITY_STYLES = {
    LOW: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
    MEDIUM: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
    HIGH: { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    URGENT: { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const FAQ_ITEMS = [
    { q: 'How do I connect my Polymarket account?', a: 'Go to Settings > Trading Account and enter your Polymarket API credentials. Your credentials are encrypted at rest.' },
    { q: 'Why is my strategy not placing orders?', a: 'Ensure your Polymarket account is connected, the strategy is in "Running" state, and your strategy logic has valid buy/sell conditions for the current market conditions.' },
    { q: 'How does paper trading work?', a: 'Paper trading simulates orders without real money. Enable it in your strategy settings. Paper positions and P&L are tracked separately from live trading.' },
    { q: 'What are API key scopes?', a: 'READ allows viewing data, WRITE allows modifying strategies and settings, TRADE allows placing orders and controlling strategy execution.' },
    { q: 'How do backtests work?', a: 'Select a strategy and date range, then click Run Backtest. The system replays historical price data through your strategy logic and reports simulated results.' },
    { q: 'How do I reset my paper trading account?', a: 'Go to Portfolio > Paper tab and click "Reset Paper Account". This deletes all paper positions and orders permanently.' },
];
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openFaq, setOpenFaq] = useState(null);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/tickets', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data.data);
                }
            }
            catch {
                toast.error('Failed to load tickets');
            }
            setLoading(false);
        })();
    }, []);
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Support" }), _jsxs(Link, { to: "/support/new", className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(Plus, { className: "size-4" }), "New Ticket"] })] }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Subject" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Priority" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Category" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Created" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Last Reply" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: loading ? (Array.from({ length: 4 }, (_, i) => (_jsx("tr", { children: Array.from({ length: 6 }, (_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-3 bg-pf-overlay rounded animate-pulse" }) }, j))) }, i)))) : tickets.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(LifeBuoy, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No support tickets" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Create a ticket if you need help." })] }) }) })) : (tickets.map(ticket => {
                                    const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.OPEN;
                                    const ps = PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.LOW;
                                    const lastMsg = ticket.messages[ticket.messages.length - 1];
                                    return (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsx(Link, { to: `/support/${ticket.id}`, className: "text-pf-text hover:text-pf-cyan-400 transition-colors font-medium", children: ticket.subject }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`, children: ticket.status.replace(/_/g, ' ') }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ps.bg} ${ps.text}`, children: ticket.priority }) }), _jsx("td", { className: "px-4 py-3 text-pf-text-secondary text-xs", children: ticket.category }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-[11px] text-pf-text-muted", children: formatDate(ticket.createdAt) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-[11px] text-pf-text-muted", children: lastMsg ? formatDate(lastMsg.createdAt) : '\u2014' })] }, ticket.id));
                                })) })] }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text mb-4", children: "Frequently Asked Questions" }), _jsx("div", { className: "space-y-2", children: FAQ_ITEMS.map((item, idx) => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: [_jsxs("button", { onClick: () => setOpenFaq(openFaq === idx ? null : idx), className: "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-pf-surface/50 transition-colors", "aria-expanded": openFaq === idx, children: [_jsx("span", { className: "text-sm font-medium text-pf-text", children: item.q }), openFaq === idx ? (_jsx(ChevronUp, { size: 20, className: "text-pf-text-muted shrink-0" })) : (_jsx(ChevronDown, { size: 20, className: "text-pf-text-muted shrink-0" }))] }), openFaq === idx && (_jsx("div", { className: "px-4 pb-3 text-sm text-pf-text-secondary leading-relaxed border-l-2 border-pf-cyan-500/40 ml-4 mr-4", children: item.a }))] }, idx))) })] })] }));
}
