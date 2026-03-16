import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminBacktestView, BacktestStatus } from '../../core/models/admin.model';

@Component({
  selector: 'app-backtests',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonModule, SkeletonModule, ProgressBarModule],
  templateUrl: './backtests.component.html',
})
export class BacktestsComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  runs       = signal<AdminBacktestView[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);

  readonly skeletons = Array(10);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.backtests({ page: this.page(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.runs.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  statusColor(s: BacktestStatus): string {
    const m: Record<BacktestStatus, string> = { QUEUED: 'var(--pf-text-muted)', RUNNING: 'var(--pf-cyan-400)', COMPLETED: 'var(--pf-success)', FAILED: 'var(--pf-danger)', CANCELLED: 'var(--pf-text-muted)' };
    return m[s] ?? 'var(--pf-text-muted)';
  }

  statusBg(s: BacktestStatus): string {
    const m: Record<BacktestStatus, string> = { QUEUED: 'rgba(122,148,180,0.08)', RUNNING: 'rgba(6,182,212,0.1)', COMPLETED: 'rgba(16,185,129,0.1)', FAILED: 'rgba(239,68,68,0.1)', CANCELLED: 'rgba(122,148,180,0.08)' };
    return m[s] ?? 'transparent';
  }

  pnlColor(v: string | null): string {
    if (!v) return 'var(--pf-text-muted)';
    return parseFloat(v) >= 0 ? 'var(--pf-success)' : 'var(--pf-danger)';
  }
}
