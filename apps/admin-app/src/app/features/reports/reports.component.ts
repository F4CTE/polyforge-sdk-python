import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminReport, ReportStatus } from '../../core/models/admin.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, DatePipe, ButtonModule, SelectModule, DialogModule, InputTextModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  reports    = signal<AdminReport[]>([]);
  loading    = signal(true);
  statusFilter: ReportStatus | '' = 'PENDING';

  resolving  = signal<Record<string, boolean>>({});
  showDialog = signal(false);
  selected   = signal<AdminReport | null>(null);
  adminNote  = '';
  dialogAction: ReportStatus = 'REVIEWED';

  readonly statusOptions: { label: string; value: ReportStatus | '' }[] = [
    { label: 'Pending',  value: 'PENDING' },
    { label: 'Reviewed', value: 'REVIEWED' },
    { label: 'Dismissed', value: 'DISMISSED' },
    { label: 'All',      value: '' },
  ];

  readonly skeletons = Array(8);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.reports(this.statusFilter || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.reports.set(res.data); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  openDialog(report: AdminReport, action: ReportStatus): void {
    this.selected.set(report);
    this.adminNote = '';
    this.dialogAction = action;
    this.showDialog.set(true);
  }

  resolve(): void {
    const r = this.selected();
    if (!r) return;
    this.resolving.update(m => ({ ...m, [r.id]: true }));
    this.showDialog.set(false);
    this.api.resolveReport(r.id, this.dialogAction, this.adminNote || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reports.update(list => list.filter(x => x.id !== r.id));
          this.toast.add({ severity: 'success', summary: `Report ${this.dialogAction.toLowerCase()}`, detail: r.targetName ?? r.targetId });
          this.resolving.update(m => ({ ...m, [r.id]: false }));
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to resolve report.' });
          this.resolving.update(m => ({ ...m, [r.id]: false }));
        },
      });
  }
}
