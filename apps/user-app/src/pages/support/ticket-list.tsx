import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Plus, LifeBuoy, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  messages: { body: string; isAdmin: boolean; senderName: string; createdAt: string }[];
}

interface TicketsResponse {
  data: TicketSummary[];
  total: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<TicketStatus, { text: string; bg: string }> = {
  OPEN:           { text: 'text-accent-text', bg: 'bg-accent/10' },
  AWAITING_USER:  { text: 'text-warning', bg: 'bg-warning/10' },
  AWAITING_ADMIN: { text: 'text-info', bg: 'bg-info/10' },
  CLOSED:         { text: 'text-secondary', bg: 'bg-overlay' },
};

const PRIORITY_STYLES: Record<TicketPriority, { text: string; bg: string }> = {
  LOW:    { text: 'text-tertiary', bg: 'bg-overlay' },
  MEDIUM: { text: 'text-info', bg: 'bg-info/10' },
  HIGH:   { text: 'text-warning', bg: 'bg-warning/10' },
  URGENT: { text: 'text-loss', bg: 'bg-loss/10' },
};

function formatDate(d: string): string {
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
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/tickets', { credentials: 'include' });
        if (res.ok) {
          const data: TicketsResponse = await res.json();
          setTickets(data.data);
        }
      } catch { toast.error('Failed to load tickets'); }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Support</h1>
        <Link
          to="/support/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pf bg-accent text-inverse text-sm font-medium hover:bg-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
        >
          <Plus className="size-4" />
          New Ticket
        </Link>
      </div>

      {/* Tickets table */}
      <div data-testid="ticket-list" className="bg-elevated border border-default rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Support tickets">
            <thead>
              <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Priority</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Created</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Last Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div data-testid="empty-state" className="flex flex-col items-center justify-center py-16 text-center">
                      <LifeBuoy className="size-10 text-tertiary mb-3" />
                      <p className="text-sm font-medium text-primary">No support tickets</p>
                      <p className="text-xs text-tertiary mt-1">Create a ticket if you need help.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => {
                  const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.OPEN;
                  const ps = PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.LOW;
                  const lastMsg = ticket.messages[ticket.messages.length - 1];
                  return (
                    <tr key={ticket.id} data-testid="ticket-row" className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/support/${ticket.id}`} data-testid="ticket-subject" className="text-primary hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors font-medium">
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span data-testid="status-badge" className={`inline-flex px-2 py-1 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span data-testid="priority-badge" className={`inline-flex px-2 py-1 rounded text-xs font-medium ${ps.bg} ${ps.text}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary text-xs">{ticket.category}</td>
                      <td className="px-4 py-3 text-right font-mono text-label text-tertiary">{formatDate(ticket.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-mono text-label text-tertiary">
                        {lastMsg ? formatDate(lastMsg.createdAt) : '\u2014'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div data-testid="faq-section">
        <h2 className="text-lg font-semibold text-primary mb-4">Frequently Asked Questions</h2>
        <div data-testid="faq-accordion" className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} data-testid="faq-item" className="bg-elevated border border-default rounded-xl overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                id={`faq-btn-${idx}`}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-surface/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 transition-colors"
                aria-expanded={openFaq === idx}
                aria-controls={`faq-panel-${idx}`}
              >
                <span className="text-sm font-medium text-primary">{item.q}</span>
                {openFaq === idx ? (
                  <ChevronUp size={20} className="text-tertiary shrink-0" />
                ) : (
                  <ChevronDown size={20} className="text-tertiary shrink-0" />
                )}
              </Button>
              {openFaq === idx && (
                <div data-testid="faq-content" id={`faq-panel-${idx}`} role="region" aria-labelledby={`faq-btn-${idx}`} className="px-4 pb-3 text-sm text-secondary leading-relaxed border-l-2 border-accent/40 ml-4 mr-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
