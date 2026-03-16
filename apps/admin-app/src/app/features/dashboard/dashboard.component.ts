import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AdminApiService } from '../../core/services/admin-api.service';
import { HealthResponse, ServiceHealth } from '../../core/models/admin.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TitleCasePipe, ButtonModule, SkeletonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api        = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  health      = signal<HealthResponse | null>(null);
  loading     = signal(true);
  lastRefresh = signal<Date | null>(null);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  load(): void {
    this.api.health()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: h => {
          this.health.set(h);
          this.lastRefresh.set(new Date());
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  serviceEntries() {
    const h = this.health();
    if (!h) return [];
    return Object.entries(h.services).map(([name, svc]) => ({ name, ...svc }));
  }

  statusColor(s: ServiceHealth): string {
    return s === 'healthy' ? 'var(--pf-healthy)' : s === 'degraded' ? 'var(--pf-warning)' : 'var(--pf-danger)';
  }

  statusBg(s: ServiceHealth): string {
    return s === 'healthy' ? 'rgba(16,185,129,0.1)' : s === 'degraded' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  }

  overallIcon(s: ServiceHealth): string {
    return s === 'healthy' ? 'pi-check-circle' : s === 'degraded' ? 'pi-exclamation-circle' : 'pi-times-circle';
  }

  formatServiceName(name: string): string {
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
