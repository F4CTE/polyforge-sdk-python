import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';

import { AdminApiService } from '../../core/services/admin-api.service';

type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule, ButtonModule, SelectModule, SkeletonModule],
  template: `
    <div class="pf-page">

      <div class="page-header">
        <h1>Tickets</h1>
        @if (!loading()) {
          <span class="pf-mono" style="font-size:12px;color:var(--pf-text-muted)">{{ total() }} tickets</span>
        }
      </div>

      <!-- Filters -->
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <p-select [options]="statusOptions" [(ngModel)]="statusFilter" optionLabel="label" optionValue="value"
                  placeholder="Status" (onChange)="load()" style="min-width:160px" />
        <p-select [options]="priorityOptions" [(ngModel)]="priorityFilter" optionLabel="label" optionValue="value"
                  placeholder="Priority" (onChange)="load()" style="min-width:140px" />
      </div>

      <!-- Table -->
      <div class="portfolio-table-panel">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th class="pf-col-label" style="min-width:200px">Subject</th>
                <th class="pf-col-label" style="min-width:100px">User</th>
                <th class="pf-col-label" style="min-width:100px">Status</th>
                <th class="pf-col-label" style="min-width:80px">Priority</th>
                <th class="pf-col-label" style="min-width:90px">Category</th>
                <th class="pf-col-label" style="min-width:100px">Assigned To</th>
                <th class="pf-col-label" style="min-width:120px;text-align:right">Updated</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                @for (s of [1,2,3,4,5]; track s) {
                  <tr class="table-row">
                    @for (c of [1,2,3,4,5,6,7]; track c) {
                      <td><p-skeleton height="12px" /></td>
                    }
                  </tr>
                }
              } @else if (tickets().length === 0) {
                <tr>
                  <td colspan="7">
                    <div class="pf-empty-state" style="padding:48px">
                      <i class="pi pi-comments pf-empty-icon"></i>
                      <p class="pf-empty-title">No tickets</p>
                      <p class="pf-empty-desc">Support tickets from users will appear here.</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (t of tickets(); track t.id) {
                  <tr class="table-row" style="cursor:pointer" [routerLink]="['/tickets', t.id]">
                    <td>
                      <span style="font-weight:600;font-size:13px">{{ t.subject }}</span>
                    </td>
                    <td>
                      <span class="pf-mono" style="font-size:12px">{{ t.user?.username ?? '—' }}</span>
                    </td>
                    <td>
                      <span class="order-status-badge"
                            [style.color]="statusColor(t.status)"
                            [style.background]="statusBg(t.status)">
                        {{ statusLabel(t.status) }}
                      </span>
                    </td>
                    <td>
                      <span class="order-status-badge"
                            [style.color]="priorityColor(t.priority)"
                            [style.background]="priorityBg(t.priority)">
                        {{ t.priority }}
                      </span>
                    </td>
                    <td>
                      <span class="pf-mono" style="font-size:11px;color:var(--pf-text-muted)">{{ t.category }}</span>
                    </td>
                    <td>
                      @if (t.assignedToName) {
                        <span style="font-size:12px;color:var(--pf-text-secondary)">
                          <i class="pi pi-user" style="font-size:10px;margin-right:4px"></i>{{ t.assignedToName }}
                        </span>
                      } @else {
                        <span style="font-size:11px;color:var(--pf-text-muted);font-style:italic">Unassigned</span>
                      }
                    </td>
                    <td style="text-align:right">
                      <span class="pf-mono" style="font-size:11px;color:var(--pf-text-muted)">
                        {{ t.updatedAt | date:'MMM d, HH:mm' }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (totalPages() > 1) {
        <div class="markets-pagination">
          <p-button icon="pi pi-chevron-left" severity="secondary" [text]="true" size="small"
                    [disabled]="page() === 1" (onClick)="prevPage()" />
          <span class="pf-mono" style="font-size:13px;color:var(--pf-text-secondary)">{{ page() }} / {{ totalPages() }}</span>
          <p-button icon="pi pi-chevron-right" severity="secondary" [text]="true" size="small"
                    [disabled]="page() === totalPages()" (onClick)="nextPage()" />
        </div>
      }

    </div>
  `,
})
export class TicketsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  tickets    = signal<any[]>([]);
  loading    = signal(true);
  total      = signal(0);
  page       = signal(1);
  totalPages = signal(0);

  statusFilter = '';
  priorityFilter = '';

  readonly statusOptions = [
    { label: 'All Statuses',    value: '' },
    { label: 'Open',            value: 'OPEN' },
    { label: 'Awaiting User',   value: 'AWAITING_USER' },
    { label: 'Awaiting Admin',  value: 'AWAITING_ADMIN' },
    { label: 'Closed',          value: 'CLOSED' },
  ];

  readonly priorityOptions = [
    { label: 'All Priorities', value: '' },
    { label: 'Low',            value: 'LOW' },
    { label: 'Medium',         value: 'MEDIUM' },
    { label: 'High',           value: 'HIGH' },
    { label: 'Urgent',         value: 'URGENT' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.tickets({
      page: this.page(),
      limit: 25,
      status: this.statusFilter || undefined,
      priority: this.priorityFilter || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.tickets.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  statusLabel(s: TicketStatus): string {
    return { OPEN: 'Open', AWAITING_USER: 'Awaiting User', AWAITING_ADMIN: 'Awaiting Admin', CLOSED: 'Closed' }[s] ?? s;
  }
  statusColor(s: TicketStatus): string {
    return { OPEN: 'var(--pf-cyan-500)', AWAITING_USER: 'var(--pf-warning)', AWAITING_ADMIN: 'var(--pf-cyan-400)', CLOSED: 'var(--pf-text-muted)' }[s] ?? 'var(--pf-text-muted)';
  }
  statusBg(s: TicketStatus): string {
    return { OPEN: 'rgba(6,182,212,0.1)', AWAITING_USER: 'rgba(245,158,11,0.1)', AWAITING_ADMIN: 'rgba(6,182,212,0.08)', CLOSED: 'rgba(122,148,180,0.08)' }[s] ?? 'transparent';
  }
  priorityColor(p: TicketPriority): string {
    return { LOW: 'var(--pf-text-muted)', MEDIUM: 'var(--pf-cyan-500)', HIGH: 'var(--pf-warning)', URGENT: 'var(--pf-danger)' }[p] ?? 'var(--pf-text-muted)';
  }
  priorityBg(p: TicketPriority): string {
    return { LOW: 'rgba(122,148,180,0.08)', MEDIUM: 'rgba(6,182,212,0.1)', HIGH: 'rgba(245,158,11,0.1)', URGENT: 'rgba(239,68,68,0.1)' }[p] ?? 'transparent';
  }
}
