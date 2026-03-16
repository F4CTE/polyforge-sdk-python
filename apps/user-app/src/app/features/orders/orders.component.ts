import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { PortfolioApiService, Order, OrderStatus } from '../../core/services/portfolio-api.service';

type FilterStatus = 'ALL' | OrderStatus;

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [DatePipe, LowerCasePipe, ButtonModule, SkeletonModule],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  private readonly api        = inject(PortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);

  orders     = signal<Order[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);
  filter     = signal<FilterStatus>('ALL');

  readonly filters: { label: string; value: FilterStatus }[] = [
    { label: 'All',       value: 'ALL' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Live',      value: 'LIVE' },
    { label: 'Pending',   value: 'PENDING' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Failed',    value: 'FAILED' },
  ];

  readonly skeletons = Array(8);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const status = this.filter() === 'ALL' ? undefined : this.filter();
    this.api.orders({ page: this.page(), limit: 25, status })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  res => { this.orders.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  setFilter(f: FilterStatus): void { this.filter.set(f); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  statusColor(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING:   'var(--pf-warning)',
      SUBMITTED: 'var(--pf-cyan-500)',
      LIVE:      'var(--pf-cyan-500)',
      MATCHED:   'var(--pf-cyan-400)',
      CONFIRMED: 'var(--pf-success)',
      CANCELLED: 'var(--pf-text-muted)',
      FAILED:    'var(--pf-danger)',
    };
    return map[status] ?? 'var(--pf-text-muted)';
  }

  statusBg(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING:   'rgba(245,158,11,0.1)',
      SUBMITTED: 'rgba(6,182,212,0.1)',
      LIVE:      'rgba(6,182,212,0.1)',
      MATCHED:   'rgba(6,182,212,0.08)',
      CONFIRMED: 'rgba(16,185,129,0.1)',
      CANCELLED: 'rgba(122,148,180,0.08)',
      FAILED:    'rgba(239,68,68,0.1)',
    };
    return map[status] ?? 'transparent';
  }

  fillRatio(order: Order): string {
    const filled = parseFloat(order.filledSize);
    const total  = parseFloat(order.size);
    if (!total) return '—';
    return `${order.filledSize} / ${order.size}`;
  }
}
