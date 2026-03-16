import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminUserDetail } from '../../../core/models/admin.model';
import { AdminAuthStore } from '../../../core/store/admin-auth.store';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, ButtonModule, InputTextModule, InputNumberModule, DialogModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth               = inject(AdminAuthStore);

  user    = signal<AdminUserDetail | null>(null);
  loading = signal(true);

  showSuspendDialog = signal(false);
  suspendReason     = '';
  suspending        = signal(false);

  showLimitsDialog  = signal(false);
  limitsForm = {
    maxStrategies:       0,
    maxOrdersPerMinute:  0,
    maxPositionSizeUsdc: 0,
    maxDailyLossUsdc:    0,
  };
  limitsSaving = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.user(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: u => { this.user.set(u); this.limitsForm = { ...u.limits }; this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  suspend(): void {
    const u = this.user();
    if (!u || this.suspending() || !this.suspendReason.trim()) return;
    this.suspending.set(true);
    this.api.suspendUser(u.id, this.suspendReason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.user.update(prev => prev ? { ...prev, suspended: res.suspended, suspendedAt: res.suspendedAt, suspendReason: res.reason } : prev);
          this.showSuspendDialog.set(false);
          this.suspendReason = '';
          this.toast.add({ severity: 'warn', summary: 'User suspended', detail: res.reason });
          this.suspending.set(false);
        },
        error: () => { this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to suspend user.' }); this.suspending.set(false); },
      });
  }

  unsuspend(): void {
    const u = this.user();
    if (!u) return;
    this.api.unsuspendUser(u.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.user.update(prev => prev ? { ...prev, suspended: false, suspendedAt: null, suspendReason: null } : prev);
          this.toast.add({ severity: 'success', summary: 'User unsuspended' });
        },
        error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to unsuspend user.' }),
      });
  }

  saveLimits(): void {
    const u = this.user();
    if (!u || this.limitsSaving()) return;
    this.limitsSaving.set(true);
    this.api.updateLimits(u.id, this.limitsForm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: limits => {
          this.user.update(prev => prev ? { ...prev, limits } : prev);
          this.showLimitsDialog.set(false);
          this.toast.add({ severity: 'success', summary: 'Limits updated' });
          this.limitsSaving.set(false);
        },
        error: () => { this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update limits.' }); this.limitsSaving.set(false); },
      });
  }

  openLimitsDialog(): void {
    const u = this.user();
    if (u) { this.limitsForm = { ...u.limits }; this.showLimitsDialog.set(true); }
  }
}
