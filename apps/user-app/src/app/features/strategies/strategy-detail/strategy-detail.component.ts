import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { StrategiesApiService, Strategy, StrategyStatus } from '../../../core/services/strategies-api.service';
import { WebSocketService, StrategyEvent } from '../../../core/services/websocket.service';

interface LiveLogEntry {
  time: Date;
  type: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-strategy-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, LowerCasePipe, ButtonModule, SkeletonModule, ToastModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './strategy-detail.component.html',
})
export class StrategyDetailComponent implements OnInit, OnDestroy {
  private readonly route      = inject(ActivatedRoute);
  private readonly api        = inject(StrategiesApiService);
  private readonly ws         = inject(WebSocketService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  strategy      = signal<Strategy | null>(null);
  loading       = signal(true);
  actionLoading = signal(false);
  liveLog       = signal<LiveLogEntry[]>([]);

  private strategyId = '';

  ngOnInit(): void {
    this.strategyId = this.route.snapshot.paramMap.get('id')!;
    this.ws.connect();

    this.api.get(this.strategyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  s  => { this.strategy.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.ws.subscribeStrategy(this.strategyId);

    this.ws.strategyEvents$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(event => {
      if (event.strategyId !== this.strategyId) return;
      this.handleStrategyEvent(event);
    });
  }

  private handleStrategyEvent(event: StrategyEvent): void {
    const entry = this.toLogEntry(event);
    this.liveLog.update(log => [entry, ...log].slice(0, 100));

    const statusMap: Partial<Record<string, StrategyStatus>> = {
      STRATEGY_STARTED: 'RUNNING',
      STRATEGY_STOPPED: 'IDLE',
      STRATEGY_PAUSED:  'PAUSED',
      STRATEGY_RESUMED: 'RUNNING',
      STRATEGY_ERROR:   'ERROR',
    };
    const newStatus = statusMap[event.type];
    if (newStatus) {
      this.strategy.update(s => s ? { ...s, status: newStatus } : s);
    }
  }

  private toLogEntry(event: StrategyEvent): LiveLogEntry {
    const severityMap: Record<string, LiveLogEntry['severity']> = {
      STRATEGY_STARTED: 'success',
      STRATEGY_STOPPED: 'info',
      STRATEGY_PAUSED:  'warning',
      STRATEGY_RESUMED: 'success',
      STRATEGY_ERROR:   'error',
    };
    const messageMap: Record<string, string> = {
      STRATEGY_STARTED: 'Strategy started',
      STRATEGY_STOPPED: `Strategy stopped${event.reason ? ` · ${event.reason}` : ''}`,
      STRATEGY_PAUSED:  `Strategy paused${event.reason ? ` · ${event.reason}` : ''}`,
      STRATEGY_RESUMED: 'Strategy resumed',
      STRATEGY_ERROR:   `Error in ${event.blockType ?? 'block'}: ${event.error ?? 'Unknown error'}`,
    };
    return {
      time:     new Date(),
      type:     event.type,
      message:  messageMap[event.type] ?? event.type,
      severity: severityMap[event.type] ?? 'info',
    };
  }

  start(mode: 'live' | 'paper'): void {
    const s = this.strategy();
    if (!s) return;
    this.actionLoading.set(true);
    this.api.start(s.id, mode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.strategy.update(st => st ? { ...st, status: res.status } : st); this.actionLoading.set(false); },
      error: err => {
        this.actionLoading.set(false);
        this.toast.add({ severity: 'error', summary: 'Start failed', detail: err?.error?.message ?? 'Unknown error', life: 4000 });
      },
    });
  }

  stop(): void {
    const s = this.strategy();
    if (!s) return;
    this.actionLoading.set(true);
    this.api.stop(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.strategy.update(st => st ? { ...st, status: res.status } : st); this.actionLoading.set(false); },
      error: ()  => this.actionLoading.set(false),
    });
  }

  pause(): void {
    const s = this.strategy();
    if (!s) return;
    this.actionLoading.set(true);
    this.api.pause(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.strategy.update(st => st ? { ...st, status: res.status } : st); this.actionLoading.set(false); },
      error: ()  => this.actionLoading.set(false),
    });
  }

  resume(): void {
    const s = this.strategy();
    if (!s) return;
    this.actionLoading.set(true);
    this.api.resume(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.strategy.update(st => st ? { ...st, status: res.status } : st); this.actionLoading.set(false); },
      error: ()  => this.actionLoading.set(false),
    });
  }

  isActive(status: StrategyStatus): boolean { return status === 'RUNNING' || status === 'PAPER'; }
  isPaused(status: StrategyStatus): boolean { return status === 'PAUSED'; }
  isIdle(status: StrategyStatus):   boolean { return status === 'IDLE' || status === 'ERROR'; }

  blockLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  execLabel(s: Strategy): string {
    if (s.execMode === 'TICK')  return `Tick · ${s.tickMs}ms`;
    if (s.execMode === 'EVENT') return 'Event';
    return `Hybrid · ${s.tickMs}ms`;
  }

  logColor(severity: LiveLogEntry['severity']): string {
    const map = { success: 'var(--pf-success)', info: 'var(--pf-cyan-500)', warning: 'var(--pf-warning)', error: 'var(--pf-danger)' };
    return map[severity];
  }

  ngOnDestroy(): void {
    this.ws.unsubscribeStrategy(this.strategyId);
  }
}
