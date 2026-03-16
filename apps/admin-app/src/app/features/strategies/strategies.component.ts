import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminStrategyView } from '../../core/models/admin.model';

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [FormsModule, DatePipe, ButtonModule, InputTextModule, SelectModule, SkeletonModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './strategies.component.html',
})
export class StrategiesComponent implements OnInit {
  private readonly api         = inject(AdminApiService);
  private readonly toast       = inject(MessageService);
  private readonly confirm     = inject(ConfirmationService);
  private readonly destroyRef  = inject(DestroyRef);

  strategies = signal<AdminStrategyView[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);

  status     = '';
  visibility = '';
  stopLoading = signal<Record<string, boolean>>({});

  readonly statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Running',      value: 'RUNNING' },
    { label: 'Paused',       value: 'PAUSED' },
    { label: 'Idle',         value: 'IDLE' },
    { label: 'Paper',        value: 'PAPER' },
    { label: 'Error',        value: 'ERROR' },
  ];

  readonly visibilityOptions = [
    { label: 'All',     value: '' },
    { label: 'Public',  value: 'PUBLIC' },
    { label: 'Unlisted', value: 'UNLISTED' },
    { label: 'Private', value: 'PRIVATE' },
  ];

  readonly skeletons = Array(10);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.strategies({ page: this.page(), limit: 20, status: this.status || undefined, visibility: this.visibility || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.strategies.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  onFilter(): void { this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  forceStop(s: AdminStrategyView, event: Event): void {
    this.confirm.confirm({
      target: event.target as EventTarget,
      message: `Force stop "${s.name}"?`,
      header: 'Confirm Force Stop',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.stopLoading.update(m => ({ ...m, [s.id]: true }));
        this.api.forceStop(s.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.strategies.update(list => list.map(x => x.id === s.id ? { ...x, status: 'IDLE' as const } : x));
              this.toast.add({ severity: 'warn', summary: 'Strategy stopped', detail: s.name });
              this.stopLoading.update(m => ({ ...m, [s.id]: false }));
            },
            error: () => {
              this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to stop strategy.' });
              this.stopLoading.update(m => ({ ...m, [s.id]: false }));
            },
          });
      },
    });
  }

  statusColor(s: string): string {
    const map: Record<string, string> = {
      RUNNING: 'var(--pf-success)',  PAPER: 'var(--pf-cyan-400)',
      PAUSED:  'var(--pf-warning)',  ERROR: 'var(--pf-danger)',
      IDLE:    'var(--pf-text-muted)', ARCHIVED: 'var(--pf-text-muted)',
    };
    return map[s] ?? 'var(--pf-text-muted)';
  }

  statusBg(s: string): string {
    const map: Record<string, string> = {
      RUNNING: 'rgba(16,185,129,0.1)', PAPER: 'rgba(6,182,212,0.1)',
      PAUSED:  'rgba(245,158,11,0.1)', ERROR: 'rgba(239,68,68,0.1)',
      IDLE:    'rgba(122,148,180,0.08)',
    };
    return map[s] ?? 'transparent';
  }
}
