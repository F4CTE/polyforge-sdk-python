import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { TicketsApiService, TicketDetail, TicketStatus } from '../../core/services/tickets-api.service';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, TextareaModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="pf-page">

      @if (loading()) {
        <div class="page-header"><p-skeleton height="24px" width="40%" /></div>
        <div class="portfolio-table-panel" style="padding:24px">
          @for (s of [1,2,3]; track s) {
            <p-skeleton height="60px" styleClass="mb-3" />
          }
        </div>
      } @else if (ticket(); as t) {

        <div class="page-header">
          <div>
            <h1 style="margin-bottom:4px">{{ t.subject }}</h1>
            <div style="display:flex;gap:12px;align-items:center;font-size:12px;color:var(--pf-text-muted)">
              <span class="ticket-status-badge"
                    [style.color]="statusColor(t.status)"
                    [style.background]="statusBg(t.status)">
                {{ statusLabel(t.status) }}
              </span>
              <span>{{ t.category }}</span>
              <span>Opened {{ t.createdAt | date:'MMM d, yyyy' }}</span>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="portfolio-table-panel" style="padding:0">
          @if (t.status !== 'CLOSED') {
            <div class="poll-indicator">
              <span class="poll-dot"></span>
              Auto-updating every 15s
            </div>
          }
          @for (msg of t.messages; track msg.id) {
            <div class="ticket-message" [class.admin]="msg.isAdmin">
              <div class="msg-header">
                <span class="msg-sender">
                  @if (msg.isAdmin) {
                    <i class="pi pi-shield" style="font-size:12px;margin-right:4px;color:var(--pf-cyan-500)"></i>
                  }
                  {{ msg.senderName }}
                </span>
                <span class="msg-time">{{ msg.createdAt | date:'MMM d, HH:mm' }}</span>
              </div>
              <div class="msg-body">{{ msg.body }}</div>
            </div>
          }
        </div>

        <!-- Reply form -->
        @if (t.status !== 'CLOSED') {
          <div class="portfolio-table-panel" style="padding:20px;margin-top:16px">
            <textarea pTextarea [(ngModel)]="replyBody" rows="3" placeholder="Type your reply..."
                      style="width:100%;resize:vertical;margin-bottom:4px" maxlength="5000"></textarea>
            <span class="char-counter" [class.near-limit]="replyBody.length > 4500">{{ replyBody.length }} / 5000</span>
            <p-button label="Send Reply" icon="pi pi-send" [loading]="sending()"
                      (onClick)="sendReply()" [disabled]="!replyBody.trim()" size="small" style="margin-top:8px" />
          </div>
        } @else {
          <div class="portfolio-table-panel" style="padding:20px;margin-top:16px;text-align:center;color:var(--pf-text-muted)">
            This ticket is closed. If you need further help, please create a new ticket.
          </div>
        }

      }
    </div>
  `,
  styles: [`
    .ticket-status-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 999px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .ticket-message {
      padding: 20px 24px;
      border-bottom: 1px solid var(--pf-border-subtle);
      &.admin {
        background: rgba(6,182,212,0.04);
        border-left: 3px solid var(--pf-cyan-500);
      }
    }
    .msg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .msg-sender {
      font-weight: 600;
      font-size: 13px;
      color: var(--pf-text-primary);
      display: flex;
      align-items: center;
    }
    .msg-time {
      font-size: 11px;
      color: var(--pf-text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .msg-body {
      font-size: 14px;
      line-height: 1.7;
      color: var(--pf-text-secondary);
      white-space: pre-wrap;
    }
    .char-counter {
      display: block;
      text-align: right;
      font-size: 12px;
      color: var(--pf-text-muted);
      font-family: 'JetBrains Mono', monospace;
      &.near-limit { color: var(--pf-danger, #EF4444); }
    }
    .poll-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 24px;
      font-size: 12px;
      color: var(--pf-cyan-500);
      border-bottom: 1px solid var(--pf-border-subtle);
    }
    .poll-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--pf-cyan-500);
      box-shadow: 0 0 6px rgba(6,182,212,0.8);
      animation: pf-pulse 2s ease-in-out infinite;
    }
    @keyframes pf-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.8); }
    }
  `],
})
export class TicketDetailComponent implements OnInit, OnDestroy {
  private readonly api = inject(TicketsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  ticket  = signal<TicketDetail | null>(null);
  loading = signal(true);
  sending = signal(false);
  replyBody = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  t  => { this.ticket.set(t); this.loading.set(false); this.startPolling(id); },
        error: () => this.loading.set(false),
      });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** Poll for new messages every 15s while ticket is open */
  private startPolling(id: string): void {
    this.pollTimer = setInterval(() => {
      const t = this.ticket();
      if (!t || t.status === 'CLOSED') {
        if (this.pollTimer) clearInterval(this.pollTimer);
        return;
      }
      this.api.get(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: updated => {
            // Only update if new messages arrived
            if (updated.messages.length > (t.messages?.length ?? 0)) {
              this.ticket.set(updated);
            }
          },
        });
    }, 15_000);
  }

  sendReply(): void {
    const t = this.ticket();
    if (!t || this.sending() || !this.replyBody.trim()) return;
    this.sending.set(true);
    this.api.addMessage(t.id, this.replyBody.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.replyBody = '';
          this.sending.set(false);
          // Reload ticket to show new message
          this.api.get(t.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(updated => this.ticket.set(updated));
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to send reply.' });
          this.sending.set(false);
        },
      });
  }

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
