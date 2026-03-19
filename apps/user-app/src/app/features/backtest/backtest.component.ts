import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { BacktestApiService, BacktestRun, BacktestStatus } from '../../core/services/backtest-api.service';
import { StrategiesApiService, Strategy } from '../../core/services/strategies-api.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-backtest',
  standalone: true,
  imports: [FormsModule, DatePipe, ButtonModule, InputTextModule, SelectModule, SkeletonModule, ProgressBarModule, DatePickerModule, ToastModule],
  providers: [MessageService],
  templateUrl: './backtest.component.html',
})
export class BacktestComponent implements OnInit, OnDestroy {
  private readonly api        = inject(BacktestApiService);
  private readonly stratApi   = inject(StrategiesApiService);
  private readonly ws         = inject(WebSocketService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ─── Run history ──────────────────────────────────────────────────────────

  runs       = signal<BacktestRun[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);

  selectedRun = signal<BacktestRun | null>(null);

  // ─── New run form ─────────────────────────────────────────────────────────

  strategies      = signal<Strategy[]>([]);
  selectedStratId = '';
  dateStart       = '';
  dateEnd         = '';
  dateStartDate: Date | null = null;
  dateEndDate: Date | null = null;
  submitting      = signal(false);

  onDateStartSelect(event: Date): void {
    this.dateStart = event.toISOString().slice(0, 10);
  }

  onDateEndSelect(event: Date): void {
    this.dateEnd = event.toISOString().slice(0, 10);
  }

  readonly strategyOptions = computed(() =>
    this.strategies().map(s => ({ label: s.name, value: s.id })),
  );

  readonly skeletons = Array(5);

  ngOnInit(): void {
    this.loadHistory();
    this.loadStrategies();
    this.listenWs();
  }

  ngOnDestroy(): void { /* destroyRef handles observable cleanup */ }

  loadHistory(): void {
    this.loading.set(true);
    this.api.list({ page: this.page(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.runs.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  loadStrategies(): void {
    this.stratApi.list({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: res => this.strategies.set(res.data) });
  }

  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.loadHistory(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.loadHistory(); } }

  // ─── Submit new run ───────────────────────────────────────────────────────

  canSubmit = computed(() =>
    !!this.selectedStratId && !!this.dateStart && !!this.dateEnd && !this.submitting(),
  );

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.api.run({
      strategyId:     this.selectedStratId,
      dateRangeStart: new Date(this.dateStart).toISOString(),
      dateRangeEnd:   new Date(this.dateEnd).toISOString(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.toast.add({ severity: 'success', summary: 'Queued', detail: `Backtest run queued (${res.runId.slice(0, 8)}…)` });
          this.page.set(1);
          this.loadHistory();
          this.submitting.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to queue backtest.' });
          this.submitting.set(false);
        },
      });
  }

  // ─── Live WS updates ──────────────────────────────────────────────────────

  private listenWs(): void {
    this.ws.backtestEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event.type === 'BACKTEST_PROGRESS') {
          this.runs.update(list =>
            list.map(r => r.id === event.runId ? { ...r, progress: event.progress ?? r.progress, status: 'RUNNING' } : r),
          );
          const sel = this.selectedRun();
          if (sel?.id === event.runId) {
            this.selectedRun.update(r => r ? { ...r, progress: event.progress ?? r.progress } : r);
          }
        } else if (event.type === 'BACKTEST_COMPLETED') {
          this.runs.update(list =>
            list.map(r => r.id === event.runId ? {
              ...r, status: 'COMPLETED',
              progress:     100,
              winRate:      event.winRate ?? r.winRate,
              totalPnl:     event.totalPnl ?? r.totalPnl,
              totalOrders:  event.totalOrders ?? r.totalOrders,
              filledOrders: event.filledOrders ?? r.filledOrders,
              hasDataGaps:  event.hasDataGaps ?? r.hasDataGaps,
              completedAt:  new Date().toISOString(),
            } : r),
          );
          const sel = this.selectedRun();
          if (sel?.id === event.runId) {
            this.selectedRun.update(r => r ? {
              ...r, status: 'COMPLETED',
              progress: 100,
              winRate:      event.winRate ?? r.winRate,
              totalPnl:     event.totalPnl ?? r.totalPnl,
              totalOrders:  event.totalOrders ?? r.totalOrders,
              filledOrders: event.filledOrders ?? r.filledOrders,
            } : r);
          }
          this.toast.add({ severity: 'success', summary: 'Backtest complete', detail: `P&L: ${event.totalPnl}` });
        } else if (event.type === 'BACKTEST_FAILED') {
          this.runs.update(list =>
            list.map(r => r.id === event.runId ? { ...r, status: 'FAILED', error: event.error ?? 'Unknown error' } : r),
          );
          this.toast.add({ severity: 'error', summary: 'Backtest failed', detail: event.error });
        }
      });
  }

  // ─── Display helpers ──────────────────────────────────────────────────────

  selectRun(run: BacktestRun): void {
    this.selectedRun.update(sel => sel?.id === run.id ? null : run);
  }

  statusColor(s: BacktestStatus): string {
    const map: Record<BacktestStatus, string> = {
      QUEUED:    'var(--pf-text-muted)',
      RUNNING:   'var(--pf-cyan-400)',
      COMPLETED: 'var(--pf-success)',
      FAILED:    'var(--pf-danger)',
      CANCELLED: 'var(--pf-text-muted)',
    };
    return map[s] ?? 'var(--pf-text-muted)';
  }

  statusBg(s: BacktestStatus): string {
    const map: Record<BacktestStatus, string> = {
      QUEUED:    'rgba(122,148,180,0.08)',
      RUNNING:   'rgba(6,182,212,0.1)',
      COMPLETED: 'rgba(16,185,129,0.1)',
      FAILED:    'rgba(239,68,68,0.1)',
      CANCELLED: 'rgba(122,148,180,0.08)',
    };
    return map[s] ?? 'transparent';
  }

  pnlColor(val: string | null): string {
    if (!val) return 'var(--pf-text-muted)';
    return parseFloat(val) >= 0 ? 'var(--pf-success)' : 'var(--pf-danger)';
  }

  pnlSign(val: string | null): string {
    if (!val) return '—';
    const v = parseFloat(val);
    return v > 0 ? `+${val}` : val;
  }

  winRatePct(val: string | null): string {
    if (!val) return '—';
    return `${(parseFloat(val) * 100).toFixed(1)}%`;
  }

  dateRangeLabel(run: BacktestRun): string {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(run.dateRangeStart)} → ${fmt(run.dateRangeEnd)}`;
  }
}
