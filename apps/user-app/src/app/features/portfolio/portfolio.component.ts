import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import {
  PortfolioApiService,
  PortfolioResponse,
  PnlResponse,
  PaperSummary,
  Position,
} from '../../core/services/portfolio-api.service';
import { WebSocketService } from '../../core/services/websocket.service';

type Tab    = 'live' | 'paper';
type Period = '7d' | '30d' | '90d' | 'allTime';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [DecimalPipe, LowerCasePipe, ChartModule, ButtonModule, SkeletonModule, ToastModule, TooltipModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './portfolio.component.html',
})
export class PortfolioComponent implements OnInit {
  private readonly api        = inject(PortfolioApiService);
  private readonly ws         = inject(WebSocketService);
  private readonly toast      = inject(MessageService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  tab    = signal<Tab>('live');
  period = signal<Period>('7d');

  portfolio     = signal<PortfolioResponse | null>(null);
  pnl           = signal<PnlResponse | null>(null);
  paper         = signal<PaperSummary | null>(null);
  chartData     = signal<object | null>(null);
  chartOptions  = signal<object | null>(null);

  loadingPortfolio = signal(true);
  loadingChart     = signal(true);
  loadingPaper     = signal(false);
  closingPosition  = signal<Record<string, boolean>>({});
  resettingPaper   = signal(false);

  readonly periods: { label: string; value: Period }[] = [
    { label: '7d',    value: '7d' },
    { label: '30d',   value: '30d' },
    { label: '90d',   value: '90d' },
    { label: 'All',   value: 'allTime' },
  ];

  readonly totalPnl = computed(() => parseFloat(this.pnl()?.totalPnl ?? '0'));
  readonly isProfitable = computed(() => this.totalPnl() >= 0);

  ngOnInit(): void {
    this.ws.connect();
    this.loadPortfolio();
    this.loadChart();
  }

  loadPortfolio(): void {
    this.loadingPortfolio.set(true);
    this.api.portfolio().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.portfolio.set(res); this.loadingPortfolio.set(false); },
      error: ()  => this.loadingPortfolio.set(false),
    });
  }

  loadChart(): void {
    this.loadingChart.set(true);
    this.api.pnl(this.period()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.pnl.set(res); this.buildChart(res); this.loadingChart.set(false); },
      error: ()  => this.loadingChart.set(false),
    });
  }

  loadPaper(): void {
    this.loadingPaper.set(true);
    this.api.paperSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  res => { this.paper.set(res); this.loadingPaper.set(false); },
      error: ()  => this.loadingPaper.set(false),
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'paper' && !this.paper()) this.loadPaper();
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    this.loadChart();
  }

  closePosition(pos: Position): void {
    this.closingPosition.update(m => ({ ...m, [pos.id]: true }));
    this.api.closePosition({ tokenId: pos.tokenId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.closingPosition.update(m => ({ ...m, [pos.id]: false }));
        this.toast.add({ severity: 'success', summary: 'Close order submitted', detail: 'FOK sell order queued.', life: 3000 });
        this.loadPortfolio();
      },
      error: (err) => {
        this.closingPosition.update(m => ({ ...m, [pos.id]: false }));
        this.toast.add({ severity: 'error', summary: 'Close failed', detail: err?.error?.message ?? 'Unknown error', life: 4000 });
      },
    });
  }

  resetPaper(): void {
    this.confirm.confirm({
      message: 'This will delete all paper positions and orders. This cannot be undone.',
      header: 'Reset Paper Account?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.resettingPaper.set(true);
        this.api.paperReset().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.resettingPaper.set(false);
            this.paper.set({ pnl: '0', positions: [], orderCount: 0 });
            this.toast.add({ severity: 'success', summary: 'Paper account reset', life: 3000 });
          },
          error: () => this.resettingPaper.set(false),
        });
      },
    });
  }

  private buildChart(data: PnlResponse): void {
    const isProfitable = parseFloat(data.totalPnl) >= 0;
    const lineColor    = isProfitable ? '#10B981' : '#EF4444';
    const fillColor    = isProfitable ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';

    const labels = data.snapshots.map(s => {
      const dt = new Date(s.time);
      return this.period() === '90d' || this.period() === 'allTime'
        ? dt.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    this.chartData.set({
      labels,
      datasets: [{
        label:            'P&L',
        data:             data.snapshots.map(s => parseFloat(s.pnl)),
        borderColor:      lineColor,
        backgroundColor:  fillColor,
        fill:             true,
        tension:          0.3,
        borderWidth:      1.5,
        pointRadius:      0,
        pointHoverRadius: 4,
      }],
    });

    const style = getComputedStyle(document.documentElement);
    const gridColor = style.getPropertyValue('--pf-border-subtle').trim() || '#1A2840';
    const tickColor = style.getPropertyValue('--pf-text-muted').trim() || '#445E7A';
    const tooltipBg = style.getPropertyValue('--pf-bg-elevated').trim() || '#111D2E';
    const tooltipTitle = style.getPropertyValue('--pf-text-primary').trim() || '#E8EDF5';
    const tooltipBody = style.getPropertyValue('--pf-text-secondary').trim() || '#7A94B4';
    const tooltipBorder = style.getPropertyValue('--pf-border-default').trim() || '#1E3350';

    this.chartOptions.set({
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor:      tooltipTitle,
          bodyColor:       tooltipBody,
          borderColor:     tooltipBorder,
          borderWidth:     1,
          padding:         12,
          cornerRadius:    6,
          titleFont:       { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont:        { family: "'JetBrains Mono', monospace", size: 12 },
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              `  ${ctx.parsed.y >= 0 ? '+' : ''}$${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 8 },
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color: tickColor,
            font:  { family: "'JetBrains Mono', monospace", size: 10 },
            callback: (v: number) => `$${v.toFixed(0)}`,
          },
        },
      },
    });
  }

  pnlColor(val: string): string {
    const n = parseFloat(val);
    if (n > 0) return 'var(--pf-pnl-positive)';
    if (n < 0) return 'var(--pf-pnl-negative)';
    return 'var(--pf-pnl-neutral)';
  }

  formatPnl(val: string): string {
    const n = parseFloat(val);
    return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
  }

  winRatePct(val: string): string {
    return `${(parseFloat(val) * 100).toFixed(1)}%`;
  }
}
