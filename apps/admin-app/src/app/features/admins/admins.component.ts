import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminAuthStore } from '../../core/store/admin-auth.store';
import { AdminView, AdminRole } from '../../core/models/admin.model';

@Component({
  selector: 'app-admins',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admins.component.html',
})
export class AdminsComponent implements OnInit {
  private readonly api     = inject(AdminApiService);
  private readonly toast   = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly auth            = inject(AdminAuthStore);

  readonly admins  = signal<AdminView[]>([]);
  readonly loading = signal(false);
  readonly saving  = signal(false);

  // ─── Create dialog ────────────────────────────────────────────────────────
  showCreate  = signal(false);
  createEmail       = '';
  createDisplayName = '';
  createPassword    = '';
  createRole: AdminRole = 'ADMIN';

  // ─── Edit dialog ──────────────────────────────────────────────────────────
  showEdit      = signal(false);
  editTarget    = signal<AdminView | null>(null);
  editDisplayName = '';
  editRole: AdminRole = 'ADMIN';
  editActive    = true;
  editPassword  = '';

  readonly roleOptions = [
    { label: 'Super Admin', value: 'SUPER_ADMIN' as AdminRole },
    { label: 'Admin',       value: 'ADMIN'       as AdminRole },
    { label: 'Viewer',      value: 'VIEWER'      as AdminRole },
  ];

  readonly currentAdminId = computed(() => this.auth.admin()?.id ?? '');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.listAdmins().subscribe({
      next:  a  => { this.admins.set(a); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.add({ severity: 'error', summary: 'Failed to load admins' }); },
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────
  openCreate() {
    this.createEmail = '';
    this.createDisplayName = '';
    this.createPassword = '';
    this.createRole = 'ADMIN';
    this.showCreate.set(true);
  }

  submitCreate() {
    if (!this.createEmail || !this.createDisplayName || !this.createPassword) return;
    this.saving.set(true);
    this.api.createAdmin({
      email:       this.createEmail,
      displayName: this.createDisplayName,
      password:    this.createPassword,
      role:        this.createRole,
    }).subscribe({
      next: created => {
        this.admins.update(list => [created, ...list]);
        this.showCreate.set(false);
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: 'Admin created', detail: created.email });
      },
      error: err => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Failed to create admin';
        this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────
  openEdit(admin: AdminView) {
    this.editTarget.set(admin);
    this.editDisplayName = admin.displayName;
    this.editRole        = admin.role;
    this.editActive      = admin.active;
    this.editPassword    = '';
    this.showEdit.set(true);
  }

  submitEdit() {
    const target = this.editTarget();
    if (!target) return;
    this.saving.set(true);

    const data: { displayName?: string; role?: AdminRole; active?: boolean; password?: string } = {
      displayName: this.editDisplayName,
      role:        this.editRole,
      active:      this.editActive,
    };
    if (this.editPassword) data['password'] = this.editPassword;

    this.api.updateAdmin(target.id, data).subscribe({
      next: updated => {
        this.admins.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.showEdit.set(false);
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: 'Admin updated' });
      },
      error: err => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Failed to update admin';
        this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  // ─── Deactivate ───────────────────────────────────────────────────────────
  deactivate(admin: AdminView) {
    this.confirm.confirm({
      header:  'Deactivate admin',
      message: `Deactivate ${admin.displayName} (${admin.email})? They will no longer be able to log in.`,
      icon:    'pi pi-exclamation-triangle',
      acceptLabel: 'Deactivate',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deactivateAdmin(admin.id).subscribe({
          next: () => {
            this.admins.update(list => list.map(a => a.id === admin.id ? { ...a, active: false } : a));
            this.toast.add({ severity: 'warn', summary: 'Admin deactivated', detail: admin.email });
          },
          error: err => {
            const msg = err?.error?.message ?? 'Failed to deactivate';
            this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
          },
        });
      },
    });
  }

  // ─── Reactivate ───────────────────────────────────────────────────────────
  reactivate(admin: AdminView) {
    this.api.updateAdmin(admin.id, { active: true }).subscribe({
      next: updated => {
        this.admins.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.toast.add({ severity: 'success', summary: 'Admin reactivated', detail: admin.email });
      },
      error: err => {
        const msg = err?.error?.message ?? 'Failed to reactivate';
        this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  roleLabel(role: AdminRole): string {
    return role.replace('_', ' ');
  }

  roleSeverity(role: AdminRole): string {
    if (role === 'SUPER_ADMIN') return 'danger';
    if (role === 'ADMIN') return 'info';
    return 'muted';
  }
}
