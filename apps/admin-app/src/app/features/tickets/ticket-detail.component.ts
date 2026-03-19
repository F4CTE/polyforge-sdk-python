import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminAuthStore } from '../../core/store/admin-auth.store';

@Component({
  selector: 'app-admin-ticket-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, TextareaModule, SelectModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="pf-page">

      @if (loading()) {
        <div class="page-header"><p-skeleton height="24px" width="40%" /></div>
        <div class="portfolio-table-panel" style="padding:24px">
          @for (s of [1,2,3]; track s) { <p-skeleton height="60px" styleClass="mb-3" /> }
        </div>
      } @else if (ticket(); as t) {

        <!-- Header -->
        <div class="page-header">
          <div>
            <h1 style="margin-bottom:4px">{{ t.subject }}</h1>
            <div style="display:flex;gap:12px;align-items:center;font-size:12px;color:var(--pf-text-muted)">
              <span>{{ t.user?.username }} ({{ t.user?.email }})</span>
              <span>{{ t.category }}</span>
              <span>Opened {{ t.createdAt | date:'MMM d, yyyy' }}</span>
            </div>
          </div>
        </div>

        <!-- Assignment info -->
        <div class="portfolio-table-panel" style="padding:12px 20px;display:flex;gap:16px;align-items:center;font-size:13px;color:var(--pf-text-secondary)">
          <span>
            <i class="pi pi-user" style="margin-right:4px"></i>
            Assigned to:
            <strong>{{ t.assignedToName ?? 'Unassigned' }}</strong>
          </span>
          @if (t.closedByName) {
            <span>
              <i class="pi pi-times-circle" style="margin-right:4px"></i>
              Closed by: <strong>{{ t.closedByName }}</strong>
            </span>
          }
        </div>

        <!-- Admin controls -->
        <div class="portfolio-table-panel" style="padding:16px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px">
          <p-select [options]="statusOptions" [(ngModel)]="selectedStatus" optionLabel="label" optionValue="value"
                    style="min-width:160px" />
          <p-select [options]="priorityOptions" [(ngModel)]="selectedPriority" optionLabel="label" optionValue="value"
                    style="min-width:140px" />
          <p-button label="Update" icon="pi pi-check" size="small" (onClick)="updateTicket()"
                    [loading]="updating()" />
          @if (!t.assignedTo) {
            <p-button label="Assign to me" icon="pi pi-user-plus" severity="secondary" size="small"
                      [text]="true" (onClick)="assignToMe()" />
          }
          @if (t.status !== 'CLOSED') {
            <p-button label="Close Ticket" icon="pi pi-times" severity="danger" size="small"
                      [text]="true" (onClick)="closeTicket()" [loading]="closing()" />
          }
        </div>

        <!-- Messages -->
        <div class="portfolio-table-panel" style="padding:0;margin-top:16px">
          @for (msg of t.messages; track msg.id) {
            <div class="ticket-message" [class.admin]="msg.isAdmin">
              <div class="msg-header">
                <span class="msg-sender">
                  @if (msg.isAdmin) {
                    <i class="pi pi-shield" style="font-size:12px;margin-right:4px;color:var(--pf-cyan-500)"></i>
                  }
                  {{ msg.senderName }}
                  @if (msg.isAdmin) { <span style="font-size:10px;color:var(--pf-text-muted);margin-left:4px">(admin)</span> }
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
            <textarea pTextarea [(ngModel)]="replyBody" rows="3" placeholder="Type your reply to the user..."
                      style="width:100%;resize:vertical;margin-bottom:12px" maxlength="5000"></textarea>
            <p-button label="Send Reply" icon="pi pi-send" [loading]="sending()"
                      (onClick)="sendReply()" [disabled]="!replyBody.trim()" size="small" />
          </div>
        }

      }
    </div>
  `,
  styles: [`
    .ticket-message {
      padding: 16px 20px;
      border-bottom: 1px solid var(--pf-border);
      &.admin { background: rgba(6,182,212,0.03); }
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
      font-family: var(--pf-font-mono);
    }
    .msg-body {
      font-size: 14px;
      line-height: 1.6;
      color: var(--pf-text-secondary);
      white-space: pre-wrap;
    }
  `],
})
export class AdminTicketDetailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AdminAuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  ticket   = signal<any>(null);
  loading  = signal(true);
  sending  = signal(false);
  updating = signal(false);
  closing  = signal(false);
  replyBody = '';

  selectedStatus = '';
  selectedPriority = '';

  readonly statusOptions = [
    { label: 'Open',           value: 'OPEN' },
    { label: 'Awaiting User',  value: 'AWAITING_USER' },
    { label: 'Awaiting Admin', value: 'AWAITING_ADMIN' },
    { label: 'Closed',         value: 'CLOSED' },
  ];

  readonly priorityOptions = [
    { label: 'Low',    value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High',   value: 'HIGH' },
    { label: 'Urgent', value: 'URGENT' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadTicket(id);
  }

  private loadTicket(id: string): void {
    this.api.ticket(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: t => {
          this.ticket.set(t);
          this.selectedStatus = t.status;
          this.selectedPriority = t.priority;
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  sendReply(): void {
    const t = this.ticket();
    if (!t || this.sending() || !this.replyBody.trim()) return;
    this.sending.set(true);
    this.api.replyTicket(t.id, this.replyBody.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.replyBody = '';
          this.sending.set(false);
          this.toast.add({ severity: 'success', summary: 'Reply sent' });
          this.loadTicket(t.id);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to send reply.' });
          this.sending.set(false);
        },
      });
  }

  updateTicket(): void {
    const t = this.ticket();
    if (!t || this.updating()) return;
    this.updating.set(true);
    this.api.updateTicket(t.id, {
      status: this.selectedStatus,
      priority: this.selectedPriority,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.updating.set(false);
          this.toast.add({ severity: 'success', summary: 'Ticket updated' });
          this.loadTicket(t.id);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update ticket.' });
          this.updating.set(false);
        },
      });
  }

  assignToMe(): void {
    const t = this.ticket();
    const admin = this.auth.admin();
    if (!t || !admin) return;
    this.api.updateTicket(t.id, { assignedTo: admin.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Ticket assigned to you' });
          this.loadTicket(t.id);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to assign ticket.' });
        },
      });
  }

  closeTicket(): void {
    const t = this.ticket();
    if (!t || this.closing()) return;
    this.closing.set(true);
    this.api.closeTicket(t.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closing.set(false);
          this.toast.add({ severity: 'success', summary: 'Ticket closed' });
          this.loadTicket(t.id);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to close ticket.' });
          this.closing.set(false);
        },
      });
  }
}
