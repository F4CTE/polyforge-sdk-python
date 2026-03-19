import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { TicketsApiService, TicketSummary, TicketStatus } from '../../core/services/tickets-api.service';

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
          <div class="pf-empty-state" style="padding:64px">
            <i class="pi pi-question-circle pf-empty-icon"></i>
            <p class="pf-empty-title">No tickets yet</p>
            <p class="pf-empty-desc">Need help? Create a support ticket and our team will get back to you.</p>
            <p-button label="Create Ticket" icon="pi pi-plus" routerLink="/support/new" styleClass="mt-3" />
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

    </div>
  `,
  styles: [`
    .ticket-row {
      display: block;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pf-border);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s;
      &:hover { background: var(--pf-surface-hover); }
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
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .ticket-row-bottom {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: var(--pf-text-muted);
    }
    .ticket-category {
      font-family: var(--pf-font-mono);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.04em;
    }
    .ticket-preview {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 400px;
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
