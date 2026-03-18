import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuditLog, EventLog, LoginLog } from '../../core/models/admin.model';

type Tab = 'audit' | 'events' | 'logins';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [DatePipe, JsonPipe, ButtonModule, SkeletonModule],
  templateUrl: './logs.component.html',
})
export class LogsComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<Tab>('audit');

  auditLogs  = signal<AuditLog[]>([]);
  eventLogs  = signal<EventLog[]>([]);
  loginLogs  = signal<LoginLog[]>([]);

  auditTotal  = signal(0); auditPages  = signal(0); auditPage  = signal(1);
  eventTotal  = signal(0); eventPages  = signal(0); eventPage  = signal(1);
  loginTotal  = signal(0); loginPages  = signal(0); loginPage  = signal(1);

  loading = signal(true);
  readonly skeletons = Array(10);

  ngOnInit(): void { this.loadAudit(); }

  setTab(t: Tab): void {
    this.activeTab.set(t);
    if (t === 'audit'  && this.auditLogs().length === 0)  this.loadAudit();
    if (t === 'events' && this.eventLogs().length === 0)  this.loadEvents();
    if (t === 'logins' && this.loginLogs().length === 0)  this.loadLogins();
  }

  loadAudit(): void {
    this.loading.set(true);
    this.api.auditLogs({ page: this.auditPage(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => { this.auditLogs.set(r.data); this.auditTotal.set(r.total); this.auditPages.set(r.totalPages); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  loadEvents(): void {
    this.loading.set(true);
    this.api.eventLogs({ page: this.eventPage(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => { this.eventLogs.set(r.data); this.eventTotal.set(r.total); this.eventPages.set(r.totalPages); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  loadLogins(): void {
    this.loading.set(true);
    this.api.loginLogs({ page: this.loginPage(), limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => { this.loginLogs.set(r.data); this.loginTotal.set(r.total); this.loginPages.set(r.totalPages); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  prevAudit(): void { if (this.auditPage() > 1) { this.auditPage.update(p => p-1); this.loadAudit(); } }
  nextAudit(): void { if (this.auditPage() < this.auditPages()) { this.auditPage.update(p => p+1); this.loadAudit(); } }
  prevEvent(): void { if (this.eventPage() > 1) { this.eventPage.update(p => p-1); this.loadEvents(); } }
  nextEvent(): void { if (this.eventPage() < this.eventPages()) { this.eventPage.update(p => p+1); this.loadEvents(); } }
  prevLogin(): void { if (this.loginPage() > 1) { this.loginPage.update(p => p-1); this.loadLogins(); } }
  nextLogin(): void { if (this.loginPage() < this.loginPages()) { this.loginPage.update(p => p+1); this.loadLogins(); } }
}
