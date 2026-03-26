import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Send, Loader2, Lock, RefreshCw, } from 'lucide-react';
import { toast } from 'sonner';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
    OPEN: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    AWAITING_USER: { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    AWAITING_ADMIN: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
    CLOSED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};
const MAX_CHARS = 5000;
const WARN_THRESHOLD = 4500;
function formatDateTime(d) {
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { id } = useParams();
    const navigate = useNavigate();
    const bottomRef = useRef(null);
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState(false);
    const loadTicket = useCallback(async () => {
        try {
            const res = await fetch(`/api/v1/tickets/${id}`, { credentials: 'include' });
            if (res.ok)
                setTicket(await res.json());
        }
        catch {
            toast.error('Failed to load ticket');
        }
        setLoading(false);
    }, [id]);
    // Initial load
    useEffect(() => { loadTicket(); }, [loadTicket]);
    // Auto-poll every 15 seconds
    useEffect(() => {
        const interval = setInterval(loadTicket, 15000);
        return () => clearInterval(interval);
    }, [loadTicket]);
    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.messages.length]);
    async function sendReply() {
        if (!reply.trim() || sending || !ticket)
            return;
        setSending(true);
        try {
            const res = await fetch(`/api/v1/tickets/${id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ body: reply.trim() }),
            });
            if (res.ok) {
                setReply('');
                loadTicket();
            }
        }
        catch {
            toast.error('Failed to send reply');
        }
        setSending(false);
    }
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    async function closeTicket() {
        if (closing || !ticket)
            return;
        setShowCloseConfirm(false);
        setClosing(true);
        try {
            const res = await fetch(`/api/v1/tickets/${id}/close`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok)
                loadTicket();
        }
        catch {
            toast.error('Failed to close ticket');
        }
        setClosing(false);
    }
    const charCount = reply.length;
    const isOverWarn = charCount >= WARN_THRESHOLD;
    const canClose = ticket && ticket.status !== 'CLOSED';
    if (loading) {
        return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto space-y-4", children: [_jsx("div", { className: "h-6 w-48 bg-pf-overlay rounded animate-pulse" }), _jsx("div", { className: "h-40 bg-pf-overlay rounded-pf-lg animate-pulse" }), _jsx("div", { className: "h-20 bg-pf-overlay rounded-pf-lg animate-pulse" })] }));
    }
    if (!ticket) {
        return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto text-center py-20", children: [_jsx("p", { className: "text-pf-text font-medium", children: "Ticket not found" }), _jsx("button", { onClick: () => navigate('/support'), className: "text-sm text-pf-cyan-400 mt-2", children: "Back to support" })] }));
    }
    const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.OPEN;
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-3xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate('/support'), className: "p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: ticket.subject }), _jsxs("div", { className: "flex items-center gap-3 mt-1 text-xs text-pf-text-muted", children: [_jsx("span", { className: `inline-flex px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`, children: ticket.status.replace(/_/g, ' ') }), _jsx("span", { children: ticket.priority }), _jsx("span", { children: ticket.category }), _jsxs("span", { children: ["Created ", formatDateTime(ticket.createdAt)] })] })] })] }), canClose && (showCloseConfirm ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: "Close this ticket?" }), _jsx("button", { onClick: closeTicket, disabled: closing, className: "px-2 py-1 text-xs rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors", children: closing ? 'Closing...' : 'Confirm' }), _jsx("button", { onClick: () => setShowCloseConfirm(false), className: "px-2 py-1 text-xs rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-surface transition-colors", children: "Cancel" })] })) : (_jsxs("button", { onClick: () => setShowCloseConfirm(true), disabled: closing, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs text-pf-text-muted border border-pf-border hover:border-pf-border-strong hover:text-pf-text transition-colors", children: [closing ? _jsx(Loader2, { className: "size-3 animate-spin" }) : _jsx(Lock, { className: "size-3" }), "Close Ticket"] })))] }), _jsxs("div", { className: "space-y-4", children: [ticket.messages.map(msg => (_jsx("div", { className: `flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`, children: _jsxs("div", { className: `max-w-[80%] rounded-pf-lg p-4 ${msg.isAdmin
                                ? 'bg-pf-cyan-500/10 border border-cyan-500/20'
                                : 'bg-pf-elevated border border-pf-border'}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `text-xs font-medium ${msg.isAdmin ? 'text-pf-cyan-400' : 'text-pf-text'}`, children: msg.senderName }), msg.isAdmin && (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-pf-cyan-400 font-medium", children: "Staff" })), _jsx("span", { className: "text-[11px] text-pf-text-muted ml-auto font-mono", children: formatDateTime(msg.createdAt) })] }), _jsx("p", { className: "text-sm text-pf-text-secondary whitespace-pre-wrap leading-relaxed", children: msg.body })] }) }, msg.id))), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "flex items-center gap-1.5 text-[11px] text-pf-text-muted", children: [_jsx(RefreshCw, { className: "size-3" }), "Auto-updating every 15s"] }), ticket.status !== 'CLOSED' ? (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("textarea", { value: reply, onChange: e => setReply(e.target.value.slice(0, MAX_CHARS)), placeholder: "Write a reply...", rows: 4, className: "w-full px-3 py-2.5 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors resize-y" }), _jsxs("div", { className: "flex items-center justify-between mt-3", children: [_jsxs("span", { className: `text-xs font-mono ${isOverWarn ? 'text-pf-danger' : 'text-pf-text-muted'}`, children: [charCount, " / ", MAX_CHARS] }), _jsxs("button", { onClick: sendReply, disabled: !reply.trim() || sending, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: [sending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Send, { className: "size-4" }), "Send Reply"] })] })] })) : (_jsx("div", { className: "text-center py-4 text-sm text-pf-text-muted bg-pf-elevated border border-pf-border rounded-pf-lg", children: "This ticket has been closed." }))] }));
}
