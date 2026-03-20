import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { TicketsApiService, TicketSummary, TicketStatus } from '../../core/services/tickets-api.service';

interface FaqItem {
  question: string;
  answer: string;
  expanded: boolean;
}

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [DatePipe, SlicePipe, RouterLink, ButtonModule, SkeletonModule],
  template: `
    <div class="pf-page">

      <div class="page-header">
        <h1>Support</h1>
        <p-button label="New Ticket" icon="pi pi-plus" routerLink="/support/new" size="small" />
      </div>

      <div class="portfolio-table-panel">
        @if (loading()) {
          @for (s of skeletons; track $index) {
            <div style="padding:16px 20px;border-bottom:1px solid var(--pf-border)">
              <p-skeleton height="14px" width="60%" />
              <p-skeleton height="12px" width="30%" styleClass="mt-2" />
            </div>
          }
        } @else if (tickets().length === 0) {
          <div class="empty-state">
            <i class="pi pi-question-circle empty-state-icon"></i>
            <p class="empty-state-title">No tickets yet</p>
            <p class="empty-state-desc">Need help? Create a support ticket and our team will get back to you.</p>
            <p class="empty-state-desc" style="font-size:12px">Our team typically responds within 24 hours.</p>
            <div class="empty-state-action">
              <p-button label="Create Ticket" icon="pi pi-plus" routerLink="/support/new" />
            </div>
          </div>
        } @else {
          @for (ticket of tickets(); track ticket.id) {
            <a [routerLink]="['/support', ticket.id]" class="ticket-row">
              <div class="ticket-row-top">
                <span class="ticket-subject">{{ ticket.subject }}</span>
                <span class="ticket-status-badge"
                      [style.color]="statusColor(ticket.status)"
                      [style.background]="statusBg(ticket.status)">
                  {{ statusLabel(ticket.status) }}
                </span>
              </div>
              <div class="ticket-row-bottom">
                <span class="ticket-category">{{ ticket.category }}</span>
                <span class="ticket-date">{{ ticket.updatedAt | date:'MMM d, HH:mm' }}</span>
                @if (ticket.messages.length) {
                  <span class="ticket-preview">
                    {{ ticket.messages[0].isAdmin ? ticket.messages[0].senderName : 'You' }}: {{ ticket.messages[0].body | slice:0:80 }}
                  </span>
                }
              </div>
            </a>
          }
        }
      </div>

      @if (totalPages() > 1) {
        <div class="markets-pagination">
          <p-button icon="pi pi-chevron-left" severity="secondary" [text]="true" size="small"
                    [disabled]="page() === 1" (onClick)="prevPage()" />
          <span class="pf-mono" style="font-size:13px;color:var(--pf-text-secondary)">
            {{ page() }} / {{ totalPages() }}
          </span>
          <p-button icon="pi pi-chevron-right" severity="secondary" [text]="true" size="small"
                    [disabled]="page() === totalPages()" (onClick)="nextPage()" />
        </div>
      }

      <!-- ─── FAQ Section ──────────────────────────────────────────────── -->
      <div class="faq-section">
        <h2 class="faq-heading">Frequently Asked Questions</h2>

        @for (faq of faqs; track faq.question) {
          <div class="faq-item" [class.expanded]="faq.expanded">
            <button class="faq-question" (click)="faq.expanded = !faq.expanded">
              <span>{{ faq.question }}</span>
              <i class="pi" [class.pi-chevron-down]="!faq.expanded" [class.pi-chevron-up]="faq.expanded"></i>
            </button>
            @if (faq.expanded) {
              <div class="faq-answer">
                {{ faq.answer }}
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .ticket-row {
      display: block;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pf-border-subtle);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s;
      &:hover { background: var(--pf-bg-overlay); }
    }
    .ticket-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .ticket-subject {
      font-weight: 600;
      font-size: 14px;
      color: var(--pf-text-primary);
    }
    .ticket-status-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 999px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .ticket-row-bottom {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: var(--pf-text-muted);
    }
    .ticket-category {
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
      color: var(--pf-text-secondary);
      background: var(--pf-bg-elevated);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .ticket-date {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }
    .ticket-preview {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 400px;
      color: var(--pf-text-secondary);
    }

    /* FAQ styles */
    .faq-section {
      margin-top: 40px;
    }
    .faq-heading {
      font-size: 18px;
      font-weight: 600;
      color: var(--pf-text-primary);
      margin: 0 0 16px;
    }
    .faq-item {
      background: var(--pf-bg-surface);
      border: 1px solid var(--pf-border-subtle);
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
      transition: border-color 0.15s ease;

      &.expanded {
        border-color: rgba(6, 182, 212, 0.2);
      }
    }
    .faq-question {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 14px 16px;
      background: transparent;
      border: none;
      color: var(--pf-text-primary);
      font-size: 14px;
      font-weight: 500;
      font-family: 'Outfit', sans-serif;
      cursor: pointer;
      text-align: left;
      transition: color 0.15s;

      &:hover { color: var(--pf-cyan-400); }

      i {
        font-size: 12px;
        color: var(--pf-text-muted);
        flex-shrink: 0;
        transition: transform 0.2s ease;
      }
    }
    .faq-answer {
      padding: 0 16px 14px;
      font-size: 13px;
      color: var(--pf-text-secondary);
      line-height: 1.6;
      border-top: 1px solid var(--pf-border-subtle);
      padding-top: 12px;
      margin-top: 0;
      animation: faq-expand 0.15s ease-out;
    }
    @keyframes faq-expand {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class TicketListComponent implements OnInit {
  private readonly api = inject(TicketsApiService);
  private readonly destroyRef = inject(DestroyRef);

  tickets    = signal<TicketSummary[]>([]);
  loading    = signal(true);
  page       = signal(1);
  totalPages = signal(0);

  readonly skeletons = Array(5);

  readonly faqs: FaqItem[] = [
    {
      question: 'How do I create a trading strategy?',
      answer: 'Navigate to the Strategies page and click "New Strategy". Use the visual block builder to add triggers, conditions, actions, and safety rules. You can configure each block with parameters specific to your trading approach, then save and test your strategy before going live.',
      expanded: false,
    },
    {
      question: 'What is paper trading?',
      answer: 'Paper trading lets you run your strategies with simulated funds instead of real money. It uses live market data but executes virtual trades, allowing you to validate your strategy logic and performance without any financial risk. Look for the "Paper" mode when starting a strategy.',
      expanded: false,
    },
    {
      question: 'How do backtests work?',
      answer: 'Backtests replay historical market data against your strategy to evaluate how it would have performed in the past. Go to the Backtest page, select a strategy and a time range, then run the simulation. Results include P&L curves, trade logs, and key performance metrics.',
      expanded: false,
    },
    {
      question: 'How do I connect my Polymarket account?',
      answer: 'Go to Settings and find the "Polymarket Integration" section. You will need to provide your API key credentials. Once connected, your strategies can execute real trades on Polymarket. We recommend starting with paper trading before switching to live mode.',
      expanded: false,
    },
    {
      question: 'What happens when a market resolves?',
      answer: 'When a market resolves, all open positions are settled automatically. If the outcome matches your position (YES or NO), you receive the payout. Any running strategies on that market will be stopped automatically. You can view resolved positions in your Portfolio page.',
      expanded: false,
    },
    {
      question: 'How do I contact support?',
      answer: 'You can create a support ticket by clicking the "New Ticket" button at the top of this page. Select a category that best describes your issue, provide a detailed description, and our team will respond within 24 hours. For urgent issues, mark the ticket priority as "High".',
      expanded: false,
    },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list({ page: this.page(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  res => { this.tickets.set(res.data); this.totalPages.set(res.totalPages); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  statusLabel(s: TicketStatus): string {
    const m: Record<TicketStatus, string> = {
      OPEN: 'Open', AWAITING_USER: 'Awaiting Reply', AWAITING_ADMIN: 'In Progress', CLOSED: 'Closed',
    };
    return m[s] ?? s;
  }

  statusColor(s: TicketStatus): string {
    const m: Record<TicketStatus, string> = {
      OPEN: 'var(--pf-cyan-500)', AWAITING_USER: 'var(--pf-warning)', AWAITING_ADMIN: 'var(--pf-cyan-400)', CLOSED: 'var(--pf-text-muted)',
    };
    return m[s] ?? 'var(--pf-text-muted)';
  }

  statusBg(s: TicketStatus): string {
    const m: Record<TicketStatus, string> = {
      OPEN: 'rgba(6,182,212,0.1)', AWAITING_USER: 'rgba(245,158,11,0.1)', AWAITING_ADMIN: 'rgba(6,182,212,0.08)', CLOSED: 'rgba(122,148,180,0.08)',
    };
    return m[s] ?? 'transparent';
  }
}
