import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Plus, LifeBuoy, ChevronDown, ChevronUp,
} from 'lucide-react';

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
  OPEN:           { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  AWAITING_USER:  { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  AWAITING_ADMIN: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  CLOSED:         { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};

const PRIORITY_STYLES: Record<TicketPriority, { text: string; bg: string }> = {
  LOW:    { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
  MEDIUM: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  HIGH:   { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  URGENT: { text: 'text-red-400', bg: 'bg-red-500/10' },
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
      } catch { /* keep state */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Support</h1>
        <Link
          to="/support/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-white text-sm font-medium hover:bg-pf-cyan-600 transition-colors"
        >
          <Plus className="size-4" />
          New Ticket
        </Link>
      </div>

      {/* Tickets table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-muted uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Created</th>
                <th className="px-4 py-3 font-medium text-right">Last Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <LifeBuoy className="size-10 text-pf-text-muted mb-3" />
                      <p className="text-sm font-medium text-pf-text">No support tickets</p>
                      <p className="text-xs text-pf-text-muted mt-1">Create a ticket if you need help.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => {
                  const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.OPEN;
                  const ps = PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.LOW;
                  const lastMsg = ticket.messages[ticket.messages.length - 1];
                  return (
                    <tr key={ticket.id} className="hover:bg-pf-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/support/${ticket.id}`} className="text-pf-text hover:text-pf-cyan-400 transition-colors font-medium">
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ps.bg} ${ps.text}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-pf-text-secondary text-xs">{ticket.category}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-pf-text-muted">{formatDate(ticket.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-pf-text-muted">
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
      <div>
        <h2 className="text-lg font-semibold text-pf-text mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-pf-text">{item.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="size-4 text-pf-text-muted shrink-0" />
                ) : (
                  <ChevronDown className="size-4 text-pf-text-muted shrink-0" />
                )}
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-3 text-sm text-pf-text-secondary leading-relaxed">
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
