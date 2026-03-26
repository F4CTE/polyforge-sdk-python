import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime, timeAgo, priorityColor } from '@/lib/utils';
export function Component() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [statusValue, setStatusValue] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [admins, setAdmins] = useState([]);
    useEffect(() => {
        if (!id)
            return;
        async function load() {
            try {
                const [ticketRes, adminsRes] = await Promise.all([
                    adminApi.ticket(id),
                    adminApi.listAdmins().catch(() => []),
                ]);
                setTicket(ticketRes);
                setStatusValue(ticketRes.status);
                setAssignedTo(ticketRes.assignedTo ?? '');
                setAdmins(adminsRes);
            }
            catch {
                toast.error('Failed to load ticket');
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);
    async function handleReply(e) {
        e.preventDefault();
        if (!id || !reply.trim())
            return;
        setSending(true);
        try {
            const res = await adminApi.replyTicket(id, reply);
            setTicket((t) => ({
                ...t,
                messages: [...(t.messages ?? []), res],
            }));
            setReply('');
            toast.success('Reply sent');
        }
        catch {
            toast.error('Failed to send reply');
        }
        finally {
            setSending(false);
        }
    }
    async function handleStatusChange(newStatus) {
        if (!id)
            return;
        try {
            await adminApi.updateTicket(id, { status: newStatus });
            setStatusValue(newStatus);
            setTicket((t) => ({ ...t, status: newStatus }));
            toast.success(`Status updated to ${newStatus}`);
        }
        catch {
            toast.error('Failed to update status');
        }
    }
    async function handleAssign(adminId) {
        if (!id)
            return;
        try {
            await adminApi.updateTicket(id, { assignedTo: adminId });
            setAssignedTo(adminId);
            toast.success('Ticket assigned');
        }
        catch {
            toast.error('Failed to assign ticket');
        }
    }
    if (loading) {
        return (_jsxs("div", { className: "animate-pulse space-y-6", children: [_jsx("div", { className: "h-4 bg-[var(--color-pf-elevated)] rounded w-32" }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 space-y-4", children: [_jsx("div", { className: "h-5 bg-[var(--color-pf-bg)] rounded w-64" }), _jsx("div", { className: "h-4 bg-[var(--color-pf-bg)] rounded w-48" }), _jsx("div", { className: "h-4 bg-[var(--color-pf-bg)] rounded w-32" })] }), _jsx("div", { className: "h-32 bg-[var(--color-pf-elevated)] rounded-pf-lg animate-pulse" })] }));
    }
    if (!ticket) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("p", { className: "text-[var(--color-pf-text-secondary)]", children: "Ticket not found" }), _jsx("button", { onClick: () => navigate('/tickets'), className: "mt-4 text-sm text-[var(--color-pf-cyan-500)] hover:underline", children: "Back to tickets" })] }));
    }
    const messages = ticket.messages ?? [];
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("button", { onClick: () => navigate('/tickets'), className: "flex items-center gap-1.5 text-sm text-[var(--color-pf-text-secondary)] hover:text-[var(--color-pf-text)] transition-colors", children: [_jsx(ArrowLeft, { size: 16 }), "Back to tickets"] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ticket.subject }), _jsxs("p", { className: "text-sm text-[var(--color-pf-text-tertiary)] mt-0.5", children: [ticket.username ?? ticket.userId, " - ", formatDateTime(ticket.createdAt)] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(ticket.status)}`, children: ticket.status }), _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[ticket.priority] ?? ''}`, children: ticket.priority }), ticket.category && (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] border border-[var(--color-pf-border)]", children: ticket.category }))] })] }), _jsxs("div", { className: "flex flex-wrap gap-4 pt-4 border-t border-[var(--color-pf-border)]", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Status" }), _jsxs("select", { value: statusValue, onChange: (e) => handleStatusChange(e.target.value), className: "px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "OPEN", children: "Open" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "RESOLVED", children: "Resolved" }), _jsx("option", { value: "CLOSED", children: "Closed" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Assign To" }), _jsxs("select", { value: assignedTo, onChange: (e) => handleAssign(e.target.value), className: "px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "", children: "Unassigned" }), admins.map((a) => (_jsx("option", { value: a.id, children: a.displayName }, a.id)))] })] })] })] }), _jsx("div", { className: "space-y-3", children: messages.map((msg, i) => {
                    const isAdmin = msg.senderType === 'admin' || msg.adminId;
                    return (_jsxs("div", { className: `p-4 rounded-pf-lg border ${isAdmin
                            ? 'bg-[var(--color-pf-cyan-500)]/5 border-[var(--color-pf-cyan-500)]/20 ml-8'
                            : 'bg-[var(--color-pf-elevated)] border-[var(--color-pf-border)] mr-8'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-medium text-[var(--color-pf-text-secondary)]", children: isAdmin ? (msg.senderName ?? 'Admin') : (ticket.username ?? 'User') }), _jsx("span", { className: "text-[11px] text-[var(--color-pf-text-tertiary)]", children: msg.createdAt ? timeAgo(msg.createdAt) : '' })] }), _jsx("p", { className: "text-sm text-[var(--color-pf-text)] whitespace-pre-wrap", children: msg.body })] }, msg.id ?? i));
                }) }), _jsxs("form", { onSubmit: handleReply, className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsx("textarea", { value: reply, onChange: (e) => setReply(e.target.value), placeholder: "Type your reply...", rows: 4, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] mb-3 resize-y" }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { type: "submit", disabled: sending || !reply.trim(), className: "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: [_jsx(Send, { size: 14 }), sending ? 'Sending...' : 'Reply'] }) })] })] }));
}
