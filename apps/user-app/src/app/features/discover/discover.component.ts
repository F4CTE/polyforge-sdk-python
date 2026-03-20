import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';

import { SocialApiService, PublicStrategy } from '../../core/services/social-api.service';

type SortOption = 'popular' | 'newest' | 'top_pnl' | 'most_forked';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonModule, SkeletonModule, AvatarModule],
  templateUrl: './discover.component.html',
})
export class DiscoverComponent implements OnInit {
  private readonly api        = inject(SocialApiService);
  private readonly destroyRef = inject(DestroyRef);

  strategies = signal<PublicStrategy[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);
  sort       = signal<SortOption>('popular');

  readonly sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Popular',     value: 'popular' },
    { label: 'Newest',      value: 'newest' },
    { label: 'Top P&L',     value: 'top_pnl' },
    { label: 'Most Forked', value: 'most_forked' },
  ];

  readonly skeletons = Array(9);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.discover({ sort: this.sort(), page: this.page(), limit: 12 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  res => {
          this.strategies.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setSort(s: SortOption): void { this.sort.set(s); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  authorInitials(s: PublicStrategy): string {
    return (s.author.displayName ?? s.author.username).slice(0, 2).toUpperCase();
  }

  execLabel(mode: string): string {
    const map: Record<string, string> = { TICK: 'Tick', EVENT: 'Event' };
    return map[mode] ?? mode;
  }

  /** Deterministic mock 24h P&L based on strategy id. Returns 0 for ~30% of strategies to show "—". */
  mockPnl(s: PublicStrategy): number {
    const hash = s.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    if (hash % 10 < 3) return 0; // ~30% show no data
    const seed = Math.sin(hash) * 10000;
    return parseFloat(((seed - Math.floor(seed)) * 20 - 10).toFixed(1));
  }
}
