import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { MarketsApiService, Market, MarketsQuery } from '../../../core/services/markets-api.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-markets-list',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    ButtonModule,
    SelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    TagModule,
  ],
  templateUrl: './markets-list.component.html',
})
export class MarketsListComponent implements OnInit {
  private readonly api        = inject(MarketsApiService);
  private readonly ws         = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  markets    = signal<Market[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);
  search     = signal('');
  sort       = signal<MarketsQuery['sort']>('volume');
  livePrices = signal<Record<string, string>>({});

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly sortOptions = [
    { label: 'Volume',       value: 'volume' },
    { label: 'Liquidity',    value: 'liquidity' },
    { label: 'Closing Soon', value: 'closing_soon' },
    { label: 'Newest',       value: 'newest' },
  ];

  ngOnInit(): void {
    this.ws.connect();
    this.ws.priceUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(update => {
      this.livePrices.update(prices => ({ ...prices, [update.tokenId]: update.price }));
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list({
      page:   this.page(),
      limit:  25,
      search: this.search() || undefined,
      sort:   this.sort(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.markets.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
        const tokenIds = res.data.flatMap(m => m.tokens.map(t => t.tokenId));
        this.ws.subscribePrices(tokenIds);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.load();
    }, 300);
  }

  onSortChange(value: string): void {
    this.sort.set(value as MarketsQuery['sort']);
    this.page.set(1);
    this.load();
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); }
  }

  price(market: Market, outcome: 'YES' | 'NO'): string {
    const token = market.tokens.find(t => t.outcome === outcome);
    if (!token) return '—';
    const live = this.livePrices()[token.tokenId];
    return live ?? token.price;
  }

  volume(market: Market): string {
    const v = parseFloat(market.volume24h);
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }

  daysUntil(dateStr: string): string {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    if (d < 0)   return 'Closed';
    if (d === 0) return 'Today';
    if (d === 1) return '1 day';
    if (d < 30)  return `${d} days`;
    const months = Math.round(d / 30);
    return `${months}mo`;
  }

  isClosingSoon(dateStr: string): boolean {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    return d >= 0 && d <= 7;
  }

  readonly skeletons = Array(10);
}
