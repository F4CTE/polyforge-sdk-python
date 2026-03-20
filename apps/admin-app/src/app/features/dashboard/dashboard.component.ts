import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { AdminApiService } from '../../core/services/admin-api.service';
import { HealthResponse, ServiceHealth, AuditLog } from '../../core/models/admin.model';

interface DashboardStat {
  label: string;
  value: number | null;
  icon: string;
  color: string;
  bg: string;
  route: string;
  tooltip: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TitleCasePipe, RouterLink, ButtonModule, SkeletonModule, ToastModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api        = inject(AdminApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  health      = signal<HealthResponse | null>(null);
  loading     = signal(true);
  lastRefresh = signal<Date | null>(null);

  inviteOnly        = signal<boolean | null>(null);
  inviteOnlyLoading = signal(false);
  inviteOnlyToggling = signal(false);

  recentActivity  = signal<AuditLog[]>([]);
  activityLoading = signal(true);

  statsLoading = signal(true);
  stats = signal<DashboardStat[]>([
    { label: 'Total Users',       value: null, icon: 'pi pi-users',       color: 'var(--pf-cyan-500)',  bg: 'rgba(6,182,212,0.1)',    route: '/users',      tooltip: 'Total registered users on the platform' },
    { label: 'Active Strategies', value: null, icon: 'pi pi-bolt',        color: 'var(--pf-success)',   bg: 'rgba(16,185,129,0.1)',   route: '/strategies', tooltip: 'Strategies currently running across all users' },
    { label: 'Total Orders',      value: null, icon: 'pi pi-shopping-bag', color: 'var(--pf-warning)',  bg: 'rgba(245,158,11,0.1)',   route: '/orders',     tooltip: 'Total orders placed across the platform' },
    { label: 'Open Tickets',      value: null, icon: 'pi pi-comments',    color: 'var(--pf-info, #3b82f6)', bg: 'rgba(59,130,246,0.1)', route: '/tickets',  tooltip: 'Support tickets awaiting resolution' },
  ]);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.loadConfig();
    this.loadStats();
    this.loadRecentActivity();
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

  loadStats(): void {
    this.statsLoading.set(true);
    forkJoin({
      users:      this.api.users({ page: 1, limit: 1 }),
      strategies: this.api.strategies({ page: 1, limit: 1, status: 'RUNNING' }),
      orders:     this.api.orders({ page: 1, limit: 1 }),
      tickets:    this.api.tickets({ page: 1, limit: 1, status: 'OPEN' }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.stats.update(s => s.map((stat, i) => ({
            ...stat,
            value: [res.users.total, res.strategies.total, res.orders.total, res.tickets.total][i],
          })));
          this.statsLoading.set(false);
        },
        error: () => this.statsLoading.set(false),
      });
  }

  loadConfig(): void {
    this.inviteOnlyLoading.set(true);
    this.api.getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cfg => { this.inviteOnly.set(cfg.inviteOnly); this.inviteOnlyLoading.set(false); },
        error: () => this.inviteOnlyLoading.set(false),
      });
  }

  toggleInviteOnly(): void {
    const current = this.inviteOnly();
    if (current === null || this.inviteOnlyToggling()) return;
    const next = !current;
    this.inviteOnlyToggling.set(true);
    this.api.setInviteOnly(next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cfg => {
          this.inviteOnly.set(cfg.inviteOnly);
          this.inviteOnlyToggling.set(false);
          this.toast.add({
            severity: cfg.inviteOnly ? 'warn' : 'success',
            summary: cfg.inviteOnly ? 'Invite-only ON' : 'Open registration',
            detail: cfg.inviteOnly
              ? 'Registration now requires an invite code'
              : 'Registration is now open to everyone',
          });
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update flag' });
          this.inviteOnlyToggling.set(false);
        },
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

  loadRecentActivity(): void {
    this.activityLoading.set(true);
    this.api.auditLogs({ page: 1, limit: 5 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.recentActivity.set(res.data);
          this.activityLoading.set(false);
        },
        error: () => this.activityLoading.set(false),
      });
  }

  formatServiceName(name: string): string {
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
