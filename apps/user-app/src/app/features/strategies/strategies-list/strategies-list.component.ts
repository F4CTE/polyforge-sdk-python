import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { StrategiesApiService, Strategy, StrategyStatus } from '../../../core/services/strategies-api.service';

type FilterStatus = 'ALL' | StrategyStatus;

@Component({
  selector: 'app-strategies-list',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './strategies-list.component.html',
})
export class StrategiesListComponent implements OnInit {
  private readonly api        = inject(StrategiesApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  strategies  = signal<Strategy[]>([]);
  loading     = signal(true);
  actionLoading = signal<Record<string, boolean>>({});
  filter      = signal<FilterStatus>('ALL');

  readonly filters: { label: string; value: FilterStatus }[] = [
    { label: 'All',     value: 'ALL' },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Paused',  value: 'PAUSED' },
    { label: 'Idle',    value: 'IDLE' },
    { label: 'Paper',   value: 'PAPER' },
    { label: 'Error',   value: 'ERROR' },
  ];

  readonly skeletons = Array(4);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const status = this.filter() === 'ALL' ? undefined : this.filter();
    this.api.list({ limit: 50, status }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res  => { this.strategies.set(res.data); this.loading.set(false); },
      error: ()   => { this.loading.set(false); },
    });
  }

  setFilter(value: FilterStatus): void {
    this.filter.set(value);
    this.load();
  }

  start(strategy: Strategy, mode: 'live' | 'paper', event: Event): void {
    event.stopPropagation();
    this.setActionLoading(strategy.id, true);
    this.api.start(strategy.id, mode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.updateStatus(strategy.id, res.status);
        this.setActionLoading(strategy.id, false);
        this.toast.add({ severity: 'success', summary: 'Strategy started', detail: `Running in ${mode} mode`, life: 3000 });
      },
      error: (err) => {
        this.setActionLoading(strategy.id, false);
        this.toast.add({ severity: 'error', summary: 'Failed to start', detail: err?.error?.message ?? 'Unknown error', life: 4000 });
      },
    });
  }

  stop(strategy: Strategy, event: Event): void {
    event.stopPropagation();
    this.setActionLoading(strategy.id, true);
    this.api.stop(strategy.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  (res) => { this.updateStatus(strategy.id, res.status); this.setActionLoading(strategy.id, false); },
      error: ()    => { this.setActionLoading(strategy.id, false); },
    });
  }

  pause(strategy: Strategy, event: Event): void {
    event.stopPropagation();
    this.setActionLoading(strategy.id, true);
    this.api.pause(strategy.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  (res) => { this.updateStatus(strategy.id, res.status); this.setActionLoading(strategy.id, false); },
      error: ()    => { this.setActionLoading(strategy.id, false); },
    });
  }

  resume(strategy: Strategy, event: Event): void {
    event.stopPropagation();
    this.setActionLoading(strategy.id, true);
    this.api.resume(strategy.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  (res) => { this.updateStatus(strategy.id, res.status); this.setActionLoading(strategy.id, false); },
      error: ()    => { this.setActionLoading(strategy.id, false); },
    });
  }

  private updateStatus(id: string, status: StrategyStatus): void {
    this.strategies.update(list => list.map(s => s.id === id ? { ...s, status } : s));
  }

  private setActionLoading(id: string, val: boolean): void {
    this.actionLoading.update(m => ({ ...m, [id]: val }));
  }

  isActive(s: Strategy): boolean { return s.status === 'RUNNING' || s.status === 'PAPER'; }
  isPaused(s: Strategy): boolean { return s.status === 'PAUSED'; }
  isIdle(s: Strategy):   boolean { return s.status === 'IDLE'; }
  isError(s: Strategy):  boolean { return s.status === 'ERROR'; }

  execLabel(s: Strategy): string {
    if (s.execMode === 'TICK')  return `Tick · ${s.tickMs}ms`;
    if (s.execMode === 'EVENT') return 'Event';
    return `Hybrid · ${s.tickMs}ms`;
  }

  blocksCount(s: Strategy): number {
    return s.safety.length + s.triggers.length + s.conditions.length + s.actions.length;
  }
}
