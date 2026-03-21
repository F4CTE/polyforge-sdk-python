import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminUserDetail, AdminApiKey } from '../../../core/models/admin.model';
import { AdminAuthStore } from '../../../core/store/admin-auth.store';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, ButtonModule, InputTextModule, InputNumberModule, DialogModule, ConfirmDialogModule, SkeletonModule, ToastModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmSvc = inject(ConfirmationService);
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

  // ─── API Keys ────────────────────────────────────────────────────────────────
  userApiKeys       = signal<AdminApiKey[]>([]);
  apiKeysLoading    = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.user(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: u => { this.user.set(u); this.limitsForm = { ...u.limits }; this.loading.set(false); this.loadApiKeys(u.id); },
        error: () => this.loading.set(false),
      });
  }

  loadApiKeys(userId: string): void {
    this.apiKeysLoading.set(true);
    this.api.userApiKeys(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: keys => { this.userApiKeys.set(keys); this.apiKeysLoading.set(false); },
        error: () => this.apiKeysLoading.set(false),
      });
  }

  revokeUserApiKey(keyId: string): void {
    const u = this.user();
    if (!u) return;
    this.confirmSvc.confirm({
      message: 'Are you sure you want to revoke this API key?',
      header: 'Revoke API Key?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.revokeUserApiKey(u.id, keyId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.userApiKeys.update(keys => keys.map(k => k.id === keyId ? { ...k, revoked: true } : k));
              this.toast.add({ severity: 'warn', summary: 'Revoked', detail: 'API key has been revoked.' });
            },
            error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to revoke API key.' }),
          });
      },
    });
  }

  confirmSuspend(): void {
    this.confirmSvc.confirm({
      message: 'Are you sure you want to suspend this user? They will lose access immediately.',
      header: 'Suspend User?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.showSuspendDialog.set(true),
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
