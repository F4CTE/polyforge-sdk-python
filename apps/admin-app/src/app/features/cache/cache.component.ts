import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService } from '../../core/services/admin-api.service';
import { CacheStats, RateLimitEntry } from '../../core/models/admin.model';

@Component({
  selector: 'app-cache',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, ButtonModule, InputTextModule, SkeletonModule, ProgressBarModule, ToastModule],
  providers: [MessageService],
  templateUrl: './cache.component.html',
})
export class CacheComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  stats      = signal<CacheStats | null>(null);
  rateLimits = signal<RateLimitEntry[]>([]);
  loading    = signal(true);

  flushPattern  = '';
  flushing      = signal(false);
  flushResult   = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.cacheStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: s => { this.stats.set(s); this.loading.set(false); }, error: () => this.loading.set(false) });
    this.api.rateLimits()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.rateLimits.set(r) });
  }

  flush(): void {
    if (!this.flushPattern.trim() || this.flushing()) return;
    this.flushing.set(true);
    this.flushResult.set(null);
    this.api.cacheFlush(this.flushPattern)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.flushResult.set(res.keysDeleted);
          this.toast.add({ severity: 'success', summary: 'Cache flushed', detail: `${res.keysDeleted} keys deleted` });
          this.flushing.set(false);
          this.load();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Flush failed.' });
          this.flushing.set(false);
        },
      });
  }

  rateLimitColor(pct: number): string {
    if (pct >= 95) return 'var(--pf-danger)';
    if (pct >= 80) return 'var(--pf-warning)';
    return 'var(--pf-success)';
  }
}
