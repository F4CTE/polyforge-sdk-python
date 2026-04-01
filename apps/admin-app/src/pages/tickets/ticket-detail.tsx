import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Select, Textarea } from '@polyforge/ui';
import { ArrowLeft, Send } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime, timeAgo, priorityColor } from '@/lib/utils';

interface TicketMessage {
  id?: string;
  body: string;
  senderType?: string;
  adminId?: string;
  senderName?: string;
  createdAt?: string;
}

interface TicketView {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category?: string;
  username?: string;
  userId?: string;
  assignedTo?: string | null;
  createdAt: string;
  messages: TicketMessage[];
  [key: string]: unknown;
}

interface AdminOption {
  id: string;
  displayName: string;
  [key: string]: unknown;
}

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [admins, setAdmins] = useState<AdminOption[]>([]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [ticketRes, adminsRes] = await Promise.all([
          adminApi.ticket(id!),
          adminApi.listAdmins().catch(() => []),
        ]);
        const ticketData = ticketRes as unknown as TicketView;
        setTicket(ticketData);
        setStatusValue(ticketData.status);
        setAssignedTo(ticketData.assignedTo ?? '');
        setAdmins((adminsRes ?? []) as unknown as AdminOption[]);
      } catch {
        toast.error('Failed to load ticket');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!id || !reply.trim()) return;
    setSending(true);
    try {
      const res = await adminApi.replyTicket(id, reply);
      setTicket((t) => t ? ({
        ...t,
        messages: [...(t.messages ?? []), res as unknown as TicketMessage],
      }) : t);
      setReply('');
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    try {
      await adminApi.updateTicket(id, { status: newStatus });
      setStatusValue(newStatus);
      setTicket((t) => t ? { ...t, status: newStatus } : t);
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleAssign(adminId: string) {
    if (!id) return;
    try {
      await adminApi.updateTicket(id, { assignedTo: adminId });
      setAssignedTo(adminId);
      toast.success('Ticket assigned');
    } catch {
      toast.error('Failed to assign ticket');
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" role="status" aria-label="Loading ticket details">
        <div className="h-4 bg-pf-elevated rounded w-32" />
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
          <div className="h-5 bg-pf-base rounded w-64" />
          <div className="h-4 bg-pf-base rounded w-48" />
          <div className="h-4 bg-pf-base rounded w-32" />
        </div>
        <div className="h-32 bg-pf-elevated rounded-pf-lg animate-pulse" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-pf-text-secondary">Ticket not found</p>
        <Button type="button"
          variant="ghost"
          onClick={() => navigate('/tickets')}
          className="mt-4 text-sm text-pf-cyan-500 hover:underline rounded"
        >
          Back to tickets
        </Button>
      </div>
    );
  }

  const messages: TicketMessage[] = ticket.messages ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back */}
      <Button type="button" variant="ghost"
        onClick={() => navigate('/tickets')}
        className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to tickets
      </Button>

      {/* Header */}
      <header className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-pf-text">
              {ticket.subject}
            </h2>
            <p className="text-sm text-pf-text-tertiary mt-0.5">
              {ticket.username ?? ticket.userId} - {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(ticket.status)}`}>
              {ticket.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[ticket.priority] ?? ''}`}>
              {ticket.priority}
            </span>
            {ticket.category && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pf-base text-pf-text-secondary border border-pf-border">
                {ticket.category}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-pf-border">
          <div>
            <label htmlFor="ticket-status" className="block text-xs text-pf-text-tertiary mb-1">Status</label>
            <Select
              id="ticket-status"
              value={statusValue}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
          <div>
            <label htmlFor="ticket-assign" className="block text-xs text-pf-text-tertiary mb-1">Assign To</label>
            <Select
              id="ticket-assign"
              value={assignedTo}
              onChange={(e) => handleAssign(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500"
            >
              <option value="">Unassigned</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>

      {/* Messages Thread */}
      <section aria-label="Ticket messages" className="space-y-3">
        {messages.map((msg, i) => {
          const isAdmin = msg.senderType === 'admin' || !!msg.adminId;
          return (
            <div
              key={msg.id ?? i}
              className={`p-4 rounded-pf-lg border ${
                isAdmin
                  ? 'bg-pf-cyan-500/5 border-pf-cyan-500/20 ml-8'
                  : 'bg-pf-elevated border-pf-border mr-8'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-pf-text-secondary">
                  {isAdmin ? (msg.senderName ?? 'Admin') : (ticket.username ?? 'User')}
                </span>
                <span className="text-[11px] text-pf-text-tertiary">
                  {msg.createdAt ? timeAgo(msg.createdAt) : ''}
                </span>
              </div>
              <p className="text-sm text-pf-text whitespace-pre-wrap">{msg.body}</p>
            </div>
          );
        })}
      </section>

      {/* Reply */}
      <form
        onSubmit={handleReply}
        noValidate
        className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4"
      >
        <label htmlFor="ticket-reply" className="sr-only">Reply message</label>
        <Textarea
          id="ticket-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type your reply..."
          rows={4}
          disabled={sending}
          className="w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text placeholder:text-pf-text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pf-cyan-500 mb-3 resize-y disabled:opacity-50"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="default"
            disabled={sending || !reply.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} aria-hidden="true" />
            {sending ? 'Sending...' : 'Reply'}
          </Button>
        </div>
      </form>
    </div>
  );
}
