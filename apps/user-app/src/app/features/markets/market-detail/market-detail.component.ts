import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';

import {
  MarketsApiService,
  Market,
  OrderBook,
  PriceHistory,
} from '../../../core/services/markets-api.service';
import { StrategiesApiService, Strategy } from '../../../core/services/strategies-api.service';
import { WebSocketService } from '../../../core/services/websocket.service';

type Resolution = '1m' | '1h' | '1d';

@Component({
  selector: 'app-market-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, ChartModule, ButtonModule, SkeletonModule, SelectModule, TagModule, DialogModule],
  templateUrl: './market-detail.component.html',
})
export class MarketDetailComponent implements OnInit, OnDestroy {
  private readonly route         = inject(ActivatedRoute);
  private readonly api           = inject(MarketsApiService);
  private readonly strategiesApi = inject(StrategiesApiService);
  private readonly ws            = inject(WebSocketService);
  private readonly destroyRef    = inject(DestroyRef);

  market       = signal<Market | null>(null);
  orderBook    = signal<OrderBook | null>(null);
  chartData    = signal<object | null>(null);
  chartOptions = signal<object | null>(null);

  loadingMarket = signal(true);
  loadingChart  = signal(true);
  loadingBook   = signal(true);

  liveYesPrice  = signal<string | null>(null);
  liveNoPrice   = signal<string | null>(null);
  resolution    = signal<Resolution>('1h');

  // Run Strategy dialog
  showRunStrategy    = signal(false);
  strategyOptions    = signal<{ label: string; value: string }[]>([]);
  selectedStrategyId: string | null = null;

  readonly resolutionOptions: { label: string; value: Resolution }[] = [
    { label: '1m', value: '1m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.ws.connect();

    // Load strategies for the Run Strategy dialog
    this.strategiesApi.list({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.strategyOptions.set(
            res.data.map(s => ({ label: s.name, value: s.id }))
          );
        },
      });

    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (market) => {
        this.market.set(market);
        this.loadingMarket.set(false);

        const yes = market.tokens.find(t => t.outcome === 'YES');
        const no  = market.tokens.find(t => t.outcome === 'NO');

        if (yes) { this.liveYesPrice.set(yes.price); }
        if (no)  { this.liveNoPrice.set(no.price); }

        const tokenIds = market.tokens.map(t => t.tokenId);
        this.ws.subscribePrices(tokenIds);

        if (yes) {
          this.loadChart(yes.tokenId);
          this.loadBook(yes.tokenId);
        }

        this.ws.priceUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(update => {
          if (yes && update.tokenId === yes.tokenId) this.liveYesPrice.set(update.price);
          if (no  && update.tokenId === no.tokenId)  this.liveNoPrice.set(update.price);
        });
      },
      error: () => this.loadingMarket.set(false),
    });
  }

  loadChart(tokenId: string): void {
    this.loadingChart.set(true);
    const from = new Date(Date.now() - this.chartRange()).toISOString();
    this.api
      .priceHistory(tokenId, this.resolution(), from, undefined, this.chartLimit())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  h  => { this.buildChart(h); this.loadingChart.set(false); },
        error: () => this.loadingChart.set(false),
      });
  }

  loadBook(tokenId: string): void {
    this.loadingBook.set(true);
    this.api.orderBook(tokenId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  b  => { this.orderBook.set(b); this.loadingBook.set(false); },
      error: () => this.loadingBook.set(false),
    });
  }

  onResolutionChange(value: Resolution): void {
    this.resolution.set(value);
    const yes = this.market()?.tokens.find(t => t.outcome === 'YES');
    if (yes) this.loadChart(yes.tokenId);
  }

  onStartStrategy(): void {
    if (!this.selectedStrategyId) return;
    this.strategiesApi.start(this.selectedStrategyId, 'paper')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showRunStrategy.set(false);
          this.selectedStrategyId = null;
        },
      });
  }

  marketVolume(): string {
    const m = this.market();
    if (!m) return '—';
    const v = parseFloat(m.volume24h);
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }

  marketLiquidity(): string {
    const m = this.market();
    if (!m) return '—';
    const v = m.tokens.reduce((sum, t) => sum + parseFloat(t.liquidity || '0'), 0);
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }

  private chartRange(): number {
    switch (this.resolution()) {
      case '1m': return 6 * 60 * 60 * 1000;          // 6h
      case '1h': return 7 * 24 * 60 * 60 * 1000;     // 7d
      case '1d': return 90 * 24 * 60 * 60 * 1000;    // 90d
    }
  }

  private chartLimit(): number {
    return this.resolution() === '1d' ? 90 : 200;
  }

  private buildChart(history: PriceHistory): void {
    const res = this.resolution();
    const labels = history.data.map(d => {
      const dt = new Date(d.time);
      if (res === '1m') return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (res === '1h') return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    this.chartData.set({
      labels,
      datasets: [{
        label:           'YES',
        data:            history.data.map(d => parseFloat(d.close)),
        borderColor:     '#06B6D4',
        backgroundColor: 'rgba(6,182,212,0.06)',
        fill:            true,
        tension:         0.3,
        borderWidth:     1.5,
        pointRadius:     0,
        pointHoverRadius: 4,
      }],
    });

    this.chartOptions.set({
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111D2E',
          titleColor:      '#E8EDF5',
          bodyColor:       '#7A94B4',
          borderColor:     '#1E3350',
          borderWidth:     1,
          padding:         12,
          cornerRadius:    6,
          titleFont:       { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont:        { family: "'JetBrains Mono', monospace", size: 12 },
          callbacks: {
            label: (ctx: { parsed: { y: number } }) => `  ${ctx.parsed.y.toFixed(3)}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: '#1A2840' },
          ticks: { color: '#445E7A', font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 8 },
        },
        y: {
          min:   0,
          max:   1,
          grid:  { color: '#1A2840' },
          ticks: {
            color:     '#445E7A',
            font:      { family: "'JetBrains Mono', monospace", size: 10 },
            callback:  (v: number) => v.toFixed(2),
          },
        },
      },
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  bookDepth(book: OrderBook, side: 'bids' | 'asks', index: number): string {
    const entries = book[side];
    if (!entries[index]) return '0';
    const total = entries.reduce((s, e) => s + parseFloat(e.size), 0);
    const cumSize = entries.slice(0, index + 1).reduce((s, e) => s + parseFloat(e.size), 0);
    return ((cumSize / total) * 100).toFixed(0);
  }

  ngOnDestroy(): void {
    const market = this.market();
    if (market) this.ws.unsubscribePrices(market.tokens.map(t => t.tokenId));
  }
}
