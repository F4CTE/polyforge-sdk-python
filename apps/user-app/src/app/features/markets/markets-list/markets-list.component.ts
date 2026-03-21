import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { MarketsApiService, Market, MarketsQuery } from '../../../core/services/markets-api.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { SparklineComponent } from '../../../shared/components/sparkline.component';

@Component({
  selector: 'app-markets-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    TagModule,
    TooltipModule,
    SparklineComponent,
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
  category   = signal<string>('all');
  livePrices = signal<Record<string, string>>({});
  viewMode   = signal<'cards' | 'table'>(
    (typeof localStorage !== 'undefined' && localStorage.getItem('pf-markets-view') as 'cards' | 'table') || 'cards'
  );

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly sortOptions = [
    { label: 'Volume',       value: 'volume' },
    { label: 'Newest',       value: 'newest' },
    { label: 'Closing Soon', value: 'closing_soon' },
    { label: 'Liquidity',    value: 'liquidity' },
  ];

  readonly categories = ['all', 'Sports', 'Crypto', 'Politics', 'Economics', 'Finance', 'Technology'];

  readonly categoryIcons: Record<string, string> = {
    all:        'pi-objects-column',
    Sports:     'pi-trophy',
    Crypto:     'pi-bitcoin',
    Politics:   'pi-building-columns',
    Economics:  'pi-chart-line',
    Finance:    'pi-wallet',
    Technology: 'pi-microchip',
  };

  /** Top 3 markets by volume for the featured/hero section */
  featuredMarkets = computed(() => {
    const all = this.filteredMarkets();
    return all.slice(0, 3);
  });

  /** Markets after featured, for the main grid */
  gridMarkets = computed(() => {
    const all = this.filteredMarkets();
    return all.slice(3);
  });

  /** All markets filtered by category */
  filteredMarkets = computed(() => {
    const cat = this.category();
    const all = this.markets();
    if (cat === 'all') return all;
    return all.filter(m => m.category === cat);
  });

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

  setCategory(cat: string): void {
    this.category.set(cat);
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

  priceCents(market: Market, outcome: 'YES' | 'NO'): string {
    const raw = this.price(market, outcome);
    if (raw === '—') return '—';
    const val = parseFloat(raw);
    return Math.round(val * 100) + '\u00A2';
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

  sparklineData(market: Market): number[] {
    const base = parseFloat(market.tokens?.[0]?.price ?? '0.5');
    const seed = market.id?.charCodeAt(0) ?? 42;
    const points: number[] = [];
    let val = base - 0.05;
    for (let i = 0; i < 20; i++) {
      val += (Math.sin(seed + i * 0.7) * 0.02) + (Math.cos(seed * 2 + i) * 0.01);
      points.push(Math.max(0.01, Math.min(0.99, val)));
    }
    points[points.length - 1] = base;
    return points;
  }

  categoryColor(cat: string): { bg: string; text: string } {
    const map: Record<string, { bg: string; text: string }> = {
      Sports:     { bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6' },
      Crypto:     { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
      Politics:   { bg: 'rgba(168,85,247,0.15)',  text: '#A855F7' },
      Economics:  { bg: 'rgba(16,185,129,0.15)',   text: '#10B981' },
      Finance:    { bg: 'rgba(6,182,212,0.15)',    text: '#06B6D4' },
      Technology: { bg: 'rgba(236,72,153,0.15)',   text: '#EC4899' },
    };
    return map[cat] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6B7280' };
  }

  categoryGradient(cat: string): string {
    const c = this.categoryColor(cat);
    return `linear-gradient(135deg, ${c.text}22 0%, ${c.text}08 50%, transparent 100%)`;
  }

  setViewMode(mode: 'cards' | 'table'): void {
    this.viewMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pf-markets-view', mode);
    }
  }

  readonly skeletons = Array(10);
}
