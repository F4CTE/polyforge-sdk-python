import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminOrderView, DlqEntry, OrderStatus } from '../../core/models/admin.model';

type Tab = 'orders' | 'dlq';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, DatePipe, LowerCasePipe, ButtonModule, InputTextModule, SelectModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab  = signal<Tab>('orders');

  // Orders
  orders     = signal<AdminOrderView[]>([]);
  ordLoading = signal(true);
  ordTotal   = signal(0);
  ordPages   = signal(0);
  ordPage    = signal(1);
  ordStatus  = '';

  // DLQ
  dlq        = signal<DlqEntry[]>([]);
  dlqLoading = signal(false);
  dlqActions = signal<Record<string, boolean>>({});

  readonly statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Pending',      value: 'PENDING' },
    { label: 'Submitted',    value: 'SUBMITTED' },
    { label: 'Live',         value: 'LIVE' },
    { label: 'Confirmed',    value: 'CONFIRMED' },
    { label: 'Cancelled',    value: 'CANCELLED' },
    { label: 'Failed',       value: 'FAILED' },
  ];

  readonly skeletons = Array(10);

  ngOnInit(): void { this.loadOrders(); }

  setTab(t: Tab): void {
    this.activeTab.set(t);
    if (t === 'dlq' && this.dlq().length === 0) this.loadDlq();
  }

  loadOrders(): void {
    this.ordLoading.set(true);
    this.api.orders({ page: this.ordPage(), limit: 20, status: this.ordStatus || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.orders.set(res.data); this.ordTotal.set(res.total); this.ordPages.set(res.totalPages); this.ordLoading.set(false); },
        error: () => this.ordLoading.set(false),
      });
  }

  loadDlq(): void {
    this.dlqLoading.set(true);
    this.api.dlq()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: d => { this.dlq.set(d); this.dlqLoading.set(false); }, error: () => this.dlqLoading.set(false) });
  }

  replay(entry: DlqEntry): void {
    this.dlqActions.update(m => ({ ...m, [entry.intentId]: true }));
    this.api.dlqReplay(entry.intentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dlq.update(list => list.filter(e => e.intentId !== entry.intentId));
          this.toast.add({ severity: 'success', summary: 'Replayed', detail: entry.intentId.slice(0, 8) });
          this.dlqActions.update(m => ({ ...m, [entry.intentId]: false }));
        },
        error: () => { this.toast.add({ severity: 'error', summary: 'Error', detail: 'Replay failed.' }); this.dlqActions.update(m => ({ ...m, [entry.intentId]: false })); },
      });
  }

  discard(entry: DlqEntry): void {
    this.dlqActions.update(m => ({ ...m, [`d_${entry.intentId}`]: true }));
    this.api.dlqDiscard(entry.intentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.dlq.update(list => list.filter(e => e.intentId !== entry.intentId)); this.toast.add({ severity: 'info', summary: 'Discarded' }); },
        error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'Discard failed.' }),
      });
  }

  onOrdFilter(): void { this.ordPage.set(1); this.loadOrders(); }
  prevPage(): void { if (this.ordPage() > 1) { this.ordPage.update(p => p - 1); this.loadOrders(); } }
  nextPage(): void { if (this.ordPage() < this.ordPages()) { this.ordPage.update(p => p + 1); this.loadOrders(); } }

  statusColor(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = { PENDING: 'var(--pf-warning)', SUBMITTED: 'var(--pf-cyan-400)', LIVE: 'var(--pf-cyan-400)', MATCHED: 'var(--pf-cyan-300)', CONFIRMED: 'var(--pf-success)', CANCELLED: 'var(--pf-text-muted)', FAILED: 'var(--pf-danger)' };
    return map[s] ?? 'var(--pf-text-muted)';
  }

  statusBg(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = { PENDING: 'rgba(245,158,11,0.1)', SUBMITTED: 'rgba(6,182,212,0.1)', LIVE: 'rgba(6,182,212,0.1)', MATCHED: 'rgba(6,182,212,0.08)', CONFIRMED: 'rgba(16,185,129,0.1)', CANCELLED: 'rgba(122,148,180,0.08)', FAILED: 'rgba(239,68,68,0.1)' };
    return map[s] ?? 'transparent';
  }
}
