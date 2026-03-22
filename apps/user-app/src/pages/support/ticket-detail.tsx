import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Send, Loader2, Lock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'CLOSED';

interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  userId: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: string;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<TicketStatus, { text: string; bg: string }> = {
  OPEN:           { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  AWAITING_USER:  { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  AWAITING_ADMIN: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  CLOSED:         { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};

const MAX_CHARS = 5000;
const WARN_THRESHOLD = 4500;

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const loadTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tickets/${id}`, { credentials: 'include' });
      if (res.ok) setTicket(await res.json());
    } catch { toast.error('Failed to load ticket'); }
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
    if (!reply.trim() || sending || !ticket) return;
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
    } catch { toast.error('Failed to send reply'); }
    setSending(false);
  }

  async function closeTicket() {
    if (closing || !ticket) return;
    if (!confirm('Close this ticket? You can still view it afterward.')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/tickets/${id}/close`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) loadTicket();
    } catch { toast.error('Failed to close ticket'); }
    setClosing(false);
  }

  const charCount = reply.length;
  const isOverWarn = charCount >= WARN_THRESHOLD;
  const canClose = ticket && ticket.status !== 'CLOSED';

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="h-6 w-48 bg-pf-overlay rounded animate-pulse" />
        <div className="h-40 bg-pf-overlay rounded-pf-lg animate-pulse" />
        <div className="h-20 bg-pf-overlay rounded-pf-lg animate-pulse" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <p className="text-pf-text font-medium">Ticket not found</p>
        <button onClick={() => navigate('/support')} className="text-sm text-pf-cyan-400 mt-2">
          Back to support
        </button>
      </div>
    );
  }

  const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.OPEN;

  return (
    <div className="animate-fade-in p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/support')}
            className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-pf-text">{ticket.subject}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-pf-text-muted">
              <span className={`inline-flex px-2 py-0.5 rounded font-medium ${ss.bg} ${ss.text}`}>
                {ticket.status.replace(/_/g, ' ')}
              </span>
              <span>{ticket.priority}</span>
              <span>{ticket.category}</span>
              <span>Created {formatDateTime(ticket.createdAt)}</span>
            </div>
          </div>
        </div>
        {canClose && (
          <button
            onClick={closeTicket}
            disabled={closing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs text-pf-text-muted border border-pf-border hover:border-pf-border-strong hover:text-pf-text transition-colors"
          >
            {closing ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
            Close Ticket
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {ticket.messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-pf-lg p-4 ${
                msg.isAdmin
                  ? 'bg-cyan-500/10 border border-cyan-500/20'
                  : 'bg-pf-elevated border border-pf-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium ${msg.isAdmin ? 'text-cyan-400' : 'text-pf-text'}`}>
                  {msg.senderName}
                </span>
                {msg.isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-medium">Staff</span>
                )}
                <span className="text-[11px] text-pf-text-muted ml-auto font-mono">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-pf-text-secondary whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Auto-polling indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-pf-text-muted">
        <RefreshCw className="size-3" />
        Auto-updating every 15s
      </div>

      {/* Reply */}
      {ticket.status !== 'CLOSED' ? (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Write a reply..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            <span className={`text-xs font-mono ${isOverWarn ? 'text-red-400' : 'text-pf-text-muted'}`}>
              {charCount} / {MAX_CHARS}
            </span>
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send Reply
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-pf-text-muted bg-pf-elevated border border-pf-border rounded-pf-lg">
          This ticket has been closed.
        </div>
      )}
    </div>
  );
}
