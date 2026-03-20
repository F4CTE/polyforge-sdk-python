import { Component, OnInit, inject, signal, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';

import { SocialApiService, LeaderboardEntry } from '../../core/services/social-api.service';

type Period = '7d' | '30d' | 'allTime';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RouterLink, ButtonModule, SkeletonModule, AvatarModule],
  templateUrl: './leaderboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardComponent implements OnInit {
  private readonly api        = inject(SocialApiService);
  private readonly destroyRef = inject(DestroyRef);

  entries    = signal<LeaderboardEntry[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);
  period     = signal<Period>('7d');

  readonly periods: { label: string; value: Period }[] = [
    { label: '7 Days',   value: '7d' },
    { label: '30 Days',  value: '30d' },
    { label: 'All Time', value: 'allTime' },
  ];

  readonly skeletons = Array(10);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.leaderboard(this.period(), this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  res => {
          this.entries.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setPeriod(p: Period): void { this.period.set(p); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  pnlColor(pnl: string): string {
    const v = parseFloat(pnl);
    if (isNaN(v)) return 'var(--pf-text-secondary)';
    return v >= 0 ? 'var(--pf-success)' : 'var(--pf-danger)';
  }

  pnlSign(pnl: string): string {
    const v = parseFloat(pnl);
    if (isNaN(v) || v === 0) return pnl;
    return v > 0 ? `+${pnl}` : pnl;
  }

  rankMedal(rank: number): string {
    if (rank === 1) return '\u{1F947}';
    if (rank === 2) return '\u{1F948}';
    if (rank === 3) return '\u{1F949}';
    return '';
  }

  rankIcon(rank: number): string {
    if (rank === 1) return 'pi-trophy';
    if (rank === 2) return 'pi-star-fill';
    if (rank === 3) return 'pi-star';
    return '';
  }

  rankColor(rank: number): string {
    if (rank === 1) return '#F59E0B';
    if (rank === 2) return '#9CA3AF';
    if (rank === 3) return '#B45309';
    return 'var(--pf-text-muted)';
  }

  userInitials(e: LeaderboardEntry): string {
    return (e.displayName ?? e.username).slice(0, 2).toUpperCase();
  }
}
